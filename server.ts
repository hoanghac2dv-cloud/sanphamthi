import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  getDatabase,
  saveDatabase,
  verifyPassword,
  hashPassword,
  generateTempPassword,
  syncExperimentMetricsFromAttempts,
} from './server/repositories/database.ts';
import { verifyFirebaseIdToken } from './server/auth/firebaseAdmin.ts';
import {
  authorizeTeacherForAssessment,
  authorizeTeacherForClass,
  authorizeTeacherForExperiment,
  authorizeTeacherForLearningPath,
  authorizeTeacherForStudent,
  checkExperimentAssessmentAccess,
  getStudentAllowedQuestionIds,
  getTeacherAllowedClassIds,
  isAccountDisabled,
  sanitizeStudentFeedbackText,
  toStudentQuestionDTO,
  validateStudentTaskStepSubmission,
} from './server/auth/authorization.ts';
import {
  buildRuleBasedLearningPathBlueprint,
  calculateConfidence,
  calculateErrorReduction,
  calculateGainMetrics,
  calculateMasteryScore,
  calculatePathCompletion,
  canTransitionExperimentState,
  checkAccessPermission,
  detectRecurringErrors,
  evaluateAdaptiveAdjustment,
  evaluateCheckpointReroute,
  getCompetencyNameVi,
  getErrorNameVi,
  getMasteryLevelInfo,
  validatePrePostEquivalence,
  validateStudentImportRows,
  validateTeacherImportRows,
} from './server/path5/engine.ts';
import {
  analyzeStudentErrorWithGemini,
  explainLearningPathWithGemini,
  generateClassInsightWithGemini,
  generateProgressiveHintWithGemini,
  generateQuestionsWithGemini,
} from './server/ai/geminiService.ts';
import {
  AuditLogRecord,
  CompetencyCode,
  ErrorTagCode,
  ExperimentState,
  PathStatus,
  PrimaryUse,
  Question,
  QuestionType,
  Role,
  UserAccount,
} from './src/types/index.ts';

export const app = express();
app.use(express.json({ limit: '15mb' }));

// Active session tokens mapped to userId (backed by signed HMAC so server restarts don't drop sessions)
const SESSION_SECRET = process.env.SESSION_SECRET || 'aipath_v1_secret_key_2026';

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return parsed.userId || null;
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  actor?: UserAccount;
}

function recordAudit(
  action: AuditLogRecord['action'],
  actor: Pick<UserAccount, 'schoolId' | 'userId' | 'fullName' | 'role'>,
  details: string,
  targetId?: string
) {
  const db = getDatabase();
  db.auditLogs.unshift({
    logId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    schoolId: actor.schoolId,
    actorId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    action,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  });
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const userId = verifySessionToken(token);
  if (!userId) {
    return res
      .status(401)
      .json({ code: 'UNAUTHORIZED', error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  const db = getDatabase();
  const user = db.users.find((u) => u.userId === userId);
  if (!user) {
    return res
      .status(401)
      .json({ code: 'UNAUTHORIZED', error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  if (isAccountDisabled(user.status)) {
    return res.status(403).json({
      code: 'ACCOUNT_DISABLED',
      error: 'Tài khoản này đang bị tạm khóa hoặc vô hiệu hóa. Vui lòng liên hệ Quản trị viên.',
    });
  }

  // 1D. Tenant Isolation: Reject any client attempt to spoof another schoolId via body or query
  const bodySchoolId = req.body && typeof req.body === 'object' ? req.body.schoolId : undefined;
  const querySchoolId = req.query ? req.query.schoolId : undefined;
  const paramSchoolId = req.params ? req.params.schoolId : undefined;

  if (
    (bodySchoolId && String(bodySchoolId).trim() !== user.schoolId) ||
    (querySchoolId && String(querySchoolId).trim() !== user.schoolId) ||
    (paramSchoolId && String(paramSchoolId).trim() !== user.schoolId)
  ) {
    recordAudit(
      'SECURITY_VIOLATION',
      user,
      `Từ chối truy cập chéo trường (Tenant Isolation): Actor school=${user.schoolId}, Requested school=${
        bodySchoolId || querySchoolId || paramSchoolId
      }`
    );
    saveDatabase(db);
    return res.status(403).json({
      code: 'TENANT_MISMATCH',
      error: 'Truy cập bị từ chối: Không được phép truy cập hoặc thao tác dữ liệu của trường học khác.',
    });
  }

  // Never trust client-supplied schoolId or role
  if (req.body && typeof req.body === 'object') {
    if ('schoolId' in req.body) {
      req.body.schoolId = user.schoolId;
    }
    if (user.role !== Role.ADMIN && 'role' in req.body) {
      delete req.body.role;
    }
  }

  req.actor = user;
  return next();
}

// ============================================================================
// 1. AUTHENTICATION ROUTES
// ============================================================================
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.' });
  }

  const db = getDatabase();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === cleanUser || (u.email && u.email.toLowerCase() === cleanUser)
  );

  if (!user) {
    recordAudit(
      'LOGIN_FAILED',
      {
        schoolId: db.schools[0]?.schoolId || 'school_demo_aipath',
        userId: 'anonymous',
        fullName: cleanUser,
        role: Role.STUDENT,
      },
      `Đăng nhập thất bại: Không tìm thấy tài khoản "${cleanUser}".`
    );
    saveDatabase(db);
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  if (isAccountDisabled(user.status)) {
    recordAudit('LOGIN_FAILED', user, `Đăng nhập bị từ chối do tài khoản ở trạng thái ${user.status}.`, user.userId);
    saveDatabase(db);
    return res.status(403).json({
      code: 'ACCOUNT_DISABLED',
      error: 'Tài khoản này đang bị tạm khóa hoặc vô hiệu hóa. Vui lòng liên hệ Quản trị viên.',
    });
  }

  const cred = db.credentials.find((c) => c.userId === user.userId);
  if (!cred || !verifyPassword(cleanPass, cred.passwordSalt, cred.passwordHash)) {
    recordAudit('LOGIN_FAILED', user, `Đăng nhập thất bại: Sai mật khẩu cho tài khoản ${user.username}.`, user.userId);
    saveDatabase(db);
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  user.updatedAt = new Date().toISOString();
  recordAudit('LOGIN', user, `Đăng nhập hệ thống bằng tài khoản ${user.username} (${user.role}).`, user.userId);
  saveDatabase(db);

  const token = createSessionToken(user.userId);
  return res.json({
    token,
    user,
    internalAuthEmail: `${user.username.toLowerCase()}@aipath.edu.vn`,
  });
});

/**
 * 1A. GOOGLE / FIREBASE LOGIN (VERIFIED ID TOKEN ONLY)
 * Backend strictly verifies Firebase ID Token via Firebase Admin SDK.
 * Never trusts client-supplied email, displayName, uid, or role.
 * Never auto-provisions or falls back to "first teacher" or "admin".
 */
app.post('/api/auth/google-sync', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const bodyToken = req.body && typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
  const idToken = bodyToken || bearerToken;

  if (!idToken) {
    return res.status(401).json({
      code: 'MISSING_ID_TOKEN',
      error: 'Thiếu Firebase ID Token đã xác thực. Hệ thống không chấp nhận thông tin định danh thô từ trình duyệt.',
    });
  }

  let verifiedIdentity;
  try {
    verifiedIdentity = await verifyFirebaseIdToken(idToken);
  } catch {
    return res.status(401).json({
      code: 'INVALID_ID_TOKEN',
      error: 'Firebase ID Token không hợp lệ hoặc đã hết hạn.',
    });
  }

  const verifiedEmail = String(verifiedIdentity.email || '').trim().toLowerCase();
  if (!verifiedEmail || !verifiedIdentity.emailVerified) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      error: 'Tài khoản Google chưa có email được xác minh hợp lệ.',
    });
  }

  const db = getDatabase();
  const user = db.users.find(
    (u) => u.email && u.email.trim().toLowerCase() === verifiedEmail
  );

  // 1A. CRITICAL: Do NOT fallback to first teacher or auto-assign strangers!
  if (!user) {
    recordAudit(
      'LOGIN_FAILED',
      {
        schoolId: db.schools[0]?.schoolId || 'school_demo_aipath',
        userId: verifiedIdentity.uid || 'unprovisioned_google_user',
        fullName: verifiedEmail,
        role: Role.STUDENT,
      },
      `Từ chối đăng nhập Google cho tài khoản chưa được cấp quyền: ${verifiedEmail} (uid: ${verifiedIdentity.uid}).`
    );
    saveDatabase(db);
    return res.status(403).json({
      code: 'ACCOUNT_NOT_PROVISIONED',
      error: 'Tài khoản này chưa được nhà trường cấp quyền sử dụng AI PATH.',
    });
  }

  if (isAccountDisabled(user.status)) {
    recordAudit(
      'LOGIN_FAILED',
      user,
      `Từ chối đăng nhập Google do tài khoản ở trạng thái ${user.status} (${verifiedEmail}).`,
      user.userId
    );
    saveDatabase(db);
    return res.status(403).json({
      code: 'ACCOUNT_DISABLED',
      error: 'Tài khoản này đang bị tạm khóa hoặc vô hiệu hóa. Vui lòng liên hệ Quản trị viên.',
    });
  }

  user.updatedAt = new Date().toISOString();
  recordAudit(
    'LOGIN',
    user,
    `Đăng nhập qua Google Auth đã xác minh ID Token (${verifiedEmail}, uid: ${verifiedIdentity.uid}).`,
    user.userId
  );
  saveDatabase(db);

  const token = createSessionToken(user.userId);
  return res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.actor });
});

// ============================================================================
// 2. TENANT-ISOLATED & RBAC-FILTERED BOOTSTRAP DATA + SAFE QUESTION ENDPOINTS
// ============================================================================
app.get('/api/questions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const db = getDatabase();
  const schoolQuestions = db.questions.filter((q) => q.schoolId === actor.schoolId);

  if (actor.role === Role.STUDENT) {
    const allowedQIds = getStudentAllowedQuestionIds(actor, db);
    return res.json({
      questions: schoolQuestions
        .filter((q) => allowedQIds.has(q.questionId))
        .map(toStudentQuestionDTO),
    });
  }

  return res.json({ questions: schoolQuestions });
});

app.get('/api/assessments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const db = getDatabase();
  const schoolId = actor.schoolId;

  if (actor.role === Role.STUDENT) {
    const myAssessments = db.assessments
      .filter((a) => a.schoolId === schoolId && a.classId === actor.classId && a.status === 'PUBLISHED')
      .map((a) => {
        const access = checkExperimentAssessmentAccess(db, a);
        return access.allowed ? a : { ...a, questionIds: [] };
      });
    return res.json({ assessments: myAssessments });
  }

  if (actor.role === Role.TEACHER) {
    const allowedClassIds = getTeacherAllowedClassIds(actor, db);
    const teacherAssessments = db.assessments.filter(
      (a) => a.schoolId === schoolId && allowedClassIds.has(a.classId)
    );
    return res.json({ assessments: teacherAssessments });
  }

  return res.json({
    assessments: db.assessments.filter((a) => a.schoolId === schoolId),
  });
});

app.get('/api/assessments/:assessmentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { assessmentId } = req.params;
  const db = getDatabase();
  const assessment = db.assessments.find(
    (a) => a.assessmentId === assessmentId && a.schoolId === actor.schoolId
  );
  if (!assessment) {
    return res.status(404).json({ error: 'Không tìm thấy bài đánh giá.' });
  }

  if (actor.role === Role.STUDENT) {
    if (actor.classId && assessment.classId && assessment.classId !== actor.classId) {
      return res.status(403).json({ code: 'CLASS_SCOPE_VIOLATION', error: 'Bài đánh giá không thuộc lớp của bạn.' });
    }
    const access = checkExperimentAssessmentAccess(db, assessment);
    if (!access.allowed) {
      return res.status(access.statusCode).json({
        code: access.code,
        error: access.error,
      });
    }
    const assessmentQuestions = db.questions
      .filter((q) => q.schoolId === actor.schoolId && assessment.questionIds.includes(q.questionId))
      .map(toStudentQuestionDTO);
    return res.json({
      assessment,
      questions: assessmentQuestions,
    });
  }

  if (actor.role === Role.TEACHER && !authorizeTeacherForAssessment(actor, assessmentId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền truy cập đề đánh giá của lớp khác.',
    });
  }

  const assessmentQuestions = db.questions.filter(
    (q) => q.schoolId === actor.schoolId && assessment.questionIds.includes(q.questionId)
  );
  return res.json({
    assessment,
    questions: assessmentQuestions,
  });
});

app.get('/api/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const db = getDatabase();
  const schoolId = actor.schoolId; // 1D. Server strictly derives schoolId from verified backend user!

  const schools = db.schools.filter((s) => s.schoolId === schoolId);
  const academicYears = db.academicYears.filter((a) => a.schoolId === schoolId);
  const subjects = db.subjects.filter((s) => s.schoolId === schoolId);
  const topics = db.topics.filter((t) => t.schoolId === schoolId);
  const competencies = db.competencies.filter((c) => c.schoolId === schoolId);
  const errorTypes = db.errorTypes.filter((e) => e.schoolId === schoolId);
  const questions = db.questions.filter((q) => q.schoolId === schoolId);

  if (actor.role === Role.STUDENT) {
    // 1B & FIX 02: Student ONLY receives scoped questions for currently open assessments and active Learning Path steps!
    const mySnapshots = db.competencySnapshots.filter(
      (s) => s.schoolId === schoolId && s.studentId === actor.userId
    );
    const myPaths = db.learningPaths.filter(
      (p) => p.schoolId === schoolId && p.studentId === actor.userId
    );
    const myErrors = db.detectedErrors.filter(
      (e) => pMatchesStudent(e, schoolId, actor.userId)
    );
    const myAttempts = db.attempts.filter(
      (a) => a.schoolId === schoolId && a.studentId === actor.userId
    );
    const myProgress = db.progressHistory.filter((p) => p.studentId === actor.userId);
    const myAssessments = db.assessments
      .filter((a) => a.schoolId === schoolId && a.classId === actor.classId && a.status === 'PUBLISHED')
      .map((a) => {
        const access = checkExperimentAssessmentAccess(db, a);
        return access.allowed ? a : { ...a, questionIds: [] };
      });
    const myExperiments = db.experiments.filter(
      (e) => e.schoolId === schoolId && e.classId === actor.classId
    );
    const myFeedback = db.feedbackResponses.filter(
      (f) => f.schoolId === schoolId && f.respondentId === actor.userId
    );
    const allowedQIds = getStudentAllowedQuestionIds(actor, db);

    return res.json({
      role: Role.STUDENT,
      schools,
      academicYears,
      classes: db.classes.filter((c) => c.schoolId === schoolId && c.classId === actor.classId),
      users: [actor],
      subjects,
      topics,
      competencies,
      errorTypes,
      questions: questions.filter((q) => allowedQIds.has(q.questionId)).map(toStudentQuestionDTO),
      assessments: myAssessments,
      attempts: myAttempts,
      competencySnapshots: mySnapshots,
      learningPaths: myPaths,
      detectedErrors: myErrors,
      teacherOverrides: [],
      progressHistory: myProgress,
      experiments: myExperiments,
      experimentStudentMetrics: [],
      feedbackResponses: myFeedback,
      experimentCaseStudies: [],
      experimentEvidence: [],
      aiRuns: [],
      auditLogs: [],
    });
  }

  if (actor.role === Role.TEACHER) {
    // 1C: Teacher ONLY sees assigned classes, students in those classes (excluding classId = null!), and scoped records
    const allowedClassIds = getTeacherAllowedClassIds(actor, db);
    const teacherClasses = db.classes.filter(
      (c) => c.schoolId === schoolId && allowedClassIds.has(c.classId)
    );

    const classStudents = db.users.filter(
      (u) =>
        u.schoolId === schoolId &&
        u.role === Role.STUDENT &&
        Boolean(u.classId) &&
        allowedClassIds.has(u.classId!)
    );
    const studentIds = new Set(classStudents.map((s) => s.userId));

    const teacherAssessments = db.assessments.filter(
      (a) => a.schoolId === schoolId && allowedClassIds.has(a.classId)
    );
    const teacherExperiments = db.experiments.filter(
      (e) => e.schoolId === schoolId && allowedClassIds.has(e.classId)
    );
    const allowedExperimentIds = new Set(teacherExperiments.map((e) => e.experimentId));

    return res.json({
      role: Role.TEACHER,
      schools,
      academicYears,
      classes: teacherClasses,
      users: classStudents,
      subjects,
      topics,
      competencies,
      errorTypes,
      questions,
      assessments: teacherAssessments,
      attempts: db.attempts.filter((a) => a.schoolId === schoolId && studentIds.has(a.studentId)),
      competencySnapshots: db.competencySnapshots.filter(
        (s) => s.schoolId === schoolId && studentIds.has(s.studentId)
      ),
      learningPaths: db.learningPaths.filter(
        (p) => p.schoolId === schoolId && studentIds.has(p.studentId)
      ),
      detectedErrors: db.detectedErrors.filter(
        (e) => e.schoolId === schoolId && studentIds.has(e.studentId)
      ),
      teacherOverrides: db.teacherOverrides.filter(
        (o) =>
          o.schoolId === schoolId &&
          (o.teacherId === actor.userId || (o.studentId ? studentIds.has(o.studentId) : false))
      ),
      experiments: teacherExperiments,
      experimentStudentMetrics: db.experimentStudentMetrics.filter(
        (m) =>
          m.schoolId === schoolId &&
          allowedExperimentIds.has(m.experimentId) &&
          studentIds.has(m.studentId)
      ),
      feedbackResponses: db.feedbackResponses.filter(
        (f) => f.schoolId === schoolId && allowedExperimentIds.has(f.experimentId)
      ),
      experimentCaseStudies: db.experimentCaseStudies.filter(
        (c) =>
          c.schoolId === schoolId &&
          allowedExperimentIds.has(c.experimentId) &&
          studentIds.has(c.studentId)
      ),
      experimentEvidence: db.experimentEvidence.filter(
        (ev) => ev.schoolId === schoolId && allowedExperimentIds.has(ev.experimentId)
      ),
      progressHistory: db.progressHistory.filter((ph) => studentIds.has(ph.studentId)),
    });
  }

  // Role.ADMIN: Full school scope (strictly isolated to actor.schoolId)
  const schoolStudentIds = new Set(
    db.users.filter((u) => u.schoolId === schoolId).map((u) => u.userId)
  );
  return res.json({
    role: Role.ADMIN,
    schools,
    academicYears,
    classes: db.classes.filter((c) => c.schoolId === schoolId),
    users: db.users.filter((u) => u.schoolId === schoolId),
    subjects,
    topics,
    competencies,
    errorTypes,
    questions,
    assessments: db.assessments.filter((a) => a.schoolId === schoolId),
    attempts: db.attempts.filter((a) => a.schoolId === schoolId),
    competencySnapshots: db.competencySnapshots.filter((s) => s.schoolId === schoolId),
    learningPaths: db.learningPaths.filter((p) => p.schoolId === schoolId),
    detectedErrors: db.detectedErrors.filter((e) => e.schoolId === schoolId),
    teacherOverrides: db.teacherOverrides.filter((o) => o.schoolId === schoolId),
    experiments: db.experiments.filter((e) => e.schoolId === schoolId),
    experimentStudentMetrics: db.experimentStudentMetrics.filter((m) => m.schoolId === schoolId),
    feedbackResponses: db.feedbackResponses.filter((f) => f.schoolId === schoolId),
    experimentCaseStudies: db.experimentCaseStudies.filter((c) => c.schoolId === schoolId),
    experimentEvidence: db.experimentEvidence.filter((ev) => ev.schoolId === schoolId),
    aiRuns: db.aiRuns.filter((r) => r.schoolId === schoolId),
    auditLogs: db.auditLogs.filter((l) => l.schoolId === schoolId),
    progressHistory: db.progressHistory.filter((ph) => schoolStudentIds.has(ph.studentId)),
  });
});

function pMatchesStudent(
  record: { schoolId: string; studentId: string },
  schoolId: string,
  studentId: string
): boolean {
  return record.schoolId === schoolId && record.studentId === studentId;
}

// ============================================================================
// 3. ADMIN MANAGEMENT & EXCEL IMPORT ROUTES (SECTIONS 19-28)
// ============================================================================
app.post('/api/admin/teachers/manual', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thêm giáo viên.' });
  }

  const { code, fullName, username, email, phone, subjectCode, className, status } = req.body || {};
  const cleanCode = String(code || '').trim();
  const cleanName = String(fullName || '').trim();
  const cleanUsername = String(username || '').trim();
  const cleanEmail = String(email || '').trim();

  if (!cleanCode || !cleanName || !cleanUsername) {
    return res.status(400).json({ error: 'Vui lòng nhập bắt buộc: Mã giáo viên, Họ và tên, Tên đăng nhập.' });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);

  if (schoolUsers.some((u) => u.code.toUpperCase() === cleanCode.toUpperCase())) {
    return res.status(409).json({ error: `Mã giáo viên ${cleanCode} đã tồn tại trong hệ thống.` });
  }
  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(409).json({ error: `Tên đăng nhập ${cleanUsername} đã tồn tại.` });
  }
  if (cleanEmail && db.users.some((u) => u.email?.toLowerCase() === cleanEmail.toLowerCase())) {
    return res.status(409).json({ error: `Email ${cleanEmail} đã tồn tại.` });
  }

  const now = new Date().toISOString();
  const tempPassword = generateTempPassword();
  const userId = `user_gv_${Date.now()}`;
  const matchedClass = db.classes.find(
    (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === String(className || '').trim().toUpperCase()
  );

  const newUser: UserAccount = {
    userId,
    schoolId: actor.schoolId,
    code: cleanCode,
    username: cleanUsername,
    fullName: cleanName,
    role: Role.TEACHER,
    email: cleanEmail || undefined,
    phone: phone ? String(phone).trim() : undefined,
    subjectCode: subjectCode || 'TOAN_8',
    classId: matchedClass?.classId,
    className: matchedClass?.name || (className ? String(className).trim() : undefined),
    assignedClassNames: className ? [String(className).trim()] : [],
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'REAL',
    pseudonymId: `teacher_${crypto.randomBytes(2).toString('hex')}`,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  const { salt, hash } = hashPassword(tempPassword);
  db.users.push(newUser);
  db.credentials.push({
    userId,
    username: cleanUsername.toLowerCase(),
    passwordSalt: salt,
    passwordHash: hash,
    updatedAt: now,
  });

  recordAudit('CREATE_USER', actor, `Tạo giáo viên ${cleanName} (${cleanCode}).`, userId);
  saveDatabase(db);

  // 13. Only return temporary password ONCE upon creation
  return res.json({
    user: newUser,
    oneTimeTempPassword: tempPassword,
  });
});

app.post('/api/admin/teachers/validate-import', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền import Excel.' });
  }

  const { rows, fileName } = req.body || {};
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Dữ liệu dòng Excel không hợp lệ.' });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);
  const existingCodes = new Set(schoolUsers.map((u) => u.code.toUpperCase()));
  const existingUsernames = new Set(db.users.map((u) => u.username.toLowerCase()));
  const existingEmails = new Set(
    db.users.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  );
  const existingClassNames = new Set(
    db.classes.filter((c) => c.schoolId === actor.schoolId).map((c) => c.name.toUpperCase())
  );

  const validation = validateTeacherImportRows(
    rows,
    existingCodes,
    existingUsernames,
    existingEmails,
    existingClassNames,
    fileName
  );

  return res.json(validation);
});

app.post('/api/admin/teachers/commit-import', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền import Excel.' });
  }

  const { rows, fileName } = req.body || {};
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Dữ liệu import không hợp lệ.' });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);
  const existingCodes = new Set(schoolUsers.map((u) => u.code.toUpperCase()));
  const existingUsernames = new Set(db.users.map((u) => u.username.toLowerCase()));
  const existingEmails = new Set(
    db.users.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  );
  const existingClassNames = new Set(
    db.classes.filter((c) => c.schoolId === actor.schoolId).map((c) => c.name.toUpperCase())
  );

  // Re-validate on backend before commit!
  const validation = validateTeacherImportRows(
    rows,
    existingCodes,
    existingUsernames,
    existingEmails,
    existingClassNames,
    fileName
  );

  if (!validation.canCommit) {
    return res.status(400).json({
      error: `Không thể nhập dữ liệu do có ${validation.errorCount} dòng lỗi nghiêm trọng.`,
      validation,
    });
  }

  const now = new Date().toISOString();
  const createdTeachers: {
    user: UserAccount;
    tempPassword: string;
    needsAssignmentCheck: boolean;
  }[] = [];

  validation.rows.forEach((r, idx) => {
    const raw = r.rawData;
    const userId = `user_gv_imp_${Date.now()}_${idx}`;
    const tempPassword = generateTempPassword();
    const lopName = raw.Lop_Phu_Trach || '';
    const matchedClass = db.classes.find(
      (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === lopName.toUpperCase()
    );
    const needsCheck = !lopName || !matchedClass;

    const newUser: UserAccount = {
      userId,
      schoolId: actor.schoolId,
      code: raw.Ma_Giao_Vien,
      username: raw.Ten_Dang_Nhap,
      fullName: raw.Ho_Va_Ten,
      role: Role.TEACHER,
      email: raw.Email || undefined,
      phone: raw.So_Dien_Thoai || undefined,
      subjectCode: raw.Mon_Giang_Day || 'TOAN_8',
      classId: matchedClass?.classId,
      className: matchedClass?.name || (lopName || undefined),
      assignedClassNames: matchedClass ? [matchedClass.name] : lopName ? [lopName] : [],
      status: needsCheck ? 'NEEDS_ASSIGNMENT_CHECK' : 'ACTIVE',
      dataSource: 'REAL',
      pseudonymId: `teacher_${crypto.randomBytes(2).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };

    const { salt, hash } = hashPassword(tempPassword);
    db.users.push(newUser);
    db.credentials.push({
      userId,
      username: newUser.username.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: now,
    });

    createdTeachers.push({
      user: newUser,
      tempPassword,
      needsAssignmentCheck: needsCheck,
    });
  });

  const assignedCount = createdTeachers.filter((t) => !t.needsAssignmentCheck).length;
  const needsCheckCount = createdTeachers.filter((t) => t.needsAssignmentCheck).length;

  recordAudit(
    'IMPORT_TEACHERS',
    actor,
    `Import Excel ${createdTeachers.length} giáo viên (${assignedCount} đã gán lớp, ${needsCheckCount} cần kiểm tra phân công).`
  );
  saveDatabase(db);

  return res.json({
    totalCreated: createdTeachers.length,
    assignedCount,
    needsCheckCount,
    createdTeachers,
  });
});

app.put('/api/admin/teachers/:userId/assignment', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền phân công giáo viên.' });
  }

  const { userId } = req.params;
  const { action, subjectCode, className } = req.body || {}; // action: 'CONFIRM' | 'UPDATE' | 'UNASSIGN'
  const db = getDatabase();
  const user = db.users.find((u) => u.userId === userId && u.schoolId === actor.schoolId);

  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy giáo viên.' });
  }

  if (action === 'UNASSIGN') {
    user.classId = undefined;
    user.className = undefined;
    user.assignedClassNames = [];
    user.status = 'ACTIVE';
  } else {
    const targetClass = db.classes.find(
      (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === String(className || user.className || '').toUpperCase()
    );
    user.subjectCode = subjectCode || user.subjectCode || 'TOAN_8';
    user.classId = targetClass?.classId;
    user.className = targetClass?.name || className || user.className;
    user.assignedClassNames = user.className ? [user.className] : [];
    user.status = 'ACTIVE';
  }

  user.updatedAt = new Date().toISOString();
  recordAudit('EDIT_USER', actor, `Cập nhật phân công giảng dạy cho GV ${user.fullName} (${action}).`, user.userId);
  saveDatabase(db);

  return res.json({ user });
});

app.post('/api/admin/students/manual', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền thêm học sinh.' });
  }

  const { code, fullName, username, dob, gender, className, grade, email, status } = req.body || {};
  const cleanCode = String(code || '').trim();
  const cleanName = String(fullName || '').trim();
  const cleanUsername = String(username || '').trim();
  const cleanClass = String(className || '').trim();
  const cleanEmail = String(email || '').trim();

  if (!cleanCode || !cleanName || !cleanUsername || !cleanClass) {
    return res.status(400).json({
      error: 'Vui lòng nhập đầy đủ: Mã học sinh, Họ và tên, Tên đăng nhập và Lớp.',
    });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);

  if (schoolUsers.some((u) => u.code.toUpperCase() === cleanCode.toUpperCase())) {
    return res.status(409).json({ error: `Mã học sinh ${cleanCode} đã tồn tại.` });
  }
  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return res.status(409).json({ error: `Tên đăng nhập ${cleanUsername} đã tồn tại.` });
  }
  if (cleanEmail && db.users.some((u) => u.email?.toLowerCase() === cleanEmail.toLowerCase())) {
    return res.status(409).json({ error: `Email ${cleanEmail} đã tồn tại.` });
  }

  const currentYear = db.academicYears.find((y) => y.schoolId === actor.schoolId && y.isCurrent);
  const matchedClass = db.classes.find(
    (c) =>
      c.schoolId === actor.schoolId &&
      c.name.toUpperCase() === cleanClass.toUpperCase() &&
      (!currentYear || c.academicYearId === currentYear.academicYearId)
  );

  // 26. Do NOT silently create class if it does not exist!
  if (!matchedClass) {
    return res.status(404).json({
      error: `Lớp ${cleanClass} chưa tồn tại trong năm học hiện tại.`,
      missingClassName: cleanClass,
      requireClassCreationConfirmation: true,
    });
  }

  const now = new Date().toISOString();
  const tempPassword = generateTempPassword();
  const userId = `user_hs_${Date.now()}`;

  const newUser: UserAccount = {
    userId,
    schoolId: actor.schoolId,
    code: cleanCode,
    username: cleanUsername,
    fullName: cleanName,
    role: Role.STUDENT,
    dob: dob || undefined,
    gender: gender || undefined,
    classId: matchedClass.classId,
    className: matchedClass.name,
    grade: Number(grade) || matchedClass.grade || 8,
    academicYearId: matchedClass.academicYearId,
    email: cleanEmail || undefined,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    dataSource: 'REAL',
    pseudonymId: `student_${crypto.randomBytes(2).toString('hex')}`,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  const { salt, hash } = hashPassword(tempPassword);
  db.users.push(newUser);
  db.credentials.push({
    userId,
    username: cleanUsername.toLowerCase(),
    passwordSalt: salt,
    passwordHash: hash,
    updatedAt: now,
  });

  db.classMembers.push({
    memberId: `cm_${userId}`,
    schoolId: actor.schoolId,
    classId: matchedClass.classId,
    userId,
    memberRole: 'STUDENT',
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  });

  matchedClass.studentCount = db.users.filter(
    (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === matchedClass.classId
  ).length;

  recordAudit('CREATE_USER', actor, `Thêm học sinh ${cleanName} (${cleanCode}) vào lớp ${matchedClass.name}.`, userId);
  saveDatabase(db);

  return res.json({
    user: newUser,
    oneTimeTempPassword: tempPassword,
  });
});

app.post('/api/admin/students/validate-import', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền import học sinh.' });
  }

  const { rows, fileName } = req.body || {};
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Dữ liệu dòng Excel không hợp lệ.' });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);
  const existingCodes = new Set(schoolUsers.map((u) => u.code.toUpperCase()));
  const existingUsernames = new Set(db.users.map((u) => u.username.toLowerCase()));
  const existingEmails = new Set(
    db.users.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  );
  const currentYear = db.academicYears.find((y) => y.schoolId === actor.schoolId && y.isCurrent);
  const existingClassNames = new Set(
    db.classes
      .filter((c) => c.schoolId === actor.schoolId && (!currentYear || c.academicYearId === currentYear.academicYearId))
      .map((c) => c.name.toUpperCase())
  );

  const validation = validateStudentImportRows(
    rows,
    existingCodes,
    existingUsernames,
    existingEmails,
    existingClassNames,
    fileName
  );

  return res.json(validation);
});

app.post('/api/admin/classes/create', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền tạo lớp học.' });
  }

  const { name, grade, teacherId } = req.body || {};
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Vui lòng nhập tên lớp (ví dụ: 8A5).' });
  }

  const db = getDatabase();
  const currentYear = db.academicYears.find((y) => y.schoolId === actor.schoolId && y.isCurrent);
  const existing = db.classes.find(
    (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === cleanName.toUpperCase()
  );
  if (existing) {
    return res.status(409).json({ error: `Lớp ${cleanName} đã tồn tại.` });
  }

  const teacher =
    db.users.find((u) => u.userId === teacherId && u.role === Role.TEACHER) ||
    db.users.find((u) => u.schoolId === actor.schoolId && u.role === Role.TEACHER);

  const now = new Date().toISOString();
  const newClass = {
    classId: `class_${cleanName.toLowerCase()}_${Date.now()}`,
    schoolId: actor.schoolId,
    academicYearId: currentYear?.academicYearId || 'ay_2026_2027',
    name: cleanName,
    grade: Number(grade) || 8,
    teacherId: teacher?.userId || 'user_teacher_8a2',
    teacherName: teacher?.fullName || 'Nguyễn Thị Lan',
    studentCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  db.classes.push(newClass);
  saveDatabase(db);
  return res.json({ classRoom: newClass });
});

app.post('/api/admin/students/commit-import', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền import học sinh.' });
  }

  const { rows, fileName } = req.body || {};
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'Dữ liệu import không hợp lệ.' });
  }

  const db = getDatabase();
  const schoolUsers = db.users.filter((u) => u.schoolId === actor.schoolId);
  const existingCodes = new Set(schoolUsers.map((u) => u.code.toUpperCase()));
  const existingUsernames = new Set(db.users.map((u) => u.username.toLowerCase()));
  const existingEmails = new Set(
    db.users.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  );
  const currentYear = db.academicYears.find((y) => y.schoolId === actor.schoolId && y.isCurrent);
  const existingClassNames = new Set(
    db.classes
      .filter((c) => c.schoolId === actor.schoolId && (!currentYear || c.academicYearId === currentYear.academicYearId))
      .map((c) => c.name.toUpperCase())
  );

  const validation = validateStudentImportRows(
    rows,
    existingCodes,
    existingUsernames,
    existingEmails,
    existingClassNames,
    fileName
  );

  if (!validation.canCommit) {
    return res.status(400).json({
      error:
        validation.missingClasses.length > 0
          ? `Lớp ${validation.missingClasses.join(', ')} chưa tồn tại trong năm học hiện tại.`
          : `Không thể nhập dữ liệu do có ${validation.errorCount} lỗi nghiêm trọng.`,
      validation,
    });
  }

  const now = new Date().toISOString();
  const createdStudents: { user: UserAccount; tempPassword: string }[] = [];

  validation.rows.forEach((r, idx) => {
    const raw = r.rawData;
    const matchedClass = db.classes.find(
      (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === raw.Lop.toUpperCase()
    )!;
    const userId = `user_hs_imp_${Date.now()}_${idx}`;
    const tempPassword = generateTempPassword();

    const newUser: UserAccount = {
      userId,
      schoolId: actor.schoolId,
      code: raw.Ma_Hoc_Sinh,
      username: raw.Ten_Dang_Nhap,
      fullName: raw.Ho_Va_Ten,
      role: Role.STUDENT,
      dob: raw.Ngay_Sinh || undefined,
      gender: raw.Gioi_Tinh || undefined,
      classId: matchedClass.classId,
      className: matchedClass.name,
      grade: Number(raw.Khoi) || matchedClass.grade || 8,
      academicYearId: matchedClass.academicYearId,
      email: raw.Email || undefined,
      status: 'ACTIVE',
      dataSource: 'REAL',
      pseudonymId: `student_${crypto.randomBytes(2).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };

    const { salt, hash } = hashPassword(tempPassword);
    db.users.push(newUser);
    db.credentials.push({
      userId,
      username: newUser.username.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: now,
    });

    db.classMembers.push({
      memberId: `cm_${userId}`,
      schoolId: actor.schoolId,
      classId: matchedClass.classId,
      userId,
      memberRole: 'STUDENT',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    });

    createdStudents.push({ user: newUser, tempPassword });
  });

  // Recompute class student counts
  for (const cls of db.classes.filter((c) => c.schoolId === actor.schoolId)) {
    cls.studentCount = db.users.filter(
      (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === cls.classId
    ).length;
  }

  recordAudit(
    'IMPORT_STUDENTS',
    actor,
    `Import Excel thành công ${createdStudents.length} học sinh và tự động gán vào lớp.`
  );
  saveDatabase(db);

  return res.json({
    totalCreated: createdStudents.length,
    createdStudents,
  });
});

app.put('/api/admin/users/:userId/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền đổi trạng thái tài khoản.' });
  }

  const { userId } = req.params;
  const { status } = req.body || {};
  const db = getDatabase();
  const user = db.users.find((u) => u.userId === userId && u.schoolId === actor.schoolId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

  user.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  user.updatedAt = new Date().toISOString();
  recordAudit('EDIT_USER', actor, `Đổi trạng thái tài khoản ${user.username} sang ${user.status}.`, user.userId);
  saveDatabase(db);

  return res.json({ user });
});

app.put('/api/admin/users/:userId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tài khoản.' });
  }

  const { userId } = req.params;
  const {
    code,
    fullName,
    username,
    email,
    phone,
    dob,
    gender,
    subjectCode,
    className,
    status,
    newPassword,
  } = req.body || {};

  const db = getDatabase();
  const user = db.users.find((u) => u.userId === userId && u.schoolId === actor.schoolId);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản cần chỉnh sửa.' });
  }

  // 1C. If actor is TEACHER, allow editing own profile OR strictly enforce authorizeTeacherForStudent
  if (actor.role === Role.TEACHER) {
    if (user.userId !== actor.userId) {
      if (user.role !== Role.STUDENT) {
        return res.status(403).json({
          error: 'Giáo viên chỉ được phép chỉnh sửa thông tin cá nhân hoặc học sinh trong lớp phụ trách.',
        });
      }
      if (!authorizeTeacherForStudent(actor, user.userId, db)) {
        return res.status(403).json({
          code: 'TEACHER_SCOPE_VIOLATION',
          error: 'Bạn chỉ có quyền chỉnh sửa học sinh thuộc lớp mình phụ trách.',
        });
      }
    }
  }

  const cleanCode = code !== undefined ? String(code).trim() : user.code;
  const cleanName = fullName !== undefined ? String(fullName).trim() : user.fullName;
  const cleanUsername = username !== undefined ? String(username).trim() : user.username;
  const cleanEmail = email !== undefined ? String(email).trim() : user.email || '';

  if (!cleanCode || !cleanName || !cleanUsername) {
    return res.status(400).json({ error: 'Mã định danh, Họ và tên, và Tên đăng nhập không được để trống.' });
  }

  // Check duplicate code in school
  const duplicateCode = db.users.find(
    (u) => u.schoolId === actor.schoolId && u.userId !== userId && u.code.toUpperCase() === cleanCode.toUpperCase()
  );
  if (duplicateCode) {
    return res.status(409).json({ error: `Mã ${cleanCode} đã được sử dụng bởi ${duplicateCode.fullName}.` });
  }

  // Check duplicate username globally
  const duplicateUsername = db.users.find(
    (u) => u.userId !== userId && u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (duplicateUsername) {
    return res.status(409).json({ error: `Tên đăng nhập ${cleanUsername} đã tồn tại.` });
  }

  // Check duplicate email if non-empty
  if (cleanEmail) {
    const duplicateEmail = db.users.find(
      (u) => u.userId !== userId && u.email?.toLowerCase() === cleanEmail.toLowerCase()
    );
    if (duplicateEmail) {
      return res.status(409).json({ error: `Email ${cleanEmail} đã tồn tại.` });
    }
  }

  const now = new Date().toISOString();
  user.code = cleanCode;
  user.fullName = cleanName;
  user.username = cleanUsername;
  user.email = cleanEmail || undefined;
  if (phone !== undefined) user.phone = String(phone).trim() || undefined;
  if (dob !== undefined) user.dob = String(dob).trim() || undefined;
  if (gender !== undefined) user.gender = String(gender).trim() || undefined;

  if (user.role === Role.TEACHER) {
    if (subjectCode !== undefined) {
      user.subjectCode = String(subjectCode).trim() || undefined;
    }
    if (actor.role === Role.ADMIN && className !== undefined) {
      const cleanClass = String(className).trim();
      const matchedClass = db.classes.find(
        (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === cleanClass.toUpperCase()
      );
      user.classId = matchedClass?.classId;
      user.className = matchedClass?.name || (cleanClass || undefined);
      user.assignedClassNames = user.className ? [user.className] : [];
      if (matchedClass) {
        matchedClass.teacherId = user.userId;
        matchedClass.teacherName = user.fullName;
      }
    }
    if (actor.role === Role.ADMIN) {
      if (status !== undefined) {
        user.status =
          status === 'INACTIVE'
            ? 'INACTIVE'
            : status === 'NEEDS_ASSIGNMENT_CHECK'
            ? 'NEEDS_ASSIGNMENT_CHECK'
            : 'ACTIVE';
      } else if (!user.subjectCode || !user.className) {
        user.status = 'NEEDS_ASSIGNMENT_CHECK';
      } else if (user.status === 'NEEDS_ASSIGNMENT_CHECK') {
        user.status = 'ACTIVE';
      }
    }

    // Sync teacherName across classes and overrides
    db.classes.forEach((c) => {
      if (c.schoolId === actor.schoolId && c.teacherId === user.userId) {
        c.teacherName = user.fullName;
      }
    });
    db.teacherOverrides.forEach((ovr) => {
      if (ovr.teacherId === user.userId) {
        ovr.teacherName = user.fullName;
      }
    });
  } else if (user.role === Role.STUDENT) {
    if (className !== undefined && String(className).trim()) {
      const cleanClass = String(className).trim();
      const matchedClass = db.classes.find(
        (c) => c.schoolId === actor.schoolId && c.name.toUpperCase() === cleanClass.toUpperCase()
      );
      if (!matchedClass) {
        return res.status(404).json({ error: `Lớp ${cleanClass} chưa tồn tại trong hệ thống.` });
      }
      if (actor.role === Role.TEACHER && !authorizeTeacherForClass(actor, matchedClass.classId, db)) {
        return res.status(403).json({
          code: 'TEACHER_SCOPE_VIOLATION',
          error: 'Giáo viên không được chuyển học sinh sang lớp ngoài phạm vi phụ trách.',
        });
      }
      user.classId = matchedClass.classId;
      user.className = matchedClass.name;
      user.grade = matchedClass.grade;

      // Update class_members record
      const existingMember = db.classMembers.find((cm) => cm.userId === user.userId);
      if (existingMember) {
        existingMember.classId = matchedClass.classId;
        existingMember.updatedAt = now;
      } else {
        db.classMembers.push({
          memberId: `cm_${user.userId}`,
          schoolId: actor.schoolId,
          classId: matchedClass.classId,
          userId: user.userId,
          memberRole: 'STUDENT',
          createdAt: now,
          updatedAt: now,
          createdBy: actor.userId,
        });
      }
    }
    if (status !== undefined) {
      user.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    // Also sync studentName in snapshots, paths, attempts, metrics
    db.competencySnapshots.forEach((s) => {
      if (s.studentId === user.userId) {
        s.studentName = user.fullName;
        if (user.classId) s.classId = user.classId;
      }
    });
    db.learningPaths.forEach((p) => {
      if (p.studentId === user.userId) {
        p.studentName = user.fullName;
        if (user.classId) p.classId = user.classId;
      }
    });
    db.experimentStudentMetrics.forEach((m) => {
      if (m.studentId === user.userId) {
        m.studentName = user.fullName;
        m.studentCode = user.code;
      }
    });
  }

  // Update credentials username and optional newPassword
  const cred = db.credentials.find((c) => c.userId === user.userId);
  if (cred) {
    cred.username = cleanUsername.toLowerCase();
    if (newPassword && String(newPassword).trim().length >= 4) {
      const { salt, hash } = hashPassword(String(newPassword).trim());
      cred.passwordSalt = salt;
      cred.passwordHash = hash;
    }
    cred.updatedAt = now;
  } else if (newPassword && String(newPassword).trim().length >= 4) {
    const { salt, hash } = hashPassword(String(newPassword).trim());
    db.credentials.push({
      userId: user.userId,
      username: cleanUsername.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: now,
    });
  }

  // Recompute class student counts
  for (const cls of db.classes.filter((c) => c.schoolId === actor.schoolId)) {
    cls.studentCount = db.users.filter(
      (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === cls.classId
    ).length;
  }

  user.updatedAt = now;
  recordAudit(
    'EDIT_USER',
    actor,
    `Chỉnh sửa thông tin ${user.role === Role.TEACHER ? 'giáo viên' : 'học sinh'} ${user.fullName} (${user.code}).`,
    user.userId
  );
  saveDatabase(db);

  return res.json({ user });
});

app.delete('/api/admin/users/:userId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Bạn không có quyền xóa tài khoản.' });
  }

  const { userId } = req.params;
  if (userId === actor.userId) {
    return res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập.' });
  }

  const db = getDatabase();
  const userIndex = db.users.findIndex((u) => u.userId === userId && u.schoolId === actor.schoolId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản cần xóa.' });
  }

  const targetUser = db.users[userIndex];
  if (targetUser.role === Role.ADMIN) {
    return res.status(403).json({ error: 'Không thể xóa tài khoản Quản trị viên hệ thống.' });
  }

  if (actor.role === Role.TEACHER) {
    if (targetUser.role !== Role.STUDENT) {
      return res.status(403).json({ error: 'Giáo viên chỉ được phép xóa học sinh trong lớp phụ trách.' });
    }
    if (!authorizeTeacherForStudent(actor, targetUser.userId, db)) {
      return res.status(403).json({
        code: 'TEACHER_SCOPE_VIOLATION',
        error: 'Học sinh không thuộc lớp bạn phụ trách.',
      });
    }
  }

  // Remove user and credentials
  db.users.splice(userIndex, 1);
  db.credentials = db.credentials.filter((c) => c.userId !== userId);
  db.classMembers = db.classMembers.filter((cm) => cm.userId !== userId);

  if (targetUser.role === Role.STUDENT) {
    db.competencySnapshots = db.competencySnapshots.filter((s) => s.studentId !== userId);
    db.learningPaths = db.learningPaths.filter((p) => p.studentId !== userId);
    db.detectedErrors = db.detectedErrors.filter((e) => e.studentId !== userId);
    db.attempts = db.attempts.filter((a) => a.studentId !== userId);
    db.responses = db.responses.filter((r) => r.studentId !== userId);
    db.progressHistory = db.progressHistory.filter((ph) => ph.studentId !== userId);
    db.experimentStudentMetrics = db.experimentStudentMetrics.filter((m) => m.studentId !== userId);
  }

  // Recompute class student counts
  for (const cls of db.classes.filter((c) => c.schoolId === actor.schoolId)) {
    cls.studentCount = db.users.filter(
      (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === cls.classId
    ).length;
  }

  recordAudit(
    'DELETE_USER',
    actor,
    `Đã xóa ${targetUser.role === Role.TEACHER ? 'giáo viên' : 'học sinh'} ${targetUser.fullName} (${targetUser.code}).`,
    targetUser.userId
  );
  saveDatabase(db);

  return res.json({ success: true, deletedUserId: userId });
});

app.put('/api/admin/schools/:schoolId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền chỉnh sửa thông tin trường học.' });
  }

  const { schoolId } = req.params;
  const { name, code, address, provinceCity, principalName, phone, email, status } = req.body || {};

  const db = getDatabase();
  const school = db.schools.find((s) => s.schoolId === schoolId && s.schoolId === actor.schoolId);
  if (!school) {
    return res.status(404).json({ error: 'Không tìm thấy thông tin trường học.' });
  }

  const cleanName = name !== undefined ? String(name).trim() : school.name;
  const cleanCode = code !== undefined ? String(code).trim() : school.code;

  if (!cleanName || !cleanCode) {
    return res.status(400).json({ error: 'Tên trường học và Mã trường không được để trống.' });
  }

  school.name = cleanName;
  school.code = cleanCode;
  if (address !== undefined) school.address = String(address).trim() || undefined;
  if (provinceCity !== undefined) school.provinceCity = String(provinceCity).trim() || undefined;
  if (principalName !== undefined) school.principalName = String(principalName).trim() || undefined;
  if (phone !== undefined) school.phone = String(phone).trim() || undefined;
  if (email !== undefined) school.email = String(email).trim() || undefined;
  if (status === 'ACTIVE' || status === 'INACTIVE') {
    school.status = status;
  }
  school.updatedAt = new Date().toISOString();

  recordAudit(
    'EDIT_SCHOOL',
    actor,
    `Cập nhật thông tin trường học "${school.name}" (${school.code}) — Địa chỉ: ${school.address || 'Chưa cập nhật'}.`,
    school.schoolId
  );
  saveDatabase(db);

  return res.json({ school });
});

app.post('/api/admin/academic-years', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) return res.status(403).json({ error: 'Forbidden' });
  const { name, isCurrent } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Vui lòng nhập tên năm học.' });

  const db = getDatabase();
  const now = new Date().toISOString();
  if (isCurrent) {
    db.academicYears.forEach((y) => {
      if (y.schoolId === actor.schoolId) y.isCurrent = false;
    });
  }
  const newYear = {
    academicYearId: `ay_${Date.now()}`,
    schoolId: actor.schoolId,
    name: String(name).trim(),
    isCurrent: Boolean(isCurrent),
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };
  db.academicYears.unshift(newYear);
  saveDatabase(db);
  return res.json({ academicYear: newYear });
});

app.put('/api/admin/academic-years/:academicYearId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) return res.status(403).json({ error: 'Forbidden' });
  const { academicYearId } = req.params;
  const { name, isCurrent, status } = req.body || {};

  const db = getDatabase();
  const ay = db.academicYears.find(
    (y) => y.academicYearId === academicYearId && y.schoolId === actor.schoolId
  );
  if (!ay) return res.status(404).json({ error: 'Không tìm thấy năm học.' });

  if (name !== undefined && String(name).trim()) {
    ay.name = String(name).trim();
  }
  if (isCurrent) {
    db.academicYears.forEach((y) => {
      if (y.schoolId === actor.schoolId) y.isCurrent = false;
    });
    ay.isCurrent = true;
  }
  if (status === 'ACTIVE' || status === 'ARCHIVED') {
    ay.status = status;
  }
  ay.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return res.json({ academicYear: ay });
});

app.put('/api/admin/classes/:classId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền chỉnh sửa lớp học.' });
  }

  const { classId } = req.params;
  const { name, grade, teacherId } = req.body || {};

  const db = getDatabase();
  const cls = db.classes.find((c) => c.classId === classId && c.schoolId === actor.schoolId);
  if (!cls) {
    return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
  }

  const cleanName = name !== undefined ? String(name).trim() : cls.name;
  if (!cleanName) {
    return res.status(400).json({ error: 'Tên lớp học không được để trống.' });
  }

  const dup = db.classes.find(
    (c) =>
      c.schoolId === actor.schoolId &&
      c.classId !== classId &&
      c.name.toUpperCase() === cleanName.toUpperCase()
  );
  if (dup) {
    return res.status(409).json({ error: `Lớp ${cleanName} đã tồn tại trong trường.` });
  }

  const oldName = cls.name;
  cls.name = cleanName;
  if (grade !== undefined && Number(grade) >= 1 && Number(grade) <= 12) {
    cls.grade = Number(grade);
  }
  if (teacherId !== undefined) {
    const teacher = db.users.find(
      (u) => u.userId === teacherId && u.schoolId === actor.schoolId && u.role === Role.TEACHER
    );
    if (teacher) {
      cls.teacherId = teacher.userId;
      cls.teacherName = teacher.fullName;
      const existingAssigned = new Set(teacher.assignedClassNames || []);
      existingAssigned.add(cls.name);
      teacher.assignedClassNames = Array.from(existingAssigned);
      teacher.className = cls.name;
      teacher.classId = cls.classId;
      if (teacher.subjectCode) teacher.status = 'ACTIVE';
    }
  }
  cls.updatedAt = new Date().toISOString();

  // Sync students belonging to this class
  db.users.forEach((u) => {
    if (
      u.schoolId === actor.schoolId &&
      u.role === Role.STUDENT &&
      (u.classId === cls.classId || u.className?.toUpperCase() === oldName.toUpperCase())
    ) {
      u.classId = cls.classId;
      u.className = cls.name;
      u.grade = cls.grade;
    }
  });

  cls.studentCount = db.users.filter(
    (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === cls.classId
  ).length;

  recordAudit(
    'MANAGE_CLASS',
    actor,
    `Cập nhật lớp ${cls.name} (Khối ${cls.grade}) — GV phụ trách: ${cls.teacherName}.`,
    cls.classId
  );
  saveDatabase(db);
  return res.json({ classRoom: cls });
});

app.delete('/api/admin/classes/:classId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa lớp học.' });
  }

  const { classId } = req.params;
  const db = getDatabase();
  const idx = db.classes.findIndex((c) => c.classId === classId && c.schoolId === actor.schoolId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy lớp học cần xóa.' });
  }

  const cls = db.classes[idx];
  const studentCount = db.users.filter(
    (u) => u.schoolId === actor.schoolId && u.role === Role.STUDENT && u.classId === cls.classId
  ).length;
  if (studentCount > 0) {
    return res.status(400).json({
      error: `Không thể xóa lớp ${cls.name} vì đang có ${studentCount} học sinh. Vui lòng chuyển hoặc xóa học sinh trước.`,
    });
  }

  db.classes.splice(idx, 1);
  db.classMembers = db.classMembers.filter((cm) => cm.classId !== classId);
  recordAudit('MANAGE_CLASS', actor, `Đã xóa lớp học ${cls.name} (Khối ${cls.grade}).`, classId);
  saveDatabase(db);
  return res.json({ success: true, deletedClassId: classId });
});

// ============================================================================
// 3B. SUBJECTS & TOPICS MANAGEMENT (MÔN HỌC & CHỦ ĐỀ THEO KHỐI)
// ============================================================================
app.post('/api/admin/subjects', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Giáo viên mới có quyền thêm môn học.' });
  }

  const { code, name, grade, description } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();
  const numGrade = Number(grade) || 8;

  if (!cleanCode || !cleanName) {
    return res.status(400).json({ error: 'Mã môn học và Tên môn học không được để trống.' });
  }

  const db = getDatabase();
  const dup = db.subjects.find(
    (s) => s.schoolId === actor.schoolId && s.code.toUpperCase() === cleanCode
  );
  if (dup) {
    return res.status(409).json({ error: `Mã môn học ${cleanCode} đã tồn tại (${dup.name}).` });
  }

  const now = new Date().toISOString();
  const newSubject = {
    subjectId: `subj_${cleanCode.toLowerCase()}_${Date.now()}`,
    schoolId: actor.schoolId,
    code: cleanCode,
    name: cleanName,
    grade: numGrade,
    description: description ? String(description).trim() : undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  db.subjects.push(newSubject);
  recordAudit(
    'MANAGE_CURRICULUM',
    actor,
    `Thêm môn học mới: ${newSubject.name} (${newSubject.code}) — Khối ${newSubject.grade}.`,
    newSubject.subjectId
  );
  saveDatabase(db);
  return res.json({ subject: newSubject });
});

app.put('/api/admin/subjects/:subjectId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa môn học.' });
  }

  const { subjectId } = req.params;
  const { code, name, grade, description } = req.body || {};

  const db = getDatabase();
  const subj = db.subjects.find((s) => s.subjectId === subjectId && s.schoolId === actor.schoolId);
  if (!subj) {
    return res.status(404).json({ error: 'Không tìm thấy môn học.' });
  }

  const cleanCode = code !== undefined ? String(code).trim().toUpperCase() : subj.code;
  const cleanName = name !== undefined ? String(name).trim() : subj.name;
  if (!cleanCode || !cleanName) {
    return res.status(400).json({ error: 'Mã môn học và Tên môn học không được để trống.' });
  }

  const oldCode = subj.code;
  subj.code = cleanCode;
  subj.name = cleanName;
  if (grade !== undefined && Number(grade) >= 1 && Number(grade) <= 12) {
    subj.grade = Number(grade);
  }
  if (description !== undefined) {
    subj.description = String(description).trim() || undefined;
  }
  subj.updatedAt = new Date().toISOString();

  // Sync topics that referenced the old subjectCode
  if (oldCode !== cleanCode) {
    db.topics.forEach((t) => {
      if (t.schoolId === actor.schoolId && t.subjectCode === oldCode) {
        t.subjectCode = cleanCode;
      }
    });
  }

  recordAudit(
    'MANAGE_CURRICULUM',
    actor,
    `Cập nhật môn học: ${subj.name} (${subj.code}) — Khối ${subj.grade}.`,
    subj.subjectId
  );
  saveDatabase(db);
  return res.json({ subject: subj });
});

app.delete('/api/admin/subjects/:subjectId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa môn học.' });
  }

  const { subjectId } = req.params;
  const db = getDatabase();
  const idx = db.subjects.findIndex((s) => s.subjectId === subjectId && s.schoolId === actor.schoolId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy môn học.' });
  }

  const subj = db.subjects[idx];
  db.subjects.splice(idx, 1);
  recordAudit('MANAGE_CURRICULUM', actor, `Xóa môn học ${subj.name} (${subj.code}).`, subjectId);
  saveDatabase(db);
  return res.json({ success: true, deletedSubjectId: subjectId });
});

app.post('/api/admin/topics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Giáo viên mới có quyền thêm chủ đề môn học.' });
  }

  const { code, name, subjectCode, grade, description, knowledgeSummary } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();
  const cleanSubjectCode = String(subjectCode || 'TOAN_8').trim();
  const numGrade = Number(grade) || 8;

  if (!cleanCode || !cleanName) {
    return res.status(400).json({ error: 'Mã chủ đề và Tên chủ đề môn học không được để trống.' });
  }

  const db = getDatabase();
  const dup = db.topics.find(
    (t) => t.schoolId === actor.schoolId && t.code.toUpperCase() === cleanCode
  );
  if (dup) {
    return res.status(409).json({ error: `Mã chủ đề ${cleanCode} đã tồn tại (${dup.name}).` });
  }

  const now = new Date().toISOString();
  const newTopic = {
    topicId: `topic_${cleanCode.toLowerCase()}_${Date.now()}`,
    schoolId: actor.schoolId,
    code: cleanCode,
    name: cleanName,
    subjectCode: cleanSubjectCode,
    grade: numGrade,
    description: description ? String(description).trim() : undefined,
    knowledgeSummary: knowledgeSummary ? String(knowledgeSummary).trim() : undefined,
    knowledgeItems: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  db.topics.push(newTopic);
  recordAudit(
    'MANAGE_CURRICULUM',
    actor,
    `Thêm chủ đề môn học: ${newTopic.name} (${newTopic.code}) — Môn ${newTopic.subjectCode} (Khối ${newTopic.grade}).`,
    newTopic.topicId
  );
  saveDatabase(db);
  return res.json({ topic: newTopic });
});

app.put('/api/admin/topics/:topicId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa chủ đề môn học.' });
  }

  const { topicId } = req.params;
  const { code, name, subjectCode, grade, description, knowledgeSummary } = req.body || {};

  const db = getDatabase();
  const topic = db.topics.find((t) => t.topicId === topicId && t.schoolId === actor.schoolId);
  if (!topic) {
    return res.status(404).json({ error: 'Không tìm thấy chủ đề môn học.' });
  }

  const cleanCode = code !== undefined ? String(code).trim().toUpperCase() : topic.code;
  const cleanName = name !== undefined ? String(name).trim() : topic.name;
  if (!cleanCode || !cleanName) {
    return res.status(400).json({ error: 'Mã chủ đề và Tên chủ đề không được để trống.' });
  }

  topic.code = cleanCode;
  topic.name = cleanName;
  if (subjectCode !== undefined && String(subjectCode).trim()) {
    topic.subjectCode = String(subjectCode).trim();
  }
  if (grade !== undefined && Number(grade) >= 1 && Number(grade) <= 12) {
    topic.grade = Number(grade);
  }
  if (description !== undefined) {
    topic.description = String(description).trim() || undefined;
  }
  if (knowledgeSummary !== undefined) {
    topic.knowledgeSummary = String(knowledgeSummary).trim() || undefined;
  }
  topic.updatedAt = new Date().toISOString();

  recordAudit(
    'MANAGE_CURRICULUM',
    actor,
    `Cập nhật chủ đề môn học: ${topic.name} (${topic.code}) — Môn ${topic.subjectCode} (Khối ${topic.grade}).`,
    topic.topicId
  );
  saveDatabase(db);
  return res.json({ topic });
});

app.delete('/api/admin/topics/:topicId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa chủ đề môn học.' });
  }

  const { topicId } = req.params;
  const db = getDatabase();
  const idx = db.topics.findIndex((t) => t.topicId === topicId && t.schoolId === actor.schoolId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy chủ đề môn học.' });
  }

  const topic = db.topics[idx];
  db.topics.splice(idx, 1);
  recordAudit('MANAGE_CURRICULUM', actor, `Xóa chủ đề môn học ${topic.name} (${topic.code}).`, topicId);
  saveDatabase(db);
  return res.json({ success: true, deletedTopicId: topicId });
});

app.post('/api/admin/topics/:topicId/knowledge', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên hoặc Giáo viên mới có quyền tải lên kiến thức chủ đề.' });
  }

  const { topicId } = req.params;
  const { title, knowledgeType, contentText, fileName, fileSize, mimeType, fileDataUrl } = req.body || {};

  const cleanTitle = String(title || '').trim();
  const cleanContent = String(contentText || '').trim();

  if (!cleanTitle || (!cleanContent && !fileDataUrl)) {
    return res.status(400).json({ error: 'Vui lòng nhập tiêu đề kiến thức và nội dung hoặc tải lên file tài liệu.' });
  }

  const db = getDatabase();
  const topic = db.topics.find((t) => t.topicId === topicId && t.schoolId === actor.schoolId);
  if (!topic) {
    return res.status(404).json({ error: 'Không tìm thấy chủ đề môn học.' });
  }

  const validTypes = ['CORE_THEORY', 'FORMULA_RULES', 'SOLVED_EXAMPLES', 'FILE_DOCUMENT'] as const;
  const kType = validTypes.includes(knowledgeType) ? knowledgeType : 'CORE_THEORY';

  const now = new Date().toISOString();
  const newItem = {
    knowledgeId: `know_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    knowledgeType: kType,
    contentText: cleanContent || (fileName ? `Tài liệu đính kèm: ${fileName}` : ''),
    fileName: fileName ? String(fileName).trim() : undefined,
    fileSize: fileSize ? Number(fileSize) : undefined,
    mimeType: mimeType ? String(mimeType) : undefined,
    fileDataUrl: fileDataUrl ? String(fileDataUrl) : undefined,
    uploadedBy: actor.userId,
    uploadedByName: actor.fullName,
    createdAt: now,
  };

  if (!Array.isArray(topic.knowledgeItems)) {
    topic.knowledgeItems = [];
  }
  topic.knowledgeItems.push(newItem);
  topic.updatedAt = now;

  recordAudit(
    'MANAGE_CURRICULUM',
    actor,
    `Tải lên kiến thức "${newItem.title}" cho chủ đề ${topic.name} (${topic.code}).`,
    topic.topicId
  );
  saveDatabase(db);
  return res.json({ topic, knowledgeItem: newItem });
});

app.put(
  '/api/admin/topics/:topicId/knowledge/:knowledgeId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const actor = req.actor!;
    if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa kiến thức chủ đề.' });
    }

    const { topicId, knowledgeId } = req.params;
    const { title, knowledgeType, contentText, fileName, fileSize, mimeType, fileDataUrl } = req.body || {};

    const db = getDatabase();
    const topic = db.topics.find((t) => t.topicId === topicId && t.schoolId === actor.schoolId);
    if (!topic || !Array.isArray(topic.knowledgeItems)) {
      return res.status(404).json({ error: 'Không tìm thấy chủ đề môn học.' });
    }

    const item = topic.knowledgeItems.find((k) => k.knowledgeId === knowledgeId);
    if (!item) {
      return res.status(404).json({ error: 'Không tìm thấy đơn vị kiến thức.' });
    }

    if (title !== undefined && String(title).trim()) item.title = String(title).trim();
    const validTypes = ['CORE_THEORY', 'FORMULA_RULES', 'SOLVED_EXAMPLES', 'FILE_DOCUMENT'] as const;
    if (knowledgeType && validTypes.includes(knowledgeType)) {
      item.knowledgeType = knowledgeType;
    }
    if (contentText !== undefined) item.contentText = String(contentText).trim();
    if (fileName !== undefined) item.fileName = fileName ? String(fileName).trim() : undefined;
    if (fileSize !== undefined) item.fileSize = fileSize ? Number(fileSize) : undefined;
    if (mimeType !== undefined) item.mimeType = mimeType ? String(mimeType) : undefined;
    if (fileDataUrl !== undefined) item.fileDataUrl = fileDataUrl ? String(fileDataUrl) : undefined;

    topic.updatedAt = new Date().toISOString();
    recordAudit(
      'MANAGE_CURRICULUM',
      actor,
      `Cập nhật kiến thức "${item.title}" trong chủ đề ${topic.name}.`,
      topic.topicId
    );
    saveDatabase(db);
    return res.json({ topic, knowledgeItem: item });
  }
);

app.delete(
  '/api/admin/topics/:topicId/knowledge/:knowledgeId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const actor = req.actor!;
    if (actor.role !== Role.ADMIN && actor.role !== Role.TEACHER) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa kiến thức chủ đề.' });
    }

    const { topicId, knowledgeId } = req.params;
    const db = getDatabase();
    const topic = db.topics.find((t) => t.topicId === topicId && t.schoolId === actor.schoolId);
    if (!topic || !Array.isArray(topic.knowledgeItems)) {
      return res.status(404).json({ error: 'Không tìm thấy chủ đề môn học.' });
    }

    const idx = topic.knowledgeItems.findIndex((k) => k.knowledgeId === knowledgeId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đơn vị kiến thức cần xóa.' });
    }

    const removed = topic.knowledgeItems[idx];
    topic.knowledgeItems.splice(idx, 1);
    topic.updatedAt = new Date().toISOString();

    recordAudit(
      'MANAGE_CURRICULUM',
      actor,
      `Đã xóa đơn vị kiến thức "${removed.title}" khỏi chủ đề ${topic.name}.`,
      topic.topicId
    );
    saveDatabase(db);
    return res.json({ success: true, topic });
  }
);

// ============================================================================
// 4. QUESTIONS, AI QUESTION GENERATOR & ASSESSMENTS (SECTIONS 34-38, 81)
// ============================================================================
app.post('/api/questions/ai-generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên hoặc Quản trị viên mới được tạo câu hỏi AI.' });
  }

  const { competency, difficulty, targetError, primaryUse, count } = req.body || {};
  const db = getDatabase();

  const result = await generateQuestionsWithGemini({
    schoolId: actor.schoolId,
    actorId: actor.userId,
    grade: 8,
    subject: 'Toán 8',
    topic: 'FACTORING_POLYNOMIAL',
    competency: (competency as CompetencyCode) || CompetencyCode.TRANSFORMATION,
    difficulty: (Number(difficulty) || 3) as 1 | 2 | 3 | 4 | 5,
    targetError: (targetError as ErrorTagCode) || ErrorTagCode.SIGN_ERROR,
    primaryUse: (primaryUse as PrimaryUse) || PrimaryUse.PRACTICE,
    count: Math.min(5, Math.max(1, Number(count) || 2)),
    onLog: (log) => db.aiRuns.unshift(log),
  });

  db.questions.unshift(...result.questions);
  saveDatabase(db);

  return res.json(result);
});

app.put('/api/questions/:questionId/approve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Không có quyền duyệt câu hỏi.' });
  }

  const { questionId } = req.params;
  const { action, questionText, correctAnswer, solution } = req.body || {}; // action: 'APPROVE' | 'MODIFY' | 'REJECT'
  const db = getDatabase();
  const qIdx = db.questions.findIndex((q) => q.questionId === questionId && q.schoolId === actor.schoolId);
  if (qIdx === -1) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });

  const q = db.questions[qIdx];
  const now = new Date().toISOString();

  if (action === 'REJECT') {
    db.questions.splice(qIdx, 1);
  } else {
    if (questionText) q.questionText = String(questionText);
    if (correctAnswer) q.correctAnswer = String(correctAnswer);
    if (solution) q.solution = String(solution);
    q.teacherApproved = true;
    q.updatedAt = now;
  }

  db.teacherOverrides.unshift({
    overrideId: `ovr_${Date.now()}`,
    schoolId: actor.schoolId,
    teacherId: actor.userId,
    teacherName: actor.fullName,
    targetType: 'AI_QUESTION',
    targetId: questionId,
    action: action === 'REJECT' ? 'REJECT' : action === 'MODIFY' ? 'MODIFY' : 'APPROVE',
    reason: `Giáo viên ${action === 'REJECT' ? 'từ chối' : 'duyệt'} câu hỏi AI (${questionId}).`,
    createdAt: now,
    updatedAt: now,
  });

  saveDatabase(db);
  return res.json({ success: true, question: action === 'REJECT' ? null : q });
});

app.post('/api/questions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Không có quyền thêm câu hỏi.' });
  }

  const {
    competency,
    difficulty,
    errorTags,
    questionType,
    questionText,
    options,
    correctAnswer,
    solution,
    primaryUse,
    hint1,
    hint2,
    hint3,
  } = req.body || {};

  if (!questionText || !correctAnswer || !solution) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Nội dung câu hỏi, Đáp án đúng và Lời giải kiểm chứng.' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const newQ: Question = {
    questionId: `Q_MAN_${Date.now()}`,
    schoolId: actor.schoolId,
    grade: 8,
    subject: 'Toán 8',
    topic: 'FACTORING_POLYNOMIAL',
    competency: (competency as CompetencyCode) || CompetencyCode.TRANSFORMATION,
    difficulty: (Number(difficulty) || 2) as 1 | 2 | 3 | 4 | 5,
    errorTags: Array.isArray(errorTags) && errorTags.length > 0 ? errorTags : [ErrorTagCode.SIGN_ERROR],
    questionType: (questionType as QuestionType) || QuestionType.MULTIPLE_CHOICE,
    questionText: String(questionText),
    options: Array.isArray(options) ? options.map(String) : undefined,
    correctAnswer: String(correctAnswer),
    solution: String(solution),
    hints: {
      level1: String(hint1 || 'Nhớ lại phương pháp đặt nhân tử chung và hằng đẳng thức.'),
      level2: String(hint2 || 'Kiểm tra dấu của từng hạng tử trong ngoặc.'),
      level3: String(hint3 || 'Thực hiện nhóm hạng tử và rút gọn nhân tử chung.'),
    },
    primaryUse: (primaryUse as PrimaryUse) || PrimaryUse.PRACTICE,
    allowedUses: [(primaryUse as PrimaryUse) || PrimaryUse.PRACTICE],
    source: `Giáo viên ${actor.fullName}`,
    aiGenerated: false,
    teacherApproved: true,
    estimatedSeconds: 75,
    points: 10,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  db.questions.unshift(newQ);
  saveDatabase(db);
  return res.json({ question: newQ });
});

app.post('/api/assessments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền tạo Bài đánh giá.' });
  }

  const { title, assessmentType, classId, competencies, questionIds, durationMinutes } = req.body || {};
  if (!title || !Array.isArray(questionIds) || questionIds.length === 0) {
    return res.status(400).json({ error: 'Vui lòng nhập tên bài đánh giá và chọn ít nhất 1 câu hỏi.' });
  }

  const db = getDatabase();
  const targetClassId = classId || actor.classId || 'class_8a2';
  if (actor.role === Role.TEACHER && !authorizeTeacherForClass(actor, targetClassId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn chỉ được phép tạo bài đánh giá cho lớp mình phụ trách.',
    });
  }

  const selectedQuestions = db.questions.filter(
    (q) => q.schoolId === actor.schoolId && questionIds.includes(q.questionId)
  );
  if (selectedQuestions.some((q) => q.aiGenerated && !q.teacherApproved)) {
    return res.status(400).json({
      error: 'Bài đánh giá có chứa câu hỏi AI chưa được Giáo viên duyệt. Vui lòng duyệt câu hỏi trước khi xuất bản.',
    });
  }

  const now = new Date().toISOString();
  const newAssessment = {
    assessmentId: `assess_${Date.now()}`,
    schoolId: actor.schoolId,
    title: String(title).trim(),
    assessmentType: (assessmentType as PrimaryUse) || PrimaryUse.DIAGNOSTIC,
    classId: targetClassId,
    topicCode: 'FACTORING_POLYNOMIAL',
    competencies: Array.isArray(competencies) ? competencies : Object.values(CompetencyCode),
    questionIds,
    durationMinutes: Number(durationMinutes) || 20,
    totalPoints: selectedQuestions.reduce((s, q) => s + q.points, 0),
    status: 'PUBLISHED' as const,
    dataSource: 'REAL' as const,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  db.assessments.unshift(newAssessment);
  recordAudit(
    'ASSESSMENT_PUBLISH',
    actor,
    `Xuất bản bài đánh giá "${newAssessment.title}" (${questionIds.length} câu hỏi).`,
    newAssessment.assessmentId
  );
  saveDatabase(db);

  return res.json({ assessment: newAssessment });
});

// ============================================================================
// 5. STUDENT DIAGNOSTIC / PRE / POST ATTEMPTS & AUTOSAVE (SECTIONS 39-46)
// ============================================================================
app.post('/api/attempts/save-progress', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { assessmentId, currentQuestionIndex, flaggedQuestionIds, answers } = req.body || {};
  const db = getDatabase();
  const assessment = db.assessments.find((a) => a.assessmentId === assessmentId && a.schoolId === actor.schoolId);
  if (!assessment) return res.status(404).json({ error: 'Không tìm thấy bài đánh giá.' });

  if (actor.role === Role.STUDENT && actor.classId && assessment.classId && assessment.classId !== actor.classId) {
    return res.status(403).json({ error: 'Bài đánh giá không thuộc lớp của bạn.' });
  }

  // FIX 01: Enforce Experiment state machine for Pre-test / Post-test
  const expAccess = checkExperimentAssessmentAccess(db, assessment);
  if (!expAccess.allowed) {
    return res.status(expAccess.statusCode).json({
      code: expAccess.code,
      error: expAccess.error,
    });
  }

  const activeExpId = expAccess.experiment?.experimentId;
  if (
    (assessment.assessmentType === PrimaryUse.PRE_TEST ||
      assessment.assessmentType === PrimaryUse.POST_TEST) &&
    db.attempts.some(
      (a) =>
        a.assessmentId === assessmentId &&
        a.studentId === actor.userId &&
        a.status === 'SUBMITTED' &&
        a.dataSource === 'REAL' &&
        (!activeExpId || !a.experimentId || a.experimentId === activeExpId)
    )
  ) {
    return res.status(403).json({
      code:
        assessment.assessmentType === PrimaryUse.PRE_TEST
          ? 'PRETEST_ALREADY_SUBMITTED'
          : 'POSTTEST_ALREADY_SUBMITTED',
      error: 'Bạn đã hoàn thành và nộp bài đánh giá thực nghiệm này.',
    });
  }

  const now = new Date().toISOString();
  let attempt = db.attempts.find(
    (a) =>
      a.assessmentId === assessmentId &&
      a.studentId === actor.userId &&
      a.status === 'IN_PROGRESS' &&
      (!activeExpId || !a.experimentId || a.experimentId === activeExpId)
  );

  if (!attempt) {
    attempt = {
      attemptId: `att_${assessmentId}_${actor.userId}_${Date.now()}`,
      schoolId: actor.schoolId,
      experimentId: activeExpId,
      assessmentId,
      assessmentType: assessment.assessmentType,
      studentId: actor.userId,
      studentName: actor.fullName,
      classId: actor.classId || assessment.classId,
      status: 'IN_PROGRESS',
      currentQuestionIndex: Number(currentQuestionIndex) || 0,
      flaggedQuestionIds: Array.isArray(flaggedQuestionIds) ? flaggedQuestionIds : [],
      answers: answers || {},
      startedAt: now,
      dataSource: 'REAL',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };
    db.attempts.push(attempt);
  } else {
    if (activeExpId) attempt.experimentId = activeExpId;
    attempt.currentQuestionIndex = Number(currentQuestionIndex) ?? attempt.currentQuestionIndex;
    attempt.flaggedQuestionIds = Array.isArray(flaggedQuestionIds) ? flaggedQuestionIds : attempt.flaggedQuestionIds;
    attempt.answers = { ...attempt.answers, ...(answers || {}) };
    attempt.updatedAt = now;
  }

  if (expAccess.experiment) {
    syncExperimentMetricsFromAttempts(db, expAccess.experiment.experimentId);
  }

  saveDatabase(db);
  return res.json({ attempt });
});

app.post('/api/attempts/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { assessmentId, answers } = req.body || {};
  const db = getDatabase();
  const assessment = db.assessments.find((a) => a.assessmentId === assessmentId && a.schoolId === actor.schoolId);
  if (!assessment) return res.status(404).json({ error: 'Không tìm thấy bài đánh giá.' });

  if (actor.role === Role.STUDENT && actor.classId && assessment.classId && assessment.classId !== actor.classId) {
    return res.status(403).json({ error: 'Bài đánh giá không thuộc lớp của bạn.' });
  }

  // FIX 01: Enforce Experiment state machine for Pre-test / Post-test
  const expAccess = checkExperimentAssessmentAccess(db, assessment);
  if (!expAccess.allowed) {
    return res.status(expAccess.statusCode).json({
      code: expAccess.code,
      error: expAccess.error,
    });
  }

  const activeExpId = expAccess.experiment?.experimentId;
  if (
    (assessment.assessmentType === PrimaryUse.PRE_TEST ||
      assessment.assessmentType === PrimaryUse.POST_TEST) &&
    db.attempts.some(
      (a) =>
        a.assessmentId === assessmentId &&
        a.studentId === actor.userId &&
        a.status === 'SUBMITTED' &&
        a.dataSource === 'REAL' &&
        (!activeExpId || !a.experimentId || a.experimentId === activeExpId)
    )
  ) {
    return res.status(403).json({
      code:
        assessment.assessmentType === PrimaryUse.PRE_TEST
          ? 'PRETEST_ALREADY_SUBMITTED'
          : 'POSTTEST_ALREADY_SUBMITTED',
      error: 'Bạn đã hoàn thành và nộp bài đánh giá thực nghiệm này.',
    });
  }

  const questions = db.questions.filter((q) => assessment.questionIds.includes(q.questionId));
  const now = new Date().toISOString();

  let attempt = db.attempts.find(
    (a) =>
      a.assessmentId === assessmentId &&
      a.studentId === actor.userId &&
      a.status === 'IN_PROGRESS' &&
      (!activeExpId || !a.experimentId || a.experimentId === activeExpId)
  );
  if (!attempt) {
    attempt = {
      attemptId: `att_${assessmentId}_${actor.userId}_${Date.now()}`,
      schoolId: actor.schoolId,
      experimentId: activeExpId,
      assessmentId,
      assessmentType: assessment.assessmentType,
      studentId: actor.userId,
      studentName: actor.fullName,
      classId: actor.classId || assessment.classId,
      status: 'IN_PROGRESS',
      currentQuestionIndex: 0,
      flaggedQuestionIds: [],
      answers: answers || {},
      startedAt: now,
      dataSource: 'REAL',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };
    db.attempts.push(attempt);
  } else {
    if (activeExpId) attempt.experimentId = activeExpId;
    if (answers) {
      attempt.answers = { ...attempt.answers, ...answers };
    }
  }

  // Grade per question & per competency
  let earnedPoints = 0;
  let totalPoints = 0;
  const compEarned: Record<CompetencyCode, number> = {
    [CompetencyCode.FOUNDATION]: 0,
    [CompetencyCode.RECOGNITION]: 0,
    [CompetencyCode.TRANSFORMATION]: 0,
    [CompetencyCode.CALC_ACCURACY]: 0,
    [CompetencyCode.APPLICATION]: 0,
  };
  const compPossible: Record<CompetencyCode, number> = {
    [CompetencyCode.FOUNDATION]: 0,
    [CompetencyCode.RECOGNITION]: 0,
    [CompetencyCode.TRANSFORMATION]: 0,
    [CompetencyCode.CALC_ACCURACY]: 0,
    [CompetencyCode.APPLICATION]: 0,
  };
  const errorCounts: Partial<Record<ErrorTagCode, number>> = {};
  const recentErrorTags: (ErrorTagCode | null)[] = [];

  for (const q of questions) {
    const rawAns = String(attempt.answers[q.questionId] || '').trim();
    const isCorrect = rawAns.toLowerCase() === q.correctAnswer.trim().toLowerCase();
    totalPoints += q.points;
    compPossible[q.competency] += q.points;

    let detectedTag: ErrorTagCode | undefined;
    if (isCorrect) {
      earnedPoints += q.points;
      compEarned[q.competency] += q.points;
      recentErrorTags.push(null);
    } else {
      detectedTag = q.errorTags[0] || ErrorTagCode.SIGN_ERROR;
      errorCounts[detectedTag] = (errorCounts[detectedTag] || 0) + 1;
      recentErrorTags.push(detectedTag);
    }

    db.responses.push({
      responseId: `resp_${attempt.attemptId}_${q.questionId}`,
      schoolId: actor.schoolId,
      attemptId: attempt.attemptId,
      assessmentId,
      studentId: actor.userId,
      questionId: q.questionId,
      competency: q.competency,
      difficulty: q.difficulty,
      studentAnswer: rawAns,
      isCorrect,
      hintsUsed: 0,
      detectedErrorTag: detectedTag,
      timeSpentSeconds: q.estimatedSeconds,
      dataSource: 'REAL',
      createdAt: now,
      updatedAt: now,
    });
  }

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const existingSnapshot = db.competencySnapshots.find((s) => s.studentId === actor.userId);

  const competencyBreakdown: Record<CompetencyCode, number> = {
    [CompetencyCode.FOUNDATION]:
      compPossible.FOUNDATION > 0
        ? Math.round((compEarned.FOUNDATION / compPossible.FOUNDATION) * 100)
        : existingSnapshot?.competencies.FOUNDATION.score ?? 75,
    [CompetencyCode.RECOGNITION]:
      compPossible.RECOGNITION > 0
        ? Math.round((compEarned.RECOGNITION / compPossible.RECOGNITION) * 100)
        : existingSnapshot?.competencies.RECOGNITION.score ?? 80,
    [CompetencyCode.TRANSFORMATION]:
      compPossible.TRANSFORMATION > 0
        ? Math.round((compEarned.TRANSFORMATION / compPossible.TRANSFORMATION) * 100)
        : existingSnapshot?.competencies.TRANSFORMATION.score ?? 63,
    [CompetencyCode.CALC_ACCURACY]:
      compPossible.CALC_ACCURACY > 0
        ? Math.round((compEarned.CALC_ACCURACY / compPossible.CALC_ACCURACY) * 100)
        : existingSnapshot?.competencies.CALC_ACCURACY.score ?? 58,
    [CompetencyCode.APPLICATION]:
      compPossible.APPLICATION > 0
        ? Math.round((compEarned.APPLICATION / compPossible.APPLICATION) * 100)
        : existingSnapshot?.competencies.APPLICATION.score ?? 42,
  };

  attempt.status = 'SUBMITTED';
  attempt.scorePercent = scorePercent;
  attempt.totalPointsEarned = earnedPoints;
  attempt.totalPointsPossible = totalPoints;
  attempt.competencyBreakdown = competencyBreakdown;
  attempt.detectedErrorCounts = errorCounts;
  attempt.submittedAt = now;
  attempt.updatedAt = now;

  // P1 & P2: Update Competency Snapshot & Detected Errors
  const allStudentResponses = db.responses.filter((r) => r.studentId === actor.userId);
  const { countsInWindow, recurringErrors } = detectRecurringErrors(
    allStudentResponses.map((r) => r.detectedErrorTag),
    10,
    3
  );

  // Update detectedErrors records for student
  for (const tag of Object.keys(countsInWindow) as ErrorTagCode[]) {
    const cnt = countsInWindow[tag];
    if (cnt > 0) {
      const existingErr = db.detectedErrors.find(
        (e) => e.studentId === actor.userId && e.errorTag === tag
      );
      if (existingErr) {
        existingErr.occurrencesInLast10 = cnt;
        existingErr.totalOccurrences += 1;
        existingErr.isRecurring = cnt >= 3;
        existingErr.lastDetectedAt = now;
        existingErr.updatedAt = now;
      } else {
        db.detectedErrors.push({
          errorId: `derr_${tag}_${actor.userId}_${Date.now()}`,
          schoolId: actor.schoolId,
          studentId: actor.userId,
          errorTag: tag,
          errorName: getErrorNameVi(tag),
          occurrencesInLast10: cnt,
          totalOccurrences: cnt,
          isRecurring: cnt >= 3,
          status: cnt >= 3 ? 'ACTIVE' : 'IMPROVING',
          lastDetectedAt: now,
          dataSource: 'REAL',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // P3: Build Rule Engine Learning Path + Explain with Gemini
  const blueprint = buildRuleBasedLearningPathBlueprint(competencyBreakdown, recurringErrors);
  const recurringWithCounts = recurringErrors.map((tag) => ({
    errorTag: tag,
    count: countsInWindow[tag] || 3,
  }));

  const aiExplanation = await explainLearningPathWithGemini({
    schoolId: actor.schoolId,
    actorId: actor.userId,
    pseudonymId: actor.pseudonymId,
    competencyScores: competencyBreakdown,
    recurringErrors: recurringWithCounts,
    stepTitles: blueprint.steps.map((s) => s.title),
    onLog: (log) => db.aiRuns.unshift(log),
  });

  // Update Snapshot
  const confInfo = calculateConfidence(questions.length, 3, 0.88);
  const overallMastery = Math.round(
    Object.values(competencyBreakdown).reduce((a, b) => a + b, 0) / 5
  );

  const buildCompMastery = (c: CompetencyCode) => {
    const sc = calculateMasteryScore({
      accuracy: competencyBreakdown[c],
      independence: 85,
      stability: competencyBreakdown[c],
    });
    const lvl = getMasteryLevelInfo(sc);
    return {
      competency: c,
      name: getCompetencyNameVi(c),
      score: sc,
      initialScore: existingSnapshot?.competencies[c]?.initialScore ?? sc,
      confidence: confInfo.confidence,
      confidenceStatus: confInfo.status,
      level: lvl.level,
      levelLabelVi: lvl.labelVi,
      signals: {
        accuracy: competencyBreakdown[c],
        independence: 85,
        stability: competencyBreakdown[c],
      },
    };
  };

  const newSnapshot = {
    snapshotId: existingSnapshot?.snapshotId || `snap_${actor.userId}`,
    schoolId: actor.schoolId,
    studentId: actor.userId,
    studentName: actor.fullName,
    classId: actor.classId || 'class_8a2',
    sourceType:
      assessment.assessmentType === PrimaryUse.PRE_TEST
        ? ('PRE_TEST' as const)
        : assessment.assessmentType === PrimaryUse.POST_TEST
        ? ('POST_TEST' as const)
        : ('DIAGNOSTIC' as const),
    overallMastery,
    overallConfidence: confInfo.confidence,
    competencies: {
      [CompetencyCode.FOUNDATION]: buildCompMastery(CompetencyCode.FOUNDATION),
      [CompetencyCode.RECOGNITION]: buildCompMastery(CompetencyCode.RECOGNITION),
      [CompetencyCode.TRANSFORMATION]: buildCompMastery(CompetencyCode.TRANSFORMATION),
      [CompetencyCode.CALC_ACCURACY]: buildCompMastery(CompetencyCode.CALC_ACCURACY),
      [CompetencyCode.APPLICATION]: buildCompMastery(CompetencyCode.APPLICATION),
    },
    recurringErrors,
    aiInsightStudent: aiExplanation.studentMessage,
    aiInsightTeacher: aiExplanation.teacherReason,
    suggestedGroup:
      overallMastery < 50
        ? ('GROUP_A_FOUNDATION' as const)
        : competencyBreakdown.TRANSFORMATION < 70
        ? ('GROUP_B_TRANSFORMATION' as const)
        : competencyBreakdown.APPLICATION < 75
        ? ('GROUP_C_APPLICATION' as const)
        : ('GROUP_D_ADVANCED' as const),
    dataSource: 'REAL' as const,
    createdAt: existingSnapshot?.createdAt || now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  const snapIdx = db.competencySnapshots.findIndex((s) => s.studentId === actor.userId);
  if (snapIdx >= 0) {
    db.competencySnapshots[snapIdx] = newSnapshot;
  } else {
    db.competencySnapshots.push(newSnapshot);
  }

  // Create or update LearningPath if Diagnostic or Pre-test
  let generatedPath = db.learningPaths.find((p) => p.studentId === actor.userId);
  if (assessment.assessmentType !== PrimaryUse.POST_TEST) {
    const pathId = generatedPath?.pathId || `path_${actor.userId}_${Date.now()}`;
    const practicePool = db.questions.filter((q) => q.primaryUse === PrimaryUse.PRACTICE);
    const errPool = db.questions.filter((q) => q.primaryUse === PrimaryUse.ERROR_CORRECTION);
    const chkPool = db.questions.filter((q) => q.primaryUse === PrimaryUse.CHECKPOINT);

    generatedPath = {
      pathId,
      schoolId: actor.schoolId,
      studentId: actor.userId,
      studentName: actor.fullName,
      classId: actor.classId || 'class_8a2',
      topicCode: 'FACTORING_POLYNOMIAL',
      status: PathStatus.WAITING_APPROVAL,
      cycleNumber: (generatedPath?.cycleNumber || 0) + 1,
      consecutiveLowCheckpoints: 0,
      triggerReasons: {
        weakCompetencies: blueprint.weakCompetencies,
        recurringErrors: recurringWithCounts,
      },
      aiExplanation,
      steps: blueprint.steps.map((st, idx) => ({
        stepId: `${pathId}_step_${idx + 1}`,
        schoolId: actor.schoolId,
        pathId,
        studentId: actor.userId,
        stepOrder: st.stepOrder,
        stepType: st.stepType,
        title: st.title,
        description: st.description,
        targetCompetency: st.targetCompetency,
        targetErrorTag: st.targetErrorTag,
        targetDifficulty: st.targetDifficulty,
        questionIds:
          st.stepType === 'ERROR_CORRECTION'
            ? errPool.slice(0, 2).map((q) => q.questionId)
            : st.stepType === 'CHECKPOINT'
            ? chkPool.slice(0, 4).map((q) => q.questionId)
            : practicePool.slice(0, 3).map((q) => q.questionId),
        status: idx === 0 ? 'AVAILABLE' : 'LOCKED',
        createdAt: now,
        updatedAt: now,
      })),
      dataSource: 'REAL',
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };

    const pIdx = db.learningPaths.findIndex((p) => p.studentId === actor.userId);
    if (pIdx >= 0) {
      db.learningPaths[pIdx] = generatedPath;
    } else {
      db.learningPaths.unshift(generatedPath);
    }

    recordAudit(
      'PATH_GENERATED',
      actor,
      `Tạo lộ trình cá nhân hóa AI-PATH5 (chờ GV duyệt) cho ${actor.fullName} sau bài ${assessment.title}.`,
      pathId
    );
  }

  // Record progress history point
  db.progressHistory.push({
    studentId: actor.userId,
    date: now.slice(0, 10),
    label: assessment.assessmentType === PrimaryUse.POST_TEST ? 'Post-test' : 'Đánh giá mới',
    overall: overallMastery,
    foundation: competencyBreakdown.FOUNDATION,
    recognition: competencyBreakdown.RECOGNITION,
    transformation: competencyBreakdown.TRANSFORMATION,
    calcAccuracy: competencyBreakdown.CALC_ACCURACY,
    application: competencyBreakdown.APPLICATION,
  });

  // FIX 06 & FIX 07: Build/Update real Baseline (Pre-test) & Outcome (Post-test) directly from attempts
  if (
    assessment.assessmentType === PrimaryUse.PRE_TEST ||
    assessment.assessmentType === PrimaryUse.POST_TEST
  ) {
    const targetExps = expAccess.experiment
      ? [expAccess.experiment]
      : db.experiments.filter(
          (e) =>
            e.schoolId === actor.schoolId &&
            (e.preTestAssessmentId === assessment.assessmentId ||
              e.postTestAssessmentId === assessment.assessmentId)
        );
    for (const exp of targetExps) {
      syncExperimentMetricsFromAttempts(db, exp.experimentId);
    }
  }

  saveDatabase(db);
  return res.json({
    attempt,
    snapshot: newSnapshot,
    learningPath: generatedPath,
  });
});

// ============================================================================
// 6. TEACHER APPROVAL OF LEARNING PATH & ADAPTIVE TASKS (SECTIONS 47-52)
// ============================================================================
app.post('/api/paths/:pathId/teacher-decision', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền Duyệt / Chỉnh sửa / Từ chối lộ trình.' });
  }

  const { pathId } = req.params;
  const { action, reason, updatedSteps } = req.body || {}; // action: 'APPROVE' | 'MODIFY' | 'REJECT'
  const db = getDatabase();
  const pathObj = db.learningPaths.find((p) => p.pathId === pathId && p.schoolId === actor.schoolId);
  if (!pathObj) return res.status(404).json({ error: 'Không tìm thấy lộ trình học tập.' });

  if (actor.role === Role.TEACHER && !authorizeTeacherForLearningPath(actor, pathId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền phê duyệt lộ trình của học sinh thuộc lớp khác.',
    });
  }

  const now = new Date().toISOString();
  const previousStatus = pathObj.status;

  if (action === 'APPROVE') {
    pathObj.status = PathStatus.APPROVED;
    pathObj.approvedBy = actor.userId;
    pathObj.approvedAt = now;
    pathObj.steps.forEach((s, i) => {
      if (i === 0 && s.status === 'LOCKED') s.status = 'AVAILABLE';
    });
    recordAudit('PATH_APPROVED', actor, `Duyệt lộ trình ${pathId} của HS ${pathObj.studentName}.`, pathId);
  } else if (action === 'MODIFY') {
    pathObj.status = PathStatus.MODIFIED;
    pathObj.approvedBy = actor.userId;
    pathObj.approvedAt = now;
    if (Array.isArray(updatedSteps) && updatedSteps.length > 0) {
      pathObj.steps = updatedSteps;
    }
    pathObj.steps.forEach((s, i) => {
      if (i === 0 && s.status === 'LOCKED') s.status = 'AVAILABLE';
    });
    recordAudit('PATH_MODIFIED', actor, `Chỉnh sửa và duyệt lộ trình ${pathId} của HS ${pathObj.studentName}.`, pathId);
  } else if (action === 'REJECT') {
    pathObj.status = PathStatus.REJECTED;
    recordAudit('PATH_REJECTED', actor, `Từ chối lộ trình ${pathId} của HS ${pathObj.studentName}: ${reason || ''}`, pathId);
  }

  pathObj.teacherNote = reason || `Giáo viên ${actor.fullName} đã ${action.toLowerCase()} lộ trình.`;
  pathObj.updatedAt = now;

  db.teacherOverrides.unshift({
    overrideId: `ovr_${Date.now()}`,
    schoolId: actor.schoolId,
    teacherId: actor.userId,
    teacherName: actor.fullName,
    targetType: 'LEARNING_PATH',
    targetId: pathId,
    studentId: pathObj.studentId,
    action: action === 'REJECT' ? 'REJECT' : action === 'MODIFY' ? 'MODIFY' : 'APPROVE',
    reason: reason || `Quyết định chuyên môn của giáo viên (${action}).`,
    previousState: previousStatus,
    newState: pathObj.status,
    createdAt: now,
    updatedAt: now,
  });

  syncExperimentMetricsFromAttempts(db);
  saveDatabase(db);
  return res.json({ learningPath: pathObj });
});

app.post('/api/tasks/hint', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { questionId, hintLevel, studentCurrentInput, pathId, learningPathId, stepId } = req.body || {};
  const db = getDatabase();
  const question = db.questions.find((q) => q.questionId === questionId && q.schoolId === actor.schoolId);
  if (!question) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });

  if (
    question.primaryUse === PrimaryUse.CHECKPOINT ||
    question.primaryUse === PrimaryUse.PRE_TEST ||
    question.primaryUse === PrimaryUse.POST_TEST ||
    question.primaryUse === PrimaryUse.DIAGNOSTIC
  ) {
    return res.status(403).json({
      code: 'HINT_NOT_ALLOWED',
      error: 'Bài kiểm tra độc lập (Pre-test / Post-test / Diagnostic / Checkpoint) không sử dụng Gợi ý.',
    });
  }

  if (actor.role === Role.STUDENT) {
    const targetPathId = String(learningPathId || pathId || '').trim();
    if (targetPathId || stepId) {
      const check = validateStudentTaskStepSubmission({
        db,
        actor,
        learningPathId: targetPathId,
        stepId: String(stepId || ''),
        questionId: String(questionId || ''),
      });
      if (!check.allowed) {
        return res.status(check.statusCode).json({ code: check.code, error: check.error });
      }
    } else {
      const allowedQIds = getStudentAllowedQuestionIds(actor, db);
      if (!allowedQIds.has(question.questionId)) {
        return res.status(403).json({
          code: 'QUESTION_NOT_ASSIGNED',
          error: 'Câu hỏi này không thuộc nhiệm vụ học tập hiện tại của bạn.',
        });
      }
    }
  }

  const level = (Math.min(3, Math.max(1, Number(hintLevel) || 1))) as 1 | 2 | 3;
  const result = await generateProgressiveHintWithGemini({
    schoolId: actor.schoolId,
    actorId: actor.userId,
    question,
    hintLevel: level,
    studentCurrentInput,
    onLog: (log) => db.aiRuns.unshift(log),
  });

  const safeHintText = sanitizeStudentFeedbackText(
    result.hintText,
    question.correctAnswer,
    'Em hãy kiểm tra lại quy tắc dấu và nhân tử chung ở bước biến đổi.'
  );

  saveDatabase(db);
  return res.json({
    ...result,
    hintText: safeHintText,
  });
});

app.post('/api/tasks/submit-answer', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { pathId, learningPathId, stepId, questionId, studentAnswer, hintsUsed } = req.body || {};
  const targetPathId = String(learningPathId || pathId || '').trim();
  const targetStepId = String(stepId || '').trim();
  const db = getDatabase();

  // FIX 03: Strictly validate studentId + learningPathId + stepId + questionId + step status + task type + allowedUses
  const validation = validateStudentTaskStepSubmission({
    db,
    actor,
    learningPathId: targetPathId,
    stepId: targetStepId,
    questionId: String(questionId || ''),
  });

  if (!validation.allowed) {
    return res.status(validation.statusCode).json({
      code: validation.code,
      error: validation.error,
    });
  }

  const question = validation.question;
  const pathObj = validation.path;
  const step = validation.step;

  const cleanAns = String(studentAnswer || '').trim();
  const isCorrect = cleanAns.toLowerCase() === question.correctAnswer.trim().toLowerCase();
  const now = new Date().toISOString();

  let aiAnalysis = undefined;
  let detectedErrorTag: ErrorTagCode | undefined = undefined;

  if (!isCorrect) {
    // FIX 04: Never reveal or leak correctAnswer in aiAnalysis, evidence, or studentFeedback!
    const errRes = await analyzeStudentErrorWithGemini({
      schoolId: actor.schoolId,
      actorId: actor.userId,
      pseudonymId: actor.pseudonymId,
      questionText: question.questionText,
      correctAnswer: question.correctAnswer,
      studentAnswer: cleanAns,
      competency: question.competency,
      candidateErrorTags: question.errorTags,
      onLog: (log) => db.aiRuns.unshift(log),
    });

    aiAnalysis = {
      ...errRes,
      evidence: sanitizeStudentFeedbackText(
        errRes.evidence,
        question.correctAnswer,
        question.solution
      ),
      studentFeedback: sanitizeStudentFeedbackText(
        errRes.studentFeedback,
        question.correctAnswer,
        question.solution
      ),
    };
    detectedErrorTag =
      errRes.errorType !== 'NEED_MORE_EVIDENCE' ? errRes.errorType : question.errorTags[0] || ErrorTagCode.SIGN_ERROR;

    const existingErr = db.detectedErrors.find(
      (e) => e.studentId === actor.userId && e.errorTag === detectedErrorTag
    );
    if (existingErr) {
      existingErr.occurrencesInLast10 = Math.min(10, existingErr.occurrencesInLast10 + 1);
      existingErr.totalOccurrences += 1;
      existingErr.isRecurring = existingErr.occurrencesInLast10 >= 3;
      existingErr.lastDetectedAt = now;
      existingErr.updatedAt = now;
    }
  } else {
    // If correct on an error correction or practice item, mark matching error as IMPROVING
    for (const tag of question.errorTags) {
      const existingErr = db.detectedErrors.find((e) => e.studentId === actor.userId && e.errorTag === tag);
      if (existingErr && existingErr.occurrencesInLast10 > 0) {
        existingErr.status = existingErr.occurrencesInLast10 <= 1 ? 'RESOLVED' : 'IMPROVING';
        existingErr.updatedAt = now;
      }
    }
  }

  db.responses.push({
    responseId: `resp_task_${Date.now()}`,
    schoolId: actor.schoolId,
    attemptId: targetStepId || 'practice_session',
    assessmentId: targetPathId || 'practice',
    studentId: actor.userId,
    questionId: question.questionId,
    competency: question.competency,
    difficulty: question.difficulty,
    studentAnswer: cleanAns,
    isCorrect,
    hintsUsed: Number(hintsUsed) || 0,
    detectedErrorTag,
    aiAnalysis,
    timeSpentSeconds: 45,
    dataSource: 'REAL',
    createdAt: now,
    updatedAt: now,
  });

  // 48. Evaluate P4 Adaptive Learning adjustment over recent 4 responses
  const recentStudentResponses = db.responses.filter((r) => r.studentId === actor.userId).slice(-4);
  const adaptiveAdjustment = evaluateAdaptiveAdjustment({
    currentDifficulty: question.difficulty,
    recentCorrectBooleans: recentStudentResponses.map((r) => r.isCorrect),
    recentHintsUsed: recentStudentResponses.map((r) => r.hintsUsed),
    recentErrorTags: recentStudentResponses.map((r) => r.detectedErrorTag),
  });

  // Update step status when answered correctly
  let stepCompleted = false;
  if (pathObj && step && isCorrect) {
    const stepIdx = pathObj.steps.findIndex((s) => s.stepId === step.stepId);
    if (stepIdx >= 0) {
      step.status = 'COMPLETED';
      step.scorePercent = Math.max(75, 100 - (Number(hintsUsed) || 0) * 10);
      step.hintsUsedCount = (step.hintsUsedCount || 0) + (Number(hintsUsed) || 0);
      step.completedAt = now;
      step.updatedAt = now;
      stepCompleted = true;
      if (stepIdx + 1 < pathObj.steps.length && pathObj.steps[stepIdx + 1].status === 'LOCKED') {
        pathObj.steps[stepIdx + 1].status = 'AVAILABLE';
      }
    }
  } else if (step && !isCorrect && Number(hintsUsed) > 0) {
    step.hintsUsedCount = Math.max(step.hintsUsedCount || 0, Number(hintsUsed) || 0);
    step.updatedAt = now;
  }

  // Sync student experiment metrics for PATH5 progress directly from attempts & paths
  syncExperimentMetricsFromAttempts(db);

  const safeFeedback = isCorrect
    ? 'Chính xác! Em đã thực hiện đúng quy tắc phân tích đa thức.'
    : sanitizeStudentFeedbackText(
        aiAnalysis?.studentFeedback,
        question.correctAnswer,
        'Em hãy kiểm tra lại quy tắc dấu ở bước biến đổi.'
      );

  saveDatabase(db);
  return res.json({
    correct: isCorrect,
    isCorrect,
    feedback: safeFeedback,
    feedbackMessage: safeFeedback,
    hintAvailable: !isCorrect,
    // FIX 04: Only return solution when task/step is completed AND policy allows (never when wrong)
    solution: isCorrect && stepCompleted ? question.solution : undefined,
    aiAnalysis: isCorrect ? undefined : aiAnalysis,
    adaptiveAdjustment,
    learningPath: pathObj,
  });
});

app.post('/api/checkpoints/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { pathId, answers } = req.body || {};
  const db = getDatabase();
  const pathObj = db.learningPaths.find((p) => p.pathId === pathId && p.studentId === actor.userId);
  if (!pathObj) return res.status(404).json({ error: 'Không tìm thấy lộ trình.' });

  if (pathObj.status === PathStatus.WAITING_APPROVAL || pathObj.status === PathStatus.REJECTED) {
    return res.status(403).json({
      code: 'STEP_NOT_AVAILABLE',
      error: 'Lộ trình học tập chưa được Giáo viên phê duyệt.',
    });
  }

  const chkStep = pathObj.steps.find((s) => s.stepType === 'CHECKPOINT') || pathObj.steps[pathObj.steps.length - 1];
  if (!chkStep || chkStep.status === 'LOCKED') {
    return res.status(403).json({
      code: 'STEP_NOT_AVAILABLE',
      error: 'Bước Checkpoint hiện đang khóa. Vui lòng hoàn thành các bước trước đó.',
    });
  }

  const questions = db.questions.filter((q) => chkStep.questionIds.includes(q.questionId));

  let correctCount = 0;
  for (const q of questions) {
    const ans = String((answers || {})[q.questionId] || '').trim();
    if (ans.toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
      correctCount += 1;
    }
  }

  const checkpointScore = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const reroute = evaluateCheckpointReroute(checkpointScore, pathObj.consecutiveLowCheckpoints);
  const now = new Date().toISOString();

  chkStep.status = 'COMPLETED';
  chkStep.scorePercent = checkpointScore;
  chkStep.completedAt = now;
  chkStep.updatedAt = now;

  pathObj.consecutiveLowCheckpoints = reroute.newConsecutiveLowCheckpoints;
  if (reroute.decision === 'MASTERED') {
    pathObj.status = PathStatus.COMPLETED;
  } else if (reroute.decision === 'TEACHER_INTERVENTION_REQUIRED') {
    pathObj.status = PathStatus.TEACHER_INTERVENTION_REQUIRED;
  }
  pathObj.updatedAt = now;

  // Update snapshot with new Checkpoint signal (42. Mastery V1 formula)
  const snap = db.competencySnapshots.find((s) => s.studentId === actor.userId);
  if (snap) {
    const targetComp = chkStep.targetCompetency;
    const compItem = snap.competencies[targetComp];
    if (compItem) {
      compItem.signals.checkpoint = checkpointScore;
      compItem.score = calculateMasteryScore({
        accuracy: compItem.signals.accuracy ?? 70,
        checkpoint: checkpointScore,
        independence: 90,
        stability: 80,
      });
      const lvl = getMasteryLevelInfo(compItem.score);
      compItem.level = lvl.level;
      compItem.levelLabelVi = lvl.labelVi;
    }
    snap.overallMastery = Math.round(
      Object.values(snap.competencies).reduce((sum, item) => sum + item.score, 0) / 5
    );
    snap.updatedAt = now;
  }

  // Sync student experiment metrics with Checkpoint score & completion
  syncExperimentMetricsFromAttempts(db);

  saveDatabase(db);
  return res.json({
    checkpointScore,
    reroute,
    learningPath: pathObj,
    snapshot: snap,
  });
});

// ============================================================================
// 7. TEACHER CLASS GROUPING & AI INTERVENTION INSIGHT (SECTIONS 54-57, 82)
// ============================================================================
app.put('/api/classes/:classId/grouping', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền điều chỉnh nhóm học tập.' });
  }

  const { classId } = req.params;
  const { studentId, group } = req.body || {};
  const db = getDatabase();

  if (
    actor.role === Role.TEACHER &&
    (!authorizeTeacherForClass(actor, classId, db) || !authorizeTeacherForStudent(actor, studentId, db))
  ) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn chỉ được điều chỉnh nhóm học tập cho học sinh trong lớp phụ trách.',
    });
  }

  const snap = db.competencySnapshots.find((s) => s.studentId === studentId && s.schoolId === actor.schoolId);
  if (!snap) return res.status(404).json({ error: 'Không tìm thấy hồ sơ năng lực học sinh.' });

  const now = new Date().toISOString();
  snap.teacherGroupOverride = group;
  snap.updatedAt = now;

  db.teacherOverrides.unshift({
    overrideId: `ovr_grp_${Date.now()}`,
    schoolId: actor.schoolId,
    teacherId: actor.userId,
    teacherName: actor.fullName,
    targetType: 'CLASS_GROUPING',
    targetId: snap.snapshotId,
    studentId,
    action: 'MODIFY',
    reason: `Giáo viên điều chỉnh phân nhóm học sinh ${snap.studentName} sang ${group}.`,
    createdAt: now,
    updatedAt: now,
  });

  saveDatabase(db);
  return res.json({ snapshot: snap });
});

app.post('/api/classes/:classId/ai-insight', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền xem phân tích lớp học.' });
  }

  const { classId } = req.params;
  const db = getDatabase();
  if (actor.role === Role.TEACHER && !authorizeTeacherForClass(actor, classId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không được phép phân tích lớp học không thuộc phạm vi phụ trách.',
    });
  }

  const snaps = db.competencySnapshots.filter((s) => s.schoolId === actor.schoolId && s.classId === classId);

  const totalStudents = snaps.length;
  const applicationBelow60Count = snaps.filter((s) => s.competencies.APPLICATION.score < 60).length;
  const signErrorRecurringCount = db.detectedErrors.filter(
    (e) => e.schoolId === actor.schoolId && e.errorTag === ErrorTagCode.SIGN_ERROR && e.isRecurring
  ).length;

  const avgByCompetency: Record<CompetencyCode, number> = {
    [CompetencyCode.FOUNDATION]: 0,
    [CompetencyCode.RECOGNITION]: 0,
    [CompetencyCode.TRANSFORMATION]: 0,
    [CompetencyCode.CALC_ACCURACY]: 0,
    [CompetencyCode.APPLICATION]: 0,
  };

  if (totalStudents > 0) {
    for (const c of Object.values(CompetencyCode)) {
      avgByCompetency[c] = Math.round(
        snaps.reduce((sum, s) => sum + (s.competencies[c]?.score || 0), 0) / totalStudents
      );
    }
  }

  const insight = await generateClassInsightWithGemini({
    schoolId: actor.schoolId,
    actorId: actor.userId,
    totalStudents,
    applicationBelow60Count,
    signErrorRecurringCount,
    avgByCompetency,
    onLog: (log) => db.aiRuns.unshift(log),
  });

  saveDatabase(db);
  return res.json(insight);
});

// ============================================================================
// 8. EXPERIMENT MODULE ROUTES (SECTIONS 58-77)
// ============================================================================
app.post('/api/experiments/validate-equivalence', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên hoặc Quản trị viên mới được đối chiếu đề thực nghiệm.' });
  }

  const { preAssessmentId, postAssessmentId } = req.body || {};
  const db = getDatabase();
  const preAssess = db.assessments.find((a) => a.assessmentId === preAssessmentId && a.schoolId === actor.schoolId);
  const postAssess = db.assessments.find((a) => a.assessmentId === postAssessmentId && a.schoolId === actor.schoolId);

  if (!preAssess || !postAssess) {
    return res.status(404).json({ error: 'Không tìm thấy đề Pre-test hoặc Post-test để đối chiếu.' });
  }

  if (
    actor.role === Role.TEACHER &&
    (!authorizeTeacherForAssessment(actor, preAssessmentId, db) ||
      !authorizeTeacherForAssessment(actor, postAssessmentId, db))
  ) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền truy cập đề đánh giá của lớp khác.',
    });
  }

  const preQ = db.questions.filter((q) => preAssess.questionIds.includes(q.questionId));
  const postQ = db.questions.filter((q) => postAssess.questionIds.includes(q.questionId));

  const eq = validatePrePostEquivalence(preQ, postQ);
  return res.json(eq);
});

app.post('/api/experiments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới được tạo đợt thực nghiệm.' });
  }

  const {
    title,
    description,
    classId,
    targetCompetencies,
    preTestAssessmentId,
    postTestAssessmentId,
    dataSource,
    equivalenceApprovedByTeacher,
  } = req.body || {};

  if (!title || !preTestAssessmentId || !postTestAssessmentId) {
    return res.status(400).json({ error: 'Vui lòng điền đủ Tên đợt thực nghiệm, đề Pre-test và Post-test.' });
  }

  const db = getDatabase();
  const targetClassId = classId || actor.classId;
  const cls = db.classes.find((c) => c.schoolId === actor.schoolId && c.classId === targetClassId) ||
    (actor.role === Role.ADMIN ? db.classes.find((c) => c.schoolId === actor.schoolId) : undefined);

  if (!cls) {
    return res.status(404).json({ error: 'Không tìm thấy lớp học hợp lệ để tạo đợt thực nghiệm.' });
  }

  if (
    actor.role === Role.TEACHER &&
    (!authorizeTeacherForClass(actor, cls.classId, db) ||
      !authorizeTeacherForAssessment(actor, preTestAssessmentId, db) ||
      !authorizeTeacherForAssessment(actor, postTestAssessmentId, db))
  ) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn chỉ được phép tạo đợt thực nghiệm cho lớp và đề đánh giá mình phụ trách.',
    });
  }

  const preAssess = db.assessments.find((a) => a.assessmentId === preTestAssessmentId && a.schoolId === actor.schoolId);
  const postAssess = db.assessments.find((a) => a.assessmentId === postTestAssessmentId && a.schoolId === actor.schoolId);
  const preQ = db.questions.filter((q) => preAssess?.questionIds.includes(q.questionId));
  const postQ = db.questions.filter((q) => postAssess?.questionIds.includes(q.questionId));
  const eq = validatePrePostEquivalence(preQ, postQ);

  const now = new Date().toISOString();

  const newExp = {
    experimentId: `exp_${Date.now()}`,
    schoolId: actor.schoolId,
    title: String(title).trim(),
    description: String(description || 'Đợt thực nghiệm đánh giá hiệu quả lộ trình thích ứng AI-PATH5.'),
    classId: cls.classId,
    className: cls.name,
    topicCode: 'FACTORING_POLYNOMIAL',
    targetCompetencies: Array.isArray(targetCompetencies) ? targetCompetencies : Object.values(CompetencyCode),
    preTestAssessmentId,
    postTestAssessmentId,
    equivalenceScore: eq.equivalenceScore,
    equivalenceApprovedByTeacher: Boolean(equivalenceApprovedByTeacher),
    state: ExperimentState.READY,
    dataSource: dataSource === 'DEMO' ? ('DEMO' as const) : ('REAL' as const),
    participantCount: cls.studentCount || 36,
    preTestSubmittedCount: 0,
    preTestInProgressCount: 0,
    postTestSubmittedCount: 0,
    postTestInProgressCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
  };

  if (preAssess) preAssess.experimentId = newExp.experimentId;
  if (postAssess) postAssess.experimentId = newExp.experimentId;

  db.experiments.unshift(newExp);
  recordAudit(
    'EXPERIMENT_STATE_CHANGE',
    actor,
    `Khởi tạo đợt thực nghiệm "${newExp.title}" ở trạng thái READY (Tương đương Pre/Post: ${eq.equivalenceScore}%).`,
    newExp.experimentId
  );
  saveDatabase(db);

  return res.json({ experiment: newExp, equivalence: eq });
});

app.post('/api/experiments/:experimentId/transition', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền chuyển trạng thái thực nghiệm.' });
  }

  const { experimentId } = req.params;
  const { targetState } = req.body || {};
  const db = getDatabase();
  const exp = db.experiments.find((e) => e.experimentId === experimentId && e.schoolId === actor.schoolId);
  if (!exp) return res.status(404).json({ error: 'Không tìm thấy đợt thực nghiệm.' });

  if (actor.role === Role.TEACHER && !authorizeTeacherForExperiment(actor, experimentId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền điều khiển đợt thực nghiệm của lớp khác.',
    });
  }

  const nextState = targetState as ExperimentState;
  // 60. Enforce strict state transition rules
  if (!canTransitionExperimentState(exp.state, nextState)) {
    return res.status(400).json({
      error: `Không được phép nhảy trạng thái từ ${exp.state} sang ${nextState}. Phải tuân thủ đúng quy trình thực nghiệm.`,
    });
  }

  const now = new Date().toISOString();
  const prevState = exp.state;
  exp.state = nextState;
  exp.updatedAt = now;

  // Bind Pre/Post assessments to this active experiment so Student gatekeeper enforces its state
  const preAssess = db.assessments.find((a) => a.assessmentId === exp.preTestAssessmentId && a.schoolId === actor.schoolId);
  const postAssess = db.assessments.find((a) => a.assessmentId === exp.postTestAssessmentId && a.schoolId === actor.schoolId);
  if (preAssess) preAssess.experimentId = exp.experimentId;
  if (postAssess) postAssess.experimentId = exp.experimentId;

  if (nextState === ExperimentState.INTERVENTION_RUNNING) {
    // 61. Closing Pre-test locks Baseline from real attempts!
    exp.baselineLockedAt = now;
    syncExperimentMetricsFromAttempts(db, exp.experimentId);
  } else if (nextState === ExperimentState.POSTTEST_RUNNING) {
    // 64. Verify checklist before opening Post-test
    if (!exp.baselineLockedAt || !exp.equivalenceApprovedByTeacher) {
      exp.state = prevState;
      return res.status(400).json({
        error: 'Chưa đủ điều kiện mở Post-test: Cần khóa Baseline Pre-test và duyệt độ tương đương Pre/Post.',
      });
    }
    syncExperimentMetricsFromAttempts(db, exp.experimentId);
  } else if (nextState === ExperimentState.COMPLETED) {
    exp.completedAt = now;
    syncExperimentMetricsFromAttempts(db, exp.experimentId);
  } else {
    syncExperimentMetricsFromAttempts(db, exp.experimentId);
  }

  recordAudit(
    'EXPERIMENT_STATE_CHANGE',
    actor,
    `Chuyển trạng thái thực nghiệm "${exp.title}" từ ${prevState} → ${nextState}.`,
    exp.experimentId
  );
  saveDatabase(db);

  return res.json({ experiment: exp });
});

app.post('/api/experiments/:experimentId/sync-metrics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền đồng bộ dữ liệu thực nghiệm.' });
  }

  const { experimentId } = req.params;
  const db = getDatabase();
  const exp = db.experiments.find((e) => e.experimentId === experimentId && e.schoolId === actor.schoolId);
  if (!exp) return res.status(404).json({ error: 'Không tìm thấy đợt thực nghiệm.' });

  if (actor.role === Role.TEACHER && !authorizeTeacherForExperiment(actor, experimentId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền đồng bộ dữ liệu thực nghiệm của lớp khác.',
    });
  }

  syncExperimentMetricsFromAttempts(db, exp.experimentId);
  saveDatabase(db);

  const metrics = db.experimentStudentMetrics.filter((m) => m.experimentId === exp.experimentId);
  return res.json({ experiment: exp, metrics });
});

app.post('/api/experiments/:experimentId/feedback', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  const { experimentId } = req.params;
  const { likertScores, openAnswer1, openAnswer2 } = req.body || {};

  if (!Array.isArray(likertScores) || likertScores.length !== 5) {
    return res.status(400).json({ error: 'Vui lòng đánh giá đầy đủ 5 tiêu chí Likert (1–5).' });
  }

  const db = getDatabase();
  const exp = db.experiments.find((e) => e.experimentId === experimentId && e.schoolId === actor.schoolId);
  if (!exp) return res.status(404).json({ error: 'Không tìm thấy đợt thực nghiệm.' });

  if (actor.role === Role.TEACHER && !authorizeTeacherForExperiment(actor, experimentId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không thuộc đợt thực nghiệm này.',
    });
  }
  if (actor.role === Role.STUDENT && actor.classId !== exp.classId) {
    return res.status(403).json({
      error: 'Đợt thực nghiệm này không thuộc lớp của bạn.',
    });
  }

  const now = new Date().toISOString();
  const record = {
    feedbackResponseId: `fb_${actor.userId}_${Date.now()}`,
    schoolId: actor.schoolId,
    experimentId,
    respondentId: actor.userId,
    respondentName: actor.fullName,
    respondentRole: actor.role === Role.STUDENT ? ('STUDENT' as const) : ('TEACHER' as const),
    likertScores: likertScores.map((n) => Math.min(5, Math.max(1, Number(n) || 5))),
    openAnswer1: String(openAnswer1 || '').trim(),
    openAnswer2: String(openAnswer2 || '').trim(),
    dataSource: exp.dataSource,
    createdAt: now,
    updatedAt: now,
  };

  db.feedbackResponses.unshift(record);
  saveDatabase(db);
  return res.json({ feedback: record });
});

app.put(
  '/api/experiments/:experimentId/case-studies/:caseId/approve',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const actor = req.actor!;
    if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền duyệt Case Study.' });
    }

    const { experimentId, caseId } = req.params;
    const { teacherApproved, teacherNotes } = req.body || {};
    const db = getDatabase();
    const cs = db.experimentCaseStudies.find((c) => c.caseId === caseId && c.schoolId === actor.schoolId);
    if (!cs) return res.status(404).json({ error: 'Không tìm thấy Case Study.' });

    if (
      actor.role === Role.TEACHER &&
      (!authorizeTeacherForExperiment(actor, experimentId || cs.experimentId, db) ||
        !authorizeTeacherForStudent(actor, cs.studentId, db))
    ) {
      return res.status(403).json({
        code: 'TEACHER_SCOPE_VIOLATION',
        error: 'Bạn không có quyền duyệt Case Study của lớp khác.',
      });
    }

    cs.teacherApproved = Boolean(teacherApproved);
    if (teacherNotes) {
      cs.path5ProcessSummary.teacherNotes = String(teacherNotes);
    }
    cs.updatedAt = new Date().toISOString();

    db.teacherOverrides.unshift({
      overrideId: `ovr_case_${Date.now()}`,
      schoolId: actor.schoolId,
      teacherId: actor.userId,
      teacherName: actor.fullName,
      targetType: 'CASE_STUDY',
      targetId: caseId,
      studentId: cs.studentId,
      action: cs.teacherApproved ? 'APPROVE' : 'REJECT',
      reason: `Giáo viên ${cs.teacherApproved ? 'duyệt' : 'bỏ duyệt'} hồ sơ điển hình (${cs.categoryLabelVi}).`,
      createdAt: cs.updatedAt,
      updatedAt: cs.updatedAt,
    });

    saveDatabase(db);
    return res.json({ caseStudy: cs });
  }
);

app.post('/api/experiments/:experimentId/evidence', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên mới có quyền tải lên minh chứng thực nghiệm.' });
  }

  const { experimentId } = req.params;
  const { title, evidenceType, fileName, fileSize, mimeType, fileDataUrl, notes, consentConfirmed } = req.body || {};

  // 73. Mandatory consentConfirmed check
  if (!consentConfirmed) {
    return res.status(400).json({
      error: 'Bắt buộc xác nhận đồng thuận sử dụng dữ liệu minh chứng (consentConfirmed = true) và bảo vệ quyền riêng tư học sinh.',
    });
  }
  if (!title) {
    return res.status(400).json({ error: 'Vui lòng nhập tiêu đề minh chứng.' });
  }

  const db = getDatabase();
  const exp = db.experiments.find((e) => e.experimentId === experimentId && e.schoolId === actor.schoolId);
  if (!exp) return res.status(404).json({ error: 'Không tìm thấy đợt thực nghiệm.' });

  if (actor.role === Role.TEACHER && !authorizeTeacherForExperiment(actor, experimentId, db)) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền tải lên minh chứng cho đợt thực nghiệm của lớp khác.',
    });
  }

  const now = new Date().toISOString();
  const ev = {
    evidenceId: `ev_${Date.now()}`,
    schoolId: actor.schoolId,
    experimentId,
    title: String(title).trim(),
    evidenceType: evidenceType || 'DOCUMENT',
    fileName: fileName ? String(fileName) : undefined,
    fileSize: fileSize ? Number(fileSize) : undefined,
    mimeType: mimeType ? String(mimeType) : undefined,
    fileDataUrl: fileDataUrl ? String(fileDataUrl).slice(0, 500_000) : undefined,
    notes: String(notes || '').trim(),
    consentConfirmed: true,
    uploadedBy: actor.userId,
    uploadedByName: actor.fullName,
    dataSource: exp.dataSource,
    createdAt: now,
    updatedAt: now,
  };

  db.experimentEvidence.unshift(ev);
  recordAudit(
    'EVIDENCE_UPLOADED',
    actor,
    `Tải lên minh chứng "${ev.title}" (${ev.evidenceType}) cho đợt thực nghiệm ${exp.title}.`,
    ev.evidenceId
  );
  saveDatabase(db);
  return res.json({ evidence: ev });
});

app.post('/api/reports/log-export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.actor!;
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) {
    return res.status(403).json({ error: 'Chỉ Giáo viên hoặc Quản trị viên mới được phép xuất báo cáo.' });
  }
  const { format, experimentId } = req.body || {};
  const db = getDatabase();
  if (
    actor.role === Role.TEACHER &&
    experimentId &&
    !authorizeTeacherForExperiment(actor, experimentId, db)
  ) {
    return res.status(403).json({
      code: 'TEACHER_SCOPE_VIOLATION',
      error: 'Bạn không có quyền xuất báo cáo thực nghiệm của lớp khác.',
    });
  }
  recordAudit(
    'REPORT_EXPORT',
    actor,
    `Xuất báo cáo thực nghiệm định dạng ${format || 'EXCEL'} cho đợt ${
      experimentId || db.experiments[0]?.experimentId || ''
    }.`,
    experimentId
  );
  saveDatabase(db);
  return res.json({ ok: true });
});

// ============================================================================
// 9. VITE MIDDLEWARE / STATIC ASSETS & SERVER BOOT
// ============================================================================
async function startServer() {
  const PORT = 3000;
  getDatabase(); // Ensure seed DB is initialized on disk

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI PATH V1.0 Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}

