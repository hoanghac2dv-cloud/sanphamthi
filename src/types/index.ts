export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export enum CompetencyCode {
  FOUNDATION = 'FOUNDATION',
  RECOGNITION = 'RECOGNITION',
  TRANSFORMATION = 'TRANSFORMATION',
  CALC_ACCURACY = 'CALC_ACCURACY',
  APPLICATION = 'APPLICATION',
}

export enum ErrorTagCode {
  CONCEPT_ERROR = 'CONCEPT_ERROR',
  FORMULA_ERROR = 'FORMULA_ERROR',
  PROCEDURE_ERROR = 'PROCEDURE_ERROR',
  SIGN_ERROR = 'SIGN_ERROR',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  APPLICATION_ERROR = 'APPLICATION_ERROR',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_BLANK = 'FILL_BLANK',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ERROR_ANALYSIS = 'ERROR_ANALYSIS',
}

export enum PrimaryUse {
  PRE_TEST = 'PRE_TEST',
  POST_TEST = 'POST_TEST',
  DIAGNOSTIC = 'DIAGNOSTIC',
  PRACTICE = 'PRACTICE',
  ERROR_CORRECTION = 'ERROR_CORRECTION',
  CHECKPOINT = 'CHECKPOINT',
}

export enum MasteryLevel {
  NEEDS_SUPPORT = 'NEEDS_SUPPORT',
  DEVELOPING = 'DEVELOPING',
  ACHIEVED = 'ACHIEVED',
  MASTERED = 'MASTERED',
}

export enum PathStatus {
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  APPROVED = 'APPROVED',
  MODIFIED = 'MODIFIED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  TEACHER_INTERVENTION_REQUIRED = 'TEACHER_INTERVENTION_REQUIRED',
}

export enum ExperimentState {
  DRAFT = 'DRAFT',
  READY = 'READY',
  PRETEST_RUNNING = 'PRETEST_RUNNING',
  INTERVENTION_RUNNING = 'INTERVENTION_RUNNING',
  POSTTEST_RUNNING = 'POSTTEST_RUNNING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export type DataSourceType = 'DEMO' | 'REAL';

export interface School {
  schoolId: string;
  name: string;
  code: string;
  address?: string;
  provinceCity?: string;
  principalName?: string;
  phone?: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AcademicYear {
  academicYearId: string;
  schoolId: string;
  name: string;
  isCurrent: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UserAccount {
  userId: string;
  schoolId: string;
  code: string; // Ma_Giao_Vien or Ma_Hoc_Sinh or Admin code
  username: string;
  fullName: string;
  role: Role;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  classId?: string;
  className?: string;
  grade?: number;
  academicYearId?: string;
  subjectCode?: string;
  assignedClassNames?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'DISABLED' | 'ARCHIVED' | 'NEEDS_ASSIGNMENT_CHECK';
  mustChangePassword?: boolean;
  dataSource: DataSourceType;
  pseudonymId: string; // e.g. student_a13f
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ClassRoom {
  classId: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  grade: number;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ClassMember {
  memberId: string;
  schoolId: string;
  classId: string;
  userId: string;
  memberRole: 'TEACHER' | 'STUDENT';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Subject {
  subjectId: string;
  schoolId: string;
  code: string;
  name: string;
  grade: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TopicKnowledgeItem {
  knowledgeId: string;
  title: string;
  knowledgeType: 'CORE_THEORY' | 'FORMULA_RULES' | 'SOLVED_EXAMPLES' | 'FILE_DOCUMENT';
  contentText: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileDataUrl?: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface Topic {
  topicId: string;
  schoolId: string;
  code: string;
  name: string;
  subjectCode: string;
  grade: number;
  description?: string;
  knowledgeSummary?: string;
  knowledgeItems?: TopicKnowledgeItem[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Competency {
  competencyId: string;
  schoolId: string;
  code: CompetencyCode;
  name: string;
  description: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ErrorType {
  errorTypeId: string;
  schoolId: string;
  code: ErrorTagCode;
  name: string;
  description: string;
  remediationTip: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Question {
  questionId: string;
  schoolId: string;
  grade: number;
  subject: string;
  topic: string;
  competency: CompetencyCode;
  difficulty: 1 | 2 | 3 | 4 | 5;
  errorTags: ErrorTagCode[];
  questionType: QuestionType;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  solution: string;
  hints: {
    level1: string;
    level2: string;
    level3: string;
  };
  primaryUse: PrimaryUse;
  allowedUses: PrimaryUse[];
  source: string;
  aiGenerated: boolean;
  teacherApproved: boolean;
  estimatedSeconds: number;
  points: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 1B. StudentQuestionDTO: Safe DTO returned to Students before submission.
 * Strictly strips correctAnswer, solution, gradingKey, rubric, expectedAnswer,
 * answerExplanation, internal errorTags, hints, and teacherNotes.
 */
export interface StudentQuestionDTO {
  id: string;
  questionId: string;
  schoolId: string;
  grade: number;
  subject: string;
  topic: string;
  competency: CompetencyCode;
  difficulty: 1 | 2 | 3 | 4 | 5;
  questionType: QuestionType;
  questionText: string;
  options?: string[];
  primaryUse: PrimaryUse;
  allowedUses: PrimaryUse[];
  estimatedSeconds: number;
  points: number;
  media?: string;
  progressMetadata?: Record<string, unknown>;
  // Never populated on StudentQuestionDTO; optional undefined for TS union compatibility
  correctAnswer?: undefined;
  solution?: undefined;
  errorTags?: undefined;
  hints?: undefined;
}

export interface Assessment {
  assessmentId: string;
  schoolId: string;
  title: string;
  assessmentType: PrimaryUse;
  classId: string;
  topicCode: string;
  competencies: CompetencyCode[];
  questionIds: string[];
  durationMinutes: number;
  totalPoints: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  experimentId?: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AssessmentAttempt {
  attemptId: string;
  schoolId: string;
  experimentId?: string;
  assessmentId: string;
  assessmentType: PrimaryUse;
  studentId: string;
  studentName: string;
  classId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  currentQuestionIndex: number;
  flaggedQuestionIds: string[];
  answers: Record<string, string>;
  scorePercent?: number;
  totalPointsEarned?: number;
  totalPointsPossible?: number;
  competencyBreakdown?: Record<CompetencyCode, number>;
  detectedErrorCounts?: Partial<Record<ErrorTagCode, number>>;
  startedAt: string;
  submittedAt?: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface StudentResponse {
  responseId: string;
  schoolId: string;
  attemptId: string;
  assessmentId: string;
  studentId: string;
  questionId: string;
  competency: CompetencyCode;
  difficulty: number;
  studentAnswer: string;
  isCorrect: boolean;
  hintsUsed: number;
  detectedErrorTag?: ErrorTagCode;
  aiAnalysis?: {
    errorType: ErrorTagCode | 'NEED_MORE_EVIDENCE';
    confidence: number;
    evidence: string;
    studentFeedback: string;
    nextAction: string;
  };
  timeSpentSeconds: number;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedErrorRecord {
  errorId: string;
  schoolId: string;
  studentId: string;
  errorTag: ErrorTagCode;
  errorName: string;
  occurrencesInLast10: number;
  totalOccurrences: number;
  isRecurring: boolean;
  status: 'ACTIVE' | 'IMPROVING' | 'RESOLVED';
  lastDetectedAt: string;
  sampleQuestionId?: string;
  sampleStudentAnswer?: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyMasteryItem {
  competency: CompetencyCode;
  name: string;
  score: number; // 0 - 100
  initialScore: number; // baseline score
  confidence: number; // 0 - 1
  confidenceStatus: 'NEED_MORE_EVIDENCE' | 'CAUTIOUS' | 'SUFFICIENT';
  level: MasteryLevel;
  levelLabelVi: 'Cần hỗ trợ' | 'Đang hình thành' | 'Đã đạt' | 'Thành thạo';
  signals: {
    accuracy?: number;
    checkpoint?: number;
    independence?: number;
    stability?: number;
  };
}

export interface CompetencySnapshot {
  snapshotId: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  classId: string;
  sourceType: 'DIAGNOSTIC' | 'PRE_TEST' | 'TASK_UPDATE' | 'CHECKPOINT' | 'POST_TEST';
  overallMastery: number;
  overallConfidence: number;
  competencies: Record<CompetencyCode, CompetencyMasteryItem>;
  recurringErrors: ErrorTagCode[];
  aiInsightStudent: string;
  aiInsightTeacher: string;
  suggestedGroup: 'GROUP_A_FOUNDATION' | 'GROUP_B_TRANSFORMATION' | 'GROUP_C_APPLICATION' | 'GROUP_D_ADVANCED';
  teacherGroupOverride?: 'GROUP_A_FOUNDATION' | 'GROUP_B_TRANSFORMATION' | 'GROUP_C_APPLICATION' | 'GROUP_D_ADVANCED';
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface LearningPathStep {
  stepId: string;
  schoolId: string;
  pathId: string;
  studentId: string;
  stepOrder: number;
  stepType: 'REVIEW' | 'PRACTICE' | 'ERROR_CORRECTION' | 'APPLICATION' | 'CHECKPOINT';
  title: string;
  description: string;
  targetCompetency: CompetencyCode;
  targetErrorTag?: ErrorTagCode;
  targetDifficulty: 1 | 2 | 3 | 4 | 5;
  questionIds: string[];
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  scorePercent?: number;
  hintsUsedCount?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPath {
  pathId: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  classId: string;
  topicCode: string;
  status: PathStatus;
  cycleNumber: number;
  consecutiveLowCheckpoints: number;
  triggerReasons: {
    weakCompetencies: { competency: CompetencyCode; score: number }[];
    recurringErrors: { errorTag: ErrorTagCode; count: number }[];
  };
  aiExplanation: {
    studentMessage: string;
    teacherReason: string;
  };
  steps: LearningPathStep[];
  approvedBy?: string;
  approvedAt?: string;
  teacherNote?: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TeacherOverride {
  overrideId: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  targetType: 'LEARNING_PATH' | 'AI_QUESTION' | 'CLASS_GROUPING' | 'CASE_STUDY';
  targetId: string;
  studentId?: string;
  action: 'APPROVE' | 'MODIFY' | 'REJECT';
  reason: string;
  previousState?: string;
  newState?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Experiment {
  experimentId: string;
  schoolId: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  topicCode: string;
  targetCompetencies: CompetencyCode[];
  preTestAssessmentId: string;
  postTestAssessmentId: string;
  equivalenceScore: number; // e.g. 91%
  equivalenceApprovedByTeacher: boolean;
  state: ExperimentState;
  dataSource: DataSourceType;
  participantCount: number;
  preTestSubmittedCount: number;
  preTestInProgressCount: number;
  postTestSubmittedCount: number;
  postTestInProgressCount: number;
  baselineLockedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ExperimentBaselineRecord {
  attemptId: string;
  assessmentId: string;
  scorePercent: number;
  competencyBreakdown: Record<CompetencyCode, number>;
  errorCount: number;
  submittedAt: string;
}

export interface ExperimentOutcomeRecord {
  attemptId: string;
  assessmentId: string;
  scorePercent: number;
  competencyBreakdown: Record<CompetencyCode, number>;
  errorCount: number;
  submittedAt: string;
  absoluteGain: number | null;
  normalizedGain: number | null | 'N/A';
  errorReductionPercent: number | 'N/A';
}

export interface ExperimentStudentMetric {
  metricId: string;
  schoolId: string;
  experimentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  status: 'COMPLETED' | 'INCOMPLETE';
  preAttemptId?: string | null;
  postAttemptId?: string | null;
  preSubmittedAt?: string | null;
  postSubmittedAt?: string | null;
  baseline?: ExperimentBaselineRecord | null;
  outcome?: ExperimentOutcomeRecord | null;
  preScore: number | null;
  postScore: number | null;
  absoluteGain: number | null;
  normalizedGain: number | null | 'N/A';
  competencyPre: Record<CompetencyCode, number> | null;
  competencyPost: Record<CompetencyCode, number> | null;
  preErrorCount: number;
  postErrorCount: number;
  errorReductionPercent: number | 'N/A';
  assignedSteps: number;
  completedSteps: number;
  pathCompletionPercent: number;
  hintsUsed: number;
  checkpointScore: number | null;
  teacherInterventions: number;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackResponseRecord {
  feedbackResponseId: string;
  schoolId: string;
  experimentId: string;
  respondentId: string;
  respondentName: string;
  respondentRole: 'STUDENT' | 'TEACHER';
  likertScores: number[]; // 5 items 1-5
  openAnswer1: string; // Điều thích nhất / Giá trị lớn nhất
  openAnswer2: string; // Điều cần cải thiện / Khó khăn lớn nhất
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentCaseStudy {
  caseId: string;
  schoolId: string;
  experimentId: string;
  studentId: string;
  studentName: string;
  pseudonymId: string;
  category: 'HIGH_GAIN' | 'CLEAR_ERROR_REDUCTION' | 'HIGH_SUPPORT_ACHIEVED' | 'TEACHER_INTERVENTION';
  categoryLabelVi: string;
  teacherApproved: boolean;
  beforeSummary: {
    overallPre: number;
    applicationPre: number;
    transformationPre: number;
    signErrorPre: number;
    procedureErrorPre: number;
  };
  path5ProcessSummary: {
    stepsCompleted: number;
    stepsAssigned: number;
    hintsUsed: number;
    errorCorrectionTasks: number;
    checkpointScore: number;
    teacherNotes: string;
  };
  afterSummary: {
    overallPost: number;
    applicationPost: number;
    transformationPost: number;
    signErrorPost: number;
    procedureErrorPost: number;
  };
  narrativeSummary: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentEvidence {
  evidenceId: string;
  schoolId: string;
  experimentId: string;
  title: string;
  evidenceType: 'IMAGE' | 'VIDEO' | 'SCREENSHOT' | 'DOCUMENT' | 'NOTE';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileDataUrl?: string;
  notes: string;
  consentConfirmed: boolean;
  uploadedBy: string;
  uploadedByName: string;
  dataSource: DataSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface AIRunLog {
  runId: string;
  schoolId: string;
  taskType: 'ERROR_ANALYZER' | 'HINT_GENERATOR' | 'PATH_EXPLAINER' | 'QUESTION_GENERATOR' | 'CLASS_INSIGHT';
  model: string;
  promptVersion: string;
  latencyMs: number;
  success: boolean;
  confidence?: number;
  errorMessage?: string;
  createdBy: string;
  timestamp: string;
}

export interface AuditLogRecord {
  logId: string;
  schoolId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action:
    | 'LOGIN'
    | 'LOGIN_FAILED'
    | 'PASSWORD_CHANGED'
    | 'PASSWORD_RESET'
    | 'TEACHER_CREATED'
    | 'STUDENT_CREATED'
    | 'IMPORT'
    | 'EDIT_SCHOOL'
    | 'MANAGE_CLASS'
    | 'MANAGE_CURRICULUM'
    | 'IMPORT_TEACHERS'
    | 'IMPORT_STUDENTS'
    | 'CREATE_USER'
    | 'EDIT_USER'
    | 'DELETE_USER'
    | 'ASSESSMENT_PUBLISH'
    | 'PATH_GENERATED'
    | 'PATH_APPROVED'
    | 'PATH_MODIFIED'
    | 'PATH_REJECTED'
    | 'EXPERIMENT_STATE_CHANGE'
    | 'EXPERIMENT_STATE_CHANGED'
    | 'EVIDENCE_UPLOADED'
    | 'EVIDENCE_DELETED'
    | 'REPORT_EXPORT'
    | 'REPORT_EXPORTED'
    | 'SECURITY_VIOLATION';
  targetId?: string;
  details: string;
  timestamp: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  rawData: Record<string, string>;
  status: 'VALID' | 'WARNING' | 'ERROR';
  messages: string[];
  missingClassName?: string;
}

export interface ImportValidationResult {
  importType: 'TEACHER' | 'STUDENT';
  fileName: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  canCommit: boolean;
  missingClasses: string[];
  rows: ImportPreviewRow[];
}
