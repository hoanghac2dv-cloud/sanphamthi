import {
  AcademicYear,
  AIRunLog,
  Assessment,
  AssessmentAttempt,
  AuditLogRecord,
  ClassRoom,
  Competency,
  CompetencyCode,
  CompetencySnapshot,
  DetectedErrorRecord,
  ErrorTagCode,
  ErrorType,
  Experiment,
  ExperimentCaseStudy,
  ExperimentEvidence,
  ExperimentState,
  ExperimentStudentMetric,
  FeedbackResponseRecord,
  ImportValidationResult,
  LearningPath,
  PrimaryUse,
  Question,
  Role,
  School,
  Subject,
  TeacherOverride,
  Topic,
  UserAccount,
} from '../types';

const TOKEN_KEY = 'aipath_auth_token_v1';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Lỗi kết nối máy chủ (${res.status})`) as Error & {
      data?: Record<string, unknown>;
    };
    err.data = data;
    throw err;
  }
  return data as T;
}

export interface BootstrapPayload {
  role: Role;
  schools: School[];
  academicYears: AcademicYear[];
  classes?: ClassRoom[];
  users?: UserAccount[];
  subjects: Subject[];
  topics: Topic[];
  competencies: Competency[];
  errorTypes: ErrorType[];
  questions: Question[];
  assessments: Assessment[];
  attempts: AssessmentAttempt[];
  competencySnapshots: CompetencySnapshot[];
  learningPaths: LearningPath[];
  detectedErrors: DetectedErrorRecord[];
  teacherOverrides?: TeacherOverride[];
  experiments: Experiment[];
  experimentStudentMetrics?: ExperimentStudentMetric[];
  feedbackResponses: FeedbackResponseRecord[];
  experimentCaseStudies?: ExperimentCaseStudy[];
  experimentEvidence?: ExperimentEvidence[];
  aiRuns?: AIRunLog[];
  auditLogs?: AuditLogRecord[];
  progressHistory: {
    studentId: string;
    date: string;
    label: string;
    overall: number;
    foundation: number;
    recognition: number;
    transformation: number;
    calcAccuracy: number;
    application: number;
    signErrorCount?: number;
  }[];
}

export const apiClient = {
  loginWithUsername(username: string, password: string) {
    return apiRequest<{ token: string; user: UserAccount; internalAuthEmail: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  syncGoogleUser(idToken: string) {
    return apiRequest<{ token: string; user: UserAccount }>('/api/auth/google-sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idToken }),
    });
  },

  getMe() {
    return apiRequest<{ user: UserAccount }>('/api/auth/me');
  },

  getBootstrap() {
    return apiRequest<BootstrapPayload>('/api/bootstrap');
  },

  // Admin: Teachers
  createTeacherManual(payload: {
    code: string;
    fullName: string;
    username: string;
    email?: string;
    phone?: string;
    subjectCode?: string;
    className?: string;
    status?: string;
  }) {
    return apiRequest<{ user: UserAccount; oneTimeTempPassword: string }>('/api/admin/teachers/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  validateTeacherImport(rows: Record<string, unknown>[], fileName: string) {
    return apiRequest<ImportValidationResult>('/api/admin/teachers/validate-import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName }),
    });
  },

  commitTeacherImport(rows: Record<string, unknown>[], fileName: string) {
    return apiRequest<{
      totalCreated: number;
      assignedCount: number;
      needsCheckCount: number;
      createdTeachers: { user: UserAccount; tempPassword: string; needsAssignmentCheck: boolean }[];
    }>('/api/admin/teachers/commit-import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName }),
    });
  },

  updateTeacherAssignment(
    userId: string,
    payload: { action: 'CONFIRM' | 'UPDATE' | 'UNASSIGN'; subjectCode?: string; className?: string }
  ) {
    return apiRequest<{ user: UserAccount }>(`/api/admin/teachers/${userId}/assignment`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Admin: Students & Classes
  createStudentManual(payload: {
    code: string;
    fullName: string;
    username: string;
    dob?: string;
    gender?: string;
    className: string;
    grade?: number;
    email?: string;
    status?: string;
  }) {
    return apiRequest<{ user: UserAccount; oneTimeTempPassword: string }>('/api/admin/students/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  validateStudentImport(rows: Record<string, unknown>[], fileName: string) {
    return apiRequest<ImportValidationResult>('/api/admin/students/validate-import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName }),
    });
  },

  commitStudentImport(rows: Record<string, unknown>[], fileName: string) {
    return apiRequest<{
      totalCreated: number;
      createdStudents: { user: UserAccount; tempPassword: string }[];
    }>('/api/admin/students/commit-import', {
      method: 'POST',
      body: JSON.stringify({ rows, fileName }),
    });
  },

  createClass(payload: { name: string; grade?: number; teacherId?: string }) {
    return apiRequest<{ classRoom: ClassRoom }>('/api/admin/classes/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateClass(classId: string, payload: { name: string; grade: number; teacherId?: string }) {
    return apiRequest<{ classRoom: ClassRoom }>(`/api/admin/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteClass(classId: string) {
    return apiRequest<{ success: boolean; deletedClassId: string }>(`/api/admin/classes/${classId}`, {
      method: 'DELETE',
    });
  },

  createSubject(payload: { code: string; name: string; grade: number; description?: string }) {
    return apiRequest<{ subject: Subject }>('/api/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSubject(
    subjectId: string,
    payload: { code: string; name: string; grade: number; description?: string }
  ) {
    return apiRequest<{ subject: Subject }>(`/api/admin/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteSubject(subjectId: string) {
    return apiRequest<{ success: boolean; deletedSubjectId: string }>(
      `/api/admin/subjects/${subjectId}`,
      {
        method: 'DELETE',
      }
    );
  },

  createTopic(payload: {
    code: string;
    name: string;
    subjectCode: string;
    grade: number;
    description?: string;
    knowledgeSummary?: string;
  }) {
    return apiRequest<{ topic: Topic }>('/api/admin/topics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTopic(
    topicId: string,
    payload: {
      code: string;
      name: string;
      subjectCode: string;
      grade: number;
      description?: string;
      knowledgeSummary?: string;
    }
  ) {
    return apiRequest<{ topic: Topic }>(`/api/admin/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTopic(topicId: string) {
    return apiRequest<{ success: boolean; deletedTopicId: string }>(`/api/admin/topics/${topicId}`, {
      method: 'DELETE',
    });
  },

  uploadTopicKnowledge(
    topicId: string,
    payload: {
      title: string;
      knowledgeType: 'CORE_THEORY' | 'FORMULA_RULES' | 'SOLVED_EXAMPLES' | 'FILE_DOCUMENT';
      contentText: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileDataUrl?: string;
    }
  ) {
    return apiRequest<{ topic: Topic }>(`/api/admin/topics/${topicId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTopicKnowledge(
    topicId: string,
    knowledgeId: string,
    payload: {
      title: string;
      knowledgeType: 'CORE_THEORY' | 'FORMULA_RULES' | 'SOLVED_EXAMPLES' | 'FILE_DOCUMENT';
      contentText: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileDataUrl?: string;
    }
  ) {
    return apiRequest<{ topic: Topic }>(`/api/admin/topics/${topicId}/knowledge/${knowledgeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTopicKnowledge(topicId: string, knowledgeId: string) {
    return apiRequest<{ success: boolean; topic: Topic }>(
      `/api/admin/topics/${topicId}/knowledge/${knowledgeId}`,
      {
        method: 'DELETE',
      }
    );
  },

  toggleUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE') {
    return apiRequest<{ user: UserAccount }>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  updateUser(
    userId: string,
    payload: {
      code?: string;
      fullName?: string;
      username?: string;
      email?: string;
      phone?: string;
      dob?: string;
      gender?: string;
      subjectCode?: string;
      className?: string;
      status?: UserAccount['status'];
      newPassword?: string;
    }
  ) {
    return apiRequest<{ user: UserAccount }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteUser(userId: string) {
    return apiRequest<{ success: boolean; deletedUserId: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  updateSchool(
    schoolId: string,
    payload: {
      name: string;
      code: string;
      address?: string;
      provinceCity?: string;
      principalName?: string;
      phone?: string;
      email?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ) {
    return apiRequest<{ school: School }>(`/api/admin/schools/${schoolId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  createAcademicYear(name: string, isCurrent: boolean) {
    return apiRequest<{ academicYear: AcademicYear }>('/api/admin/academic-years', {
      method: 'POST',
      body: JSON.stringify({ name, isCurrent }),
    });
  },

  updateAcademicYear(
    academicYearId: string,
    payload: { name?: string; isCurrent?: boolean; status?: 'ACTIVE' | 'ARCHIVED' }
  ) {
    return apiRequest<{ academicYear: AcademicYear }>(
      `/api/admin/academic-years/${academicYearId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  // Questions & Assessments
  generateAiQuestions(payload: {
    competency: CompetencyCode;
    difficulty: number;
    targetError: ErrorTagCode;
    primaryUse: PrimaryUse;
    count: number;
  }) {
    return apiRequest<{ questions: Question[]; aiFallbackUsed?: boolean; aiWarning?: string }>(
      '/api/questions/ai-generate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  approveAiQuestion(
    questionId: string,
    payload: { action: 'APPROVE' | 'MODIFY' | 'REJECT'; questionText?: string; correctAnswer?: string; solution?: string }
  ) {
    return apiRequest<{ success: boolean; question: Question | null }>(`/api/questions/${questionId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  createManualQuestion(payload: Partial<Question> & { hint1?: string; hint2?: string; hint3?: string }) {
    return apiRequest<{ question: Question }>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createAssessment(payload: {
    title: string;
    assessmentType: PrimaryUse;
    classId: string;
    competencies: CompetencyCode[];
    questionIds: string[];
    durationMinutes: number;
  }) {
    return apiRequest<{ assessment: Assessment }>('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAssessmentWithQuestions(assessmentId: string) {
    return apiRequest<{ assessment: Assessment; questions: Question[] }>(
      `/api/assessments/${assessmentId}`
    );
  },

  // Student Diagnostic / Pre / Post Attempts
  saveAttemptProgress(payload: {
    assessmentId: string;
    currentQuestionIndex: number;
    flaggedQuestionIds: string[];
    answers: Record<string, string>;
  }) {
    return apiRequest<{ attempt: AssessmentAttempt }>('/api/attempts/save-progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitAttempt(assessmentId: string, answers: Record<string, string>) {
    return apiRequest<{
      attempt: AssessmentAttempt;
      snapshot: CompetencySnapshot;
      learningPath?: LearningPath;
    }>('/api/attempts/submit', {
      method: 'POST',
      body: JSON.stringify({ assessmentId, answers }),
    });
  },

  // Learning Paths & Adaptive Tasks
  submitTeacherPathDecision(
    pathId: string,
    payload: { action: 'APPROVE' | 'MODIFY' | 'REJECT'; reason: string; updatedSteps?: LearningPath['steps'] }
  ) {
    return apiRequest<{ learningPath: LearningPath }>(`/api/paths/${pathId}/teacher-decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  requestHint(
    questionId: string,
    hintLevel: 1 | 2 | 3,
    studentCurrentInput?: string,
    context?: { learningPathId?: string; stepId?: string }
  ) {
    return apiRequest<{ hintLevel: 1 | 2 | 3; hintText: string; aiWarning?: string }>('/api/tasks/hint', {
      method: 'POST',
      body: JSON.stringify({
        questionId,
        hintLevel,
        studentCurrentInput,
        learningPathId: context?.learningPathId,
        stepId: context?.stepId,
      }),
    });
  },

  submitTaskAnswer(payload: {
    pathId?: string;
    learningPathId?: string;
    stepId?: string;
    questionId: string;
    studentAnswer: string;
    hintsUsed: number;
  }) {
    return apiRequest<{
      correct?: boolean;
      isCorrect: boolean;
      feedback?: string;
      feedbackMessage: string;
      hintAvailable?: boolean;
      solution?: string;
      aiAnalysis?: {
        errorType: string;
        confidence: number;
        evidence: string;
        studentFeedback: string;
        nextAction: string;
      };
      adaptiveAdjustment: {
        nextDifficulty: number;
        action: string;
        accuracyPercent: number;
        avgHintsUsed: number;
      };
      learningPath?: LearningPath;
    }>('/api/tasks/submit-answer', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        learningPathId: payload.learningPathId || payload.pathId,
      }),
    });
  },

  submitCheckpoint(pathId: string, answers: Record<string, string>) {
    return apiRequest<{
      checkpointScore: number;
      reroute: {
        decision: string;
        newConsecutiveLowCheckpoints: number;
        allowAutoGenerateMoreTasks: boolean;
        messageVi: string;
      };
      learningPath: LearningPath;
      snapshot: CompetencySnapshot;
    }>('/api/checkpoints/submit', {
      method: 'POST',
      body: JSON.stringify({ pathId, answers }),
    });
  },

  // Class Grouping & AI Intervention
  updateClassGrouping(classId: string, studentId: string, group: CompetencySnapshot['suggestedGroup']) {
    return apiRequest<{ snapshot: CompetencySnapshot }>(`/api/classes/${classId}/grouping`, {
      method: 'PUT',
      body: JSON.stringify({ studentId, group }),
    });
  },

  requestClassAiInsight(classId: string) {
    return apiRequest<{ finding: string; evidence: string; suggestion: string }>(
      `/api/classes/${classId}/ai-insight`,
      { method: 'POST' }
    );
  },

  // Experiments
  validateEquivalence(preAssessmentId: string, postAssessmentId: string) {
    return apiRequest<{
      equivalenceScore: number;
      hasOverlappingQuestions: boolean;
      details: {
        competencyMatchPercent: number;
        difficultyMatchPercent: number;
        pointsMatchPercent: number;
        questionTypeMatchPercent: number;
        countMatchPercent: number;
      };
      isValidForExperiment: boolean;
    }>('/api/experiments/validate-equivalence', {
      method: 'POST',
      body: JSON.stringify({ preAssessmentId, postAssessmentId }),
    });
  },

  createExperiment(payload: {
    title: string;
    description: string;
    classId: string;
    targetCompetencies: CompetencyCode[];
    preTestAssessmentId: string;
    postTestAssessmentId: string;
    dataSource: 'DEMO' | 'REAL';
    equivalenceApprovedByTeacher: boolean;
  }) {
    return apiRequest<{ experiment: Experiment }>('/api/experiments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  transitionExperimentState(experimentId: string, targetState: ExperimentState) {
    return apiRequest<{ experiment: Experiment }>(`/api/experiments/${experimentId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetState }),
    });
  },

  syncExperimentMetrics(experimentId: string) {
    return apiRequest<{ experiment: Experiment; metrics: ExperimentStudentMetric[] }>(
      `/api/experiments/${experimentId}/sync-metrics`,
      {
        method: 'POST',
      }
    );
  },

  submitExperimentFeedback(
    experimentId: string,
    payload: { likertScores: number[]; openAnswer1: string; openAnswer2: string }
  ) {
    return apiRequest<{ feedback: FeedbackResponseRecord }>(`/api/experiments/${experimentId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  approveCaseStudy(experimentId: string, caseId: string, teacherApproved: boolean, teacherNotes?: string) {
    return apiRequest<{ caseStudy: ExperimentCaseStudy }>(
      `/api/experiments/${experimentId}/case-studies/${caseId}/approve`,
      {
        method: 'PUT',
        body: JSON.stringify({ teacherApproved, teacherNotes }),
      }
    );
  },

  uploadExperimentEvidence(
    experimentId: string,
    payload: {
      title: string;
      evidenceType: ExperimentEvidence['evidenceType'];
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileDataUrl?: string;
      notes: string;
      consentConfirmed: boolean;
    }
  ) {
    return apiRequest<{ evidence: ExperimentEvidence }>(`/api/experiments/${experimentId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logReportExport(format: 'EXCEL' | 'PDF', experimentId: string) {
    return apiRequest<{ ok: boolean }>('/api/reports/log-export', {
      method: 'POST',
      body: JSON.stringify({ format, experimentId }),
    });
  },
};
