import {
  Assessment,
  Experiment,
  ExperimentState,
  LearningPath,
  LearningPathStep,
  PathStatus,
  PrimaryUse,
  Question,
  Role,
  StudentQuestionDTO,
  UserAccount,
} from '../../src/types/index.ts';
import { PersistentDatabaseSchema } from '../repositories/database.ts';

/**
 * Checks if a user account status is disabled/locked/archived/inactive.
 */
export function isAccountDisabled(status: UserAccount['status'] | string | undefined): boolean {
  return (
    status === 'INACTIVE' ||
    status === 'LOCKED' ||
    status === 'DISABLED' ||
    status === 'ARCHIVED'
  );
}

/**
 * FIX 02 & 1B. StudentQuestionDTO Mapper
 * Strictly includes only student-safe fields:
 * - id, questionId, questionText, questionType, options, points, media, competency, difficulty, primaryUse
 * Strictly strips:
 * - correctAnswer
 * - solution
 * - gradingKey / rubric / expectedAnswer / answerExplanation
 * - internalErrorTags / errorTags
 * - hints
 * - teacherNotes / source / aiGenerated / teacherApproved
 */
export function toStudentQuestionDTO(q: Question): StudentQuestionDTO {
  const dto: StudentQuestionDTO = {
    id: q.questionId,
    questionId: q.questionId,
    schoolId: q.schoolId,
    grade: q.grade,
    subject: q.subject,
    topic: q.topic,
    competency: q.competency,
    difficulty: q.difficulty,
    questionType: q.questionType,
    questionText: q.questionText,
    options: q.options ? [...q.options] : undefined,
    primaryUse: q.primaryUse,
    allowedUses: q.allowedUses ? [...q.allowedUses] : [],
    estimatedSeconds: q.estimatedSeconds,
    points: q.points,
  };
  if ((q as Question & { media?: string }).media) {
    dto.media = (q as Question & { media?: string }).media;
  }
  return dto;
}

/**
 * FIX 01. Resolves the active Experiment controlling a PRE_TEST or POST_TEST assessment.
 */
export function findExperimentForAssessment(
  assessment: Assessment,
  db: PersistentDatabaseSchema,
  explicitExperimentId?: string
): Experiment | undefined {
  if (explicitExperimentId) {
    const explicit = db.experiments.find(
      (e) => e.experimentId === explicitExperimentId && e.schoolId === assessment.schoolId
    );
    if (explicit) return explicit;
  }

  const matchingExperiments = db.experiments.filter(
    (e) =>
      e.schoolId === assessment.schoolId &&
      (e.preTestAssessmentId === assessment.assessmentId ||
        e.postTestAssessmentId === assessment.assessmentId)
  );

  // If a newer custom REAL experiment was created and unshifted to the front, prefer it
  const customNewest = matchingExperiments.find(
    (e) =>
      e.dataSource === 'REAL' ||
      (e.experimentId !== 'exp_demo_8a2_completed' && e.experimentId !== 'exp_demo_preview')
  );
  if (customNewest) {
    return customNewest;
  }

  if (assessment.experimentId) {
    const linked = db.experiments.find(
      (e) => e.experimentId === assessment.experimentId && e.schoolId === assessment.schoolId
    );
    if (linked) return linked;
  }

  return matchingExperiments[0];
}

/**
 * FIX 01. Enforces the strict Experiment State Machine on PRE_TEST and POST_TEST assessments.
 * DRAFT -> READY -> PRETEST_RUNNING -> INTERVENTION_RUNNING -> POSTTEST_RUNNING -> COMPLETED -> ARCHIVED
 * - READY / DRAFT: Pre locked, Post locked
 * - PRETEST_RUNNING: Pre open, Post locked
 * - INTERVENTION_RUNNING: Pre locked, Post locked
 * - POSTTEST_RUNNING: Pre locked, Post open
 * - COMPLETED / ARCHIVED: Both locked for new submissions
 */
export function checkExperimentAssessmentAccess(
  first: Assessment | PersistentDatabaseSchema,
  second: PersistentDatabaseSchema | Assessment,
  explicitExperimentId?: string
): {
  allowed: boolean;
  status: number;
  statusCode: number;
  code?: 'PRETEST_CLOSED' | 'PRETEST_NOT_OPEN' | 'POSTTEST_NOT_OPEN' | 'POSTTEST_CLOSED';
  error?: string;
  experiment?: Experiment;
} {
  const isFirstAssessment = 'assessmentId' in first;
  const assessment = (isFirstAssessment ? first : second) as Assessment;
  const db = (isFirstAssessment ? second : first) as PersistentDatabaseSchema;

  if (
    assessment.assessmentType !== PrimaryUse.PRE_TEST &&
    assessment.assessmentType !== PrimaryUse.POST_TEST
  ) {
    return { allowed: true, status: 200, statusCode: 200 };
  }

  const exp = findExperimentForAssessment(assessment, db, explicitExperimentId);

  if (assessment.assessmentType === PrimaryUse.PRE_TEST) {
    if (!exp) {
      return {
        allowed: false,
        status: 403,
        statusCode: 403,
        code: 'PRETEST_CLOSED',
        error: 'PRETEST_CLOSED: Bài Pre-test hiện đang khóa vì chưa có đợt thực nghiệm mở Pre-test.',
      };
    }
    if (exp.state === ExperimentState.PRETEST_RUNNING) {
      return { allowed: true, status: 200, statusCode: 200, experiment: exp };
    }
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'PRETEST_CLOSED',
      error: `PRETEST_CLOSED: Bài đánh giá Pre-test đang khóa ở trạng thái thực nghiệm ${exp.state}.`,
      experiment: exp,
    };
  }

  // PrimaryUse.POST_TEST
  if (!exp) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'POSTTEST_NOT_OPEN',
      error: 'POSTTEST_NOT_OPEN: Bài Post-test chưa được mở.',
    };
  }
  if (exp.state === ExperimentState.POSTTEST_RUNNING) {
    return { allowed: true, status: 200, statusCode: 200, experiment: exp };
  }
  return {
    allowed: false,
    status: 403,
    statusCode: 403,
    code: 'POSTTEST_NOT_OPEN',
    error: `POSTTEST_NOT_OPEN: Bài đánh giá Post-test không mở ở trạng thái thực nghiệm ${exp.state}.`,
    experiment: exp,
  };
}

/**
 * FIX 02. Returns the Set of questionIds that a Student is currently allowed to see:
 * - Questions in currently open assessments (DIAGNOSTIC, or PRE_TEST when PRETEST_RUNNING, or POST_TEST when POSTTEST_RUNNING)
 * - Questions in non-LOCKED steps of the student's current Learning Path (when path is APPROVED or MODIFIED or COMPLETED)
 * Never preloads the entire Question Bank or locked Post-test / Pre-test / Checkpoint pools!
 */
export function getStudentAllowedQuestionIds(
  actor: UserAccount,
  db: PersistentDatabaseSchema
): Set<string> {
  const schoolId = actor.schoolId;
  const allowedQuestionIds = new Set<string>();

  // 1. Open assessments for the student's class
  const studentAssessments = db.assessments.filter(
    (a) => a.schoolId === schoolId && a.classId === actor.classId && a.status === 'PUBLISHED'
  );

  for (const assess of studentAssessments) {
    if (assess.assessmentType === PrimaryUse.DIAGNOSTIC) {
      assess.questionIds.forEach((qid) => allowedQuestionIds.add(qid));
    } else if (
      assess.assessmentType === PrimaryUse.PRE_TEST ||
      assess.assessmentType === PrimaryUse.POST_TEST
    ) {
      const access = checkExperimentAssessmentAccess(assess, db);
      if (access.allowed) {
        assess.questionIds.forEach((qid) => allowedQuestionIds.add(qid));
      }
    }
  }

  // 2. Active / available steps in the student's current Learning Path
  const studentPaths = db.learningPaths.filter(
    (p) => p.schoolId === schoolId && p.studentId === actor.userId
  );

  for (const pathObj of studentPaths) {
    if (
      pathObj.status === PathStatus.APPROVED ||
      pathObj.status === PathStatus.MODIFIED ||
      pathObj.status === PathStatus.COMPLETED
    ) {
      for (const step of pathObj.steps) {
        if (
          step.status === 'AVAILABLE' ||
          step.status === 'IN_PROGRESS' ||
          step.status === 'COMPLETED'
        ) {
          step.questionIds.forEach((qid) => allowedQuestionIds.add(qid));
        }
      }
    }
  }

  return allowedQuestionIds;
}

export function getScopedStudentQuestions(
  actor: UserAccount,
  db: PersistentDatabaseSchema
): StudentQuestionDTO[] {
  const schoolId = actor.schoolId;
  const allowedQuestionIds = getStudentAllowedQuestionIds(actor, db);

  return db.questions
    .filter((q) => q.schoolId === schoolId && allowedQuestionIds.has(q.questionId))
    .map(toStudentQuestionDTO);
}

/**
 * FIX 03. Strictly validates a Student's task/step answer or hint request against their active Learning Path.
 */
export function validateStudentTaskStepSubmission(params: {
  db: PersistentDatabaseSchema;
  actor: UserAccount;
  learningPathId: string;
  stepId: string;
  questionId: string;
}):
  | {
      allowed: false;
      status: number;
      statusCode: number;
      code: string;
      error: string;
    }
  | {
      allowed: true;
      status: 200;
      statusCode: 200;
      question: Question;
      path: LearningPath;
      step: LearningPathStep;
    } {
  const { db, actor, learningPathId, stepId, questionId } = params;

  const question = db.questions.find(
    (q) => q.questionId === questionId && q.schoolId === actor.schoolId
  );
  if (!question) {
    return {
      allowed: false,
      status: 404,
      statusCode: 404,
      code: 'QUESTION_NOT_FOUND',
      error: 'Không tìm thấy câu hỏi trong ngân hàng của trường.',
    };
  }

  if (
    question.primaryUse === PrimaryUse.PRE_TEST ||
    question.primaryUse === PrimaryUse.POST_TEST
  ) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'QUESTION_NOT_ALLOWED_IN_TASK',
      error: 'Câu hỏi thuộc đề Pre-test / Post-test độc lập, không được nộp qua nhiệm vụ luyện tập.',
    };
  }

  const pathObj = learningPathId
    ? db.learningPaths.find(
        (p) => p.pathId === learningPathId && p.schoolId === actor.schoolId
      )
    : db.learningPaths.find(
        (p) => p.studentId === actor.userId && p.schoolId === actor.schoolId
      );

  if (!pathObj) {
    return {
      allowed: false,
      status: 404,
      statusCode: 404,
      code: 'PATH_NOT_FOUND',
      error: 'Không tìm thấy lộ trình học tập cá nhân hóa.',
    };
  }

  if (actor.role === Role.STUDENT && pathObj.studentId !== actor.userId) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'PATH_OWNERSHIP_VIOLATION',
      error: 'Bạn không được phép nộp bài trên lộ trình học tập của học sinh khác.',
    };
  }

  if (
    pathObj.status === PathStatus.WAITING_APPROVAL ||
    pathObj.status === PathStatus.REJECTED
  ) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'STEP_NOT_AVAILABLE',
      error: 'Lộ trình học tập chưa được Giáo viên phê duyệt.',
    };
  }

  const step = stepId
    ? pathObj.steps.find((s) => s.stepId === stepId)
    : pathObj.steps.find((s) => s.questionIds.includes(question.questionId));

  if (!step) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'STEP_NOT_FOUND',
      error: 'Bước nhiệm vụ không tồn tại trong lộ trình học tập của bạn.',
    };
  }

  if (step.status === 'LOCKED') {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'STEP_LOCKED',
      error: 'Bước nhiệm vụ này đang khóa. Vui lòng hoàn thành bước trước đó.',
    };
  }

  if (!step.questionIds.includes(question.questionId)) {
    return {
      allowed: false,
      status: 403,
      statusCode: 403,
      code: 'QUESTION_NOT_ASSIGNED',
      error: 'Câu hỏi này không thuộc bước nhiệm vụ hiện tại.',
    };
  }

  return {
    allowed: true,
    status: 200,
    statusCode: 200,
    question,
    path: pathObj,
    step,
  };
}

/**
 * FIX 04. Sanitizes any feedback/hint/message string so it NEVER reveals the correctAnswer or solution.
 */
export function sanitizeStudentFeedbackText(
  rawText: string | undefined | null,
  correctAnswer: string,
  solution?: string
): string {
  const fallback = 'Em hãy kiểm tra lại quy tắc dấu và từng bước biến đổi của biểu thức.';
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  let text = rawText.trim();
  const cleanAns = String(correctAnswer || '').trim();
  const strippedOptionPrefixAns = cleanAns.replace(/^[A-D]\.\s*/i, '').trim();

  // Remove explicit answer-leakage phrases
  text = text.replace(/thay\s+vì\s+[^.!?\n]+/gi, '');
  text = text.replace(/đáp\s+án\s+đúng\s*(là|:)\s*[^.!?\n]+/gi, '');
  text = text.replace(/kết\s+quả\s+đúng\s*(là|:)\s*[^.!?\n]+/gi, '');
  text = text.replace(/\(đáp\s+án\s+đúng[^)]*\)/gi, '');

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (cleanAns.length >= 2) {
    text = text.replace(new RegExp(escapeRegExp(cleanAns), 'gi'), 'biểu thức chuẩn');
  }
  if (strippedOptionPrefixAns.length >= 2 && strippedOptionPrefixAns !== cleanAns) {
    text = text.replace(new RegExp(escapeRegExp(strippedOptionPrefixAns), 'gi'), 'biểu thức chuẩn');
  }
  if (solution && solution.trim().length >= 6) {
    text = text.replace(new RegExp(escapeRegExp(solution.trim()), 'gi'), '');
  }

  text = text.replace(/\s{2,}/g, ' ').trim();
  if (!text || text.length < 5) {
    return fallback;
  }
  return text;
}

/**
 * 1C. Returns the set of classIds in the actor's school that a Teacher is assigned to.
 */
export function getTeacherAllowedClassIds(
  actor: UserAccount,
  db: PersistentDatabaseSchema
): Set<string> {
  const schoolId = actor.schoolId;
  if (actor.role === Role.ADMIN) {
    return new Set(
      db.classes.filter((c) => c.schoolId === schoolId).map((c) => c.classId)
    );
  }

  if (actor.role !== Role.TEACHER) {
    return new Set();
  }

  const assignedNames = new Set(
    (actor.assignedClassNames && actor.assignedClassNames.length > 0
      ? actor.assignedClassNames
      : actor.className
      ? [actor.className]
      : []
    )
      .filter(Boolean)
      .map((name) => String(name).trim().toUpperCase())
  );

  const memberClassIds = new Set(
    db.classMembers
      .filter(
        (cm) =>
          cm.schoolId === schoolId &&
          cm.userId === actor.userId &&
          cm.memberRole === 'TEACHER'
      )
      .map((cm) => cm.classId)
  );

  const allowed = new Set<string>();
  for (const cls of db.classes) {
    if (cls.schoolId !== schoolId) continue;
    if (
      cls.teacherId === actor.userId ||
      (actor.classId && cls.classId === actor.classId) ||
      assignedNames.has(cls.name.trim().toUpperCase()) ||
      memberClassIds.has(cls.classId)
    ) {
      allowed.add(cls.classId);
    }
  }

  return allowed;
}

/**
 * 1C. authorizeTeacherForClass
 * Verifies that a Teacher (or Admin in the same school) is authorized for the given classId.
 */
export function authorizeTeacherForClass(
  actor: UserAccount,
  classId: string | undefined | null,
  db: PersistentDatabaseSchema
): boolean {
  if (!classId || typeof classId !== 'string') return false;

  const targetClass = db.classes.find((c) => c.classId === classId);
  if (!targetClass || targetClass.schoolId !== actor.schoolId) {
    return false;
  }

  if (actor.role === Role.ADMIN) {
    return true;
  }

  if (actor.role === Role.TEACHER) {
    const allowedClassIds = getTeacherAllowedClassIds(actor, db);
    return allowedClassIds.has(classId);
  }

  return false;
}

/**
 * 1C. authorizeTeacherForStudent
 * Verifies that a Teacher is authorized to access a Student's data.
 * CRITICAL RULE: Teacher MUST NOT access students with classId = null/undefined
 * or students belonging to another class or school.
 */
export function authorizeTeacherForStudent(
  actor: UserAccount,
  studentId: string | undefined | null,
  db: PersistentDatabaseSchema
): boolean {
  if (!studentId || typeof studentId !== 'string') return false;

  const student = db.users.find(
    (u) => u.userId === studentId && u.role === Role.STUDENT
  );
  if (!student || student.schoolId !== actor.schoolId) {
    return false;
  }

  if (actor.role === Role.ADMIN) {
    return true;
  }

  if (actor.role === Role.TEACHER) {
    // Teacher MUST NOT see students with classId = null / undefined
    if (!student.classId) {
      return false;
    }
    return authorizeTeacherForClass(actor, student.classId, db);
  }

  return false;
}

/**
 * 1C. authorizeTeacherForAssessment
 * Verifies that a Teacher is authorized for the class that owns the assessment.
 */
export function authorizeTeacherForAssessment(
  actor: UserAccount,
  assessmentId: string | undefined | null,
  db: PersistentDatabaseSchema
): boolean {
  if (!assessmentId || typeof assessmentId !== 'string') return false;

  const assessment = db.assessments.find((a) => a.assessmentId === assessmentId);
  if (!assessment || assessment.schoolId !== actor.schoolId) {
    return false;
  }

  if (actor.role === Role.ADMIN) {
    return true;
  }

  if (actor.role === Role.TEACHER) {
    return authorizeTeacherForClass(actor, assessment.classId, db);
  }

  return false;
}

/**
 * 1C. authorizeTeacherForExperiment
 * Verifies that a Teacher is authorized for the class that owns the experiment.
 */
export function authorizeTeacherForExperiment(
  actor: UserAccount,
  experimentId: string | undefined | null,
  db: PersistentDatabaseSchema
): boolean {
  if (!experimentId || typeof experimentId !== 'string') return false;

  const exp = db.experiments.find((e) => e.experimentId === experimentId);
  if (!exp || exp.schoolId !== actor.schoolId) {
    return false;
  }

  if (actor.role === Role.ADMIN) {
    return true;
  }

  if (actor.role === Role.TEACHER) {
    return authorizeTeacherForClass(actor, exp.classId, db);
  }

  return false;
}

/**
 * 1C. authorizeTeacherForLearningPath
 * Verifies that a Teacher is authorized for the student/class that owns the learning path.
 */
export function authorizeTeacherForLearningPath(
  actor: UserAccount,
  pathId: string | undefined | null,
  db: PersistentDatabaseSchema
): boolean {
  if (!pathId || typeof pathId !== 'string') return false;

  const pathObj = db.learningPaths.find((p) => p.pathId === pathId);
  if (!pathObj || pathObj.schoolId !== actor.schoolId) {
    return false;
  }

  if (actor.role === Role.ADMIN) {
    return true;
  }

  if (actor.role === Role.TEACHER) {
    return (
      authorizeTeacherForStudent(actor, pathObj.studentId, db) &&
      (!pathObj.classId || authorizeTeacherForClass(actor, pathObj.classId, db))
    );
  }

  return false;
}

