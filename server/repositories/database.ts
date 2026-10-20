import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AcademicYear,
  AIRunLog,
  Assessment,
  AssessmentAttempt,
  AuditLogRecord,
  ClassMember,
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
  LearningPath,
  MasteryLevel,
  PathStatus,
  PrimaryUse,
  Question,
  Role,
  School,
  StudentResponse,
  Subject,
  TeacherOverride,
  Topic,
  UserAccount,
} from '../../src/types/index.ts';
import { SEED_MATH8_QUESTIONS } from '../seed/math8Questions.ts';
import {
  calculateErrorReduction,
  calculateGainMetrics,
  calculatePathCompletion,
  getMasteryLevelInfo,
} from '../path5/engine.ts';

export interface PasswordCredential {
  userId: string;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  updatedAt: string;
}

export interface PersistentDatabaseSchema {
  schools: School[];
  academicYears: AcademicYear[];
  users: UserAccount[];
  credentials: PasswordCredential[];
  classes: ClassRoom[];
  classMembers: ClassMember[];
  subjects: Subject[];
  topics: Topic[];
  competencies: Competency[];
  errorTypes: ErrorType[];
  questions: Question[];
  assessments: Assessment[];
  attempts: AssessmentAttempt[];
  responses: StudentResponse[];
  detectedErrors: DetectedErrorRecord[];
  competencySnapshots: CompetencySnapshot[];
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
  }[];
  learningPaths: LearningPath[];
  teacherOverrides: TeacherOverride[];
  experiments: Experiment[];
  experimentStudentMetrics: ExperimentStudentMetric[];
  feedbackResponses: FeedbackResponseRecord[];
  experimentCaseStudies: ExperimentCaseStudy[];
  experimentEvidence: ExperimentEvidence[];
  aiRuns: AIRunLog[];
  auditLogs: AuditLogRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'aipath_db.json');

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { salt: actualSalt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `AiPath@${suffix}`;
}

const VIETNAMESE_STUDENT_NAMES: string[] = [
  'Nguyễn Minh Anh', // 1 - minhanh8a2
  'Trần Hoàng Bảo',
  'Lê Ngọc Châu',
  'Phạm Quốc Dũng',
  'Hoàng Minh Đức',
  'Vũ Thảo Giang',
  'Đặng Gia Hân',
  'Bùi Quang Huy',
  'Đỗ Khánh Hưng',
  'Hồ Ngọc Khánh',
  'Ngô Tuấn Kiệt',
  'Dương Bảo Lam',
  'Lý Phương Linh',
  'Phan Nhật Minh',
  'Võ Hoài Nam',
  'Trương Bảo Ngọc',
  'Nguyễn Thảo Nguyên',
  'Trần Trọng Nhân',
  'Lê Minh Nhật',
  'Phạm Yến Nhi',
  'Hoàng Thiên Phát',
  'Vũ Minh Phúc',
  'Đặng Minh Quân',
  'Bùi Ngọc Quỳnh',
  'Đỗ Thái Sơn',
  'Hồ Minh Tâm',
  'Ngô Phương Thảo',
  'Dương Anh Thư',
  'Lý Quốc Toàn',
  'Phan Huyền Trang',
  'Võ Minh Trí',
  'Trương Cát Tường',
  'Nguyễn Thanh Tùng',
  'Trần Khánh Vân',
  'Lê Hải Yến',
  'Phạm Gia Bảo', // 36
];

function createInitialSeedDatabase(): PersistentDatabaseSchema {
  const now = '2026-10-18T08:00:00.000Z';
  const schoolId = 'school_demo_aipath';
  const ayId = 'ay_2026_2027';
  const classId = 'class_8a2';

  const schools: School[] = [
    {
      schoolId,
      name: 'Trường THCS Demo AI PATH',
      code: 'THCS_AIPATH',
      address: 'Quận Cầu Giấy, Hà Nội',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const academicYears: AcademicYear[] = [
    {
      academicYearId: ayId,
      schoolId,
      name: '2026–2027',
      isCurrent: true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      academicYearId: 'ay_2025_2026',
      schoolId,
      name: '2025–2026',
      isCurrent: false,
      status: 'ARCHIVED',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const subjects: Subject[] = [
    {
      subjectId: 'subj_toan8',
      schoolId,
      code: 'TOAN_8',
      name: 'Toán 8',
      grade: 8,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const topics: Topic[] = [
    {
      topicId: 'topic_factoring',
      schoolId,
      code: 'FACTORING_POLYNOMIAL',
      name: 'Phân tích đa thức thành nhân tử',
      subjectCode: 'TOAN_8',
      grade: 8,
      description: 'Biến đổi đa thức thành tích của những đa thức thông qua đặt nhân tử chung, dùng hằng đẳng thức, nhóm hạng tử và tách hạng tử.',
      knowledgeSummary:
        'Trọng tâm: (1) Đặt nhân tử chung A.B + A.C = A(B + C); (2) 7 Hằng đẳng thức đáng nhớ; (3) Quy tắc đổi dấu -(A - B) = B - A; (4) Nhóm hạng tử và Tách hạng tử.',
      knowledgeItems: [
        {
          knowledgeId: 'know_fact_1',
          title: '1. Lý thuyết cốt lõi & Phương pháp Đặt nhân tử chung',
          knowledgeType: 'CORE_THEORY',
          contentText:
            'Phân tích đa thức thành nhân tử (hay thừa số) là biến đổi đa thức đó thành một tích của những đa thức.\n• Công thức tổng quát: A·B + A·C - A·D = A·(B + C - D)\n• Bước 1: Tìm ƯCLN của các hệ số.\n• Bước 2: Tìm lũy thừa với số mũ nhỏ nhất của từng biến có mặt trong tất cả các hạng tử.\n• Chú ý quy tắc đổi dấu: A - B = -(B - A) và (A - B)² = (B - A)².',
          uploadedBy: 'user_teacher_8a2',
          uploadedByName: 'Nguyễn Thị Lan',
          createdAt: now,
        },
        {
          knowledgeId: 'know_fact_2',
          title: '2. Bảy Hằng đẳng thức đáng nhớ dùng trong phân tích đa thức',
          knowledgeType: 'FORMULA_RULES',
          contentText:
            '1) Bình phương của một tổng: A² + 2AB + B² = (A + B)²\n2) Bình phương của một hiệu: A² - 2AB + B² = (A - B)²\n3) Hiệu hai bình phương: A² - B² = (A - B)(A + B)\n4) Lập phương của một tổng: A³ + 3A²B + 3AB² + B³ = (A + B)³\n5) Lập phương của một hiệu: A³ - 3A²B + 3AB² - B³ = (A - B)³\n6) Tổng hai lập phương: A³ + B³ = (A + B)(A² - AB + B²)\n7) Hiệu hai lập phương: A³ - B³ = (A - B)(A² + AB + B²)',
          uploadedBy: 'user_teacher_8a2',
          uploadedByName: 'Nguyễn Thị Lan',
          createdAt: now,
        },
        {
          knowledgeId: 'know_fact_3',
          title: '3. Phương pháp Nhóm hạng tử, Tách hạng tử & Ví dụ giải mẫu',
          knowledgeType: 'SOLVED_EXAMPLES',
          contentText:
            '• Ví dụ 1 (Nhóm hạng tử & Quy tắc dấu): Phân tích x² - xy - 3x + 3y\n  Giải: (x² - xy) - (3x - 3y) = x(x - y) - 3(x - y) = (x - y)(x - 3). (Lưu ý đổi dấu -3y thành +3y khi đặt dấu trừ trước ngoặc).\n• Ví dụ 2 (Tách hạng tử tam thức bậc hai ax² + bx + c): Phân tích x² - 5x + 6\n  Giải: Tìm hai số có tích bằng 6 và tổng bằng -5 là -2 và -3. Ta tách: x² - 2x - 3x + 6 = x(x - 2) - 3(x - 2) = (x - 2)(x - 3).',
          uploadedBy: 'user_teacher_8a2',
          uploadedByName: 'Nguyễn Thị Lan',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const competencies: Competency[] = [
    {
      competencyId: 'comp_foundation',
      schoolId,
      code: CompetencyCode.FOUNDATION,
      name: 'Kiến thức nền',
      description: 'Hiểu khái niệm nhân tử chung, quy tắc dấu và phép nhân đa thức cơ bản.',
      orderIndex: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      competencyId: 'comp_recognition',
      schoolId,
      code: CompetencyCode.RECOGNITION,
      name: 'Nhận dạng',
      description: 'Nhận diện đúng dạng hằng đẳng thức đáng nhớ hoặc nhóm hạng tử phù hợp.',
      orderIndex: 2,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      competencyId: 'comp_transformation',
      schoolId,
      code: CompetencyCode.TRANSFORMATION,
      name: 'Biến đổi',
      description: 'Thực hiện biến đổi đại số, đổi dấu hạng tử và phối hợp nhiều phương pháp phân tích.',
      orderIndex: 3,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      competencyId: 'comp_calc_accuracy',
      schoolId,
      code: CompetencyCode.CALC_ACCURACY,
      name: 'Chính xác tính toán',
      description: 'Tính đúng hệ số, số mũ và phân tích triệt để đa thức thành nhân tử.',
      orderIndex: 4,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      competencyId: 'comp_application',
      schoolId,
      code: CompetencyCode.APPLICATION,
      name: 'Vận dụng',
      description: 'Vận dụng phân tích đa thức thành nhân tử vào bài toán tìm x, tính nhanh và chứng minh chia hết.',
      orderIndex: 5,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const errorTypes: ErrorType[] = [
    {
      errorTypeId: 'err_sign',
      schoolId,
      code: ErrorTagCode.SIGN_ERROR,
      name: 'Quy tắc dấu',
      description: 'Sai dấu khi đặt dấu trừ trước ngoặc hoặc đổi dấu (b - a) = -(a - b).',
      remediationTip: 'Kiểm tra bằng cách nhân ngược dấu trừ vào trong ngoặc xem có khớp biểu thức ban đầu không.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      errorTypeId: 'err_procedure',
      schoolId,
      code: ErrorTagCode.PROCEDURE_ERROR,
      name: 'Lỗi quy trình các bước',
      description: 'Nhóm hạng tử không xuất hiện nhân tử chung hoặc dừng phân tích khi chưa triệt để.',
      remediationTip: 'Luôn ưu tiên đặt nhân tử chung trước, sau đó xét hằng đẳng thức rồi mới nhóm hạng tử.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      errorTypeId: 'err_formula',
      schoolId,
      code: ErrorTagCode.FORMULA_ERROR,
      name: 'Lỗi hằng đẳng thức / công thức',
      description: 'Nhầm lẫn hệ số trong hằng đẳng thức hiệu hai bình phương hoặc lập phương.',
      remediationTip: 'Viết rõ biểu thức dưới dạng A² - B² (ví dụ 9x² = (3x)²) trước khi áp dụng công thức.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      errorTypeId: 'err_calc',
      schoolId,
      code: ErrorTagCode.CALCULATION_ERROR,
      name: 'Lỗi tính toán hệ số / số mũ',
      description: 'Tính nhầm ƯCLN của các hệ số hoặc trừ sai số mũ khi đặt nhân tử chung.',
      remediationTip: 'Kiểm tra lại ước chung lớn nhất và số mũ nhỏ nhất của từng biến.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      errorTypeId: 'err_concept',
      schoolId,
      code: ErrorTagCode.CONCEPT_ERROR,
      name: 'Lỗi khái niệm',
      description: 'Bỏ sót hạng tử bằng 1 khi đặt toàn bộ hạng tử làm nhân tử chung.',
      remediationTip: 'Số hạng tử trong ngoặc phải luôn bằng số hạng tử ban đầu.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      errorTypeId: 'err_application',
      schoolId,
      code: ErrorTagCode.APPLICATION_ERROR,
      name: 'Lỗi vận dụng giải toán',
      description: 'Rút gọn hai vế phương trình chứa ẩn làm mất nghiệm hoặc chưa đưa vế phải về 0.',
      remediationTip: 'Chuyển toàn bộ hạng tử sang vế trái để đưa về phương trình tích A(x).B(x) = 0.',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  const users: UserAccount[] = [];
  const credentials: PasswordCredential[] = [];
  const classMembers: ClassMember[] = [];

  const registerUserWithPassword = (user: UserAccount, plainPassword: string) => {
    users.push(user);
    const { salt, hash } = hashPassword(plainPassword);
    credentials.push({
      userId: user.userId,
      username: user.username.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      updatedAt: now,
    });
  };

  // 1. Admin account (username: admin, password: Demo@2026)
  registerUserWithPassword(
    {
      userId: 'user_admin',
      schoolId,
      code: 'ADMIN01',
      username: 'admin',
      fullName: 'Quản trị viên AI PATH',
      role: Role.ADMIN,
      email: 'Hoanghac2dv@gmail.com',
      status: 'ACTIVE',
      dataSource: 'DEMO',
      pseudonymId: 'admin_root',
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    },
    'Demo@2026'
  );

  // 2. Teacher account (username: teacher8a2, password: Demo@2026)
  registerUserWithPassword(
    {
      userId: 'user_teacher_8a2',
      schoolId,
      code: 'GV001',
      username: 'teacher8a2',
      fullName: 'Nguyễn Thị Lan',
      role: Role.TEACHER,
      email: 'lan.nt@thcsaipath.edu.vn',
      phone: '0912345678',
      subjectCode: 'TOAN_8',
      classId,
      className: '8A2',
      assignedClassNames: ['8A2'],
      status: 'ACTIVE',
      dataSource: 'DEMO',
      pseudonymId: 'teacher_lan8a2',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    'Demo@2026'
  );

  // Additional teachers for Admin Teacher Management view
  registerUserWithPassword(
    {
      userId: 'user_teacher_8a1',
      schoolId,
      code: 'GV002',
      username: 'teacher8a1',
      fullName: 'Trần Văn Hùng',
      role: Role.TEACHER,
      email: 'hung.tv@thcsaipath.edu.vn',
      phone: '0987654321',
      subjectCode: 'TOAN_8',
      classId: 'class_8a1',
      className: '8A1',
      assignedClassNames: ['8A1'],
      status: 'ACTIVE',
      dataSource: 'DEMO',
      pseudonymId: 'teacher_hung8a1',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    'Demo@2026'
  );

  const classes: ClassRoom[] = [
    {
      classId,
      schoolId,
      academicYearId: ayId,
      name: '8A2',
      grade: 8,
      teacherId: 'user_teacher_8a2',
      teacherName: 'Nguyễn Thị Lan',
      studentCount: 36,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
    {
      classId: 'class_8a1',
      schoolId,
      academicYearId: ayId,
      name: '8A1',
      grade: 8,
      teacherId: 'user_teacher_8a1',
      teacherName: 'Trần Văn Hùng',
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    },
  ];

  classMembers.push({
    memberId: 'cm_teacher_8a2',
    schoolId,
    classId,
    userId: 'user_teacher_8a2',
    memberRole: 'TEACHER',
    createdAt: now,
    updatedAt: now,
    createdBy: 'user_admin',
  });

  // 3. Create 36 Students in Class 8A2
  // Student #1 is Nguyễn Minh Anh (username: minhanh8a2)
  // Exact requirement 54, 96, 97:
  // - 36 students in 8A2
  // - 31 learned today
  // - 5 Need Support (overall mastery < 50)
  // - 7 Paths waiting approval (status = WAITING_APPROVAL)
  // - 17/36 students have Application < 60%
  // - 11 students repeat SIGN_ERROR >= 3 times
  const competencySnapshots: CompetencySnapshot[] = [];
  const detectedErrors: DetectedErrorRecord[] = [];
  const learningPaths: LearningPath[] = [];
  const experimentStudentMetrics: ExperimentStudentMetric[] = [];
  const seedAttempts: AssessmentAttempt[] = [];

  for (let i = 0; i < 36; i++) {
    const idx = i + 1;
    const isMinhAnh = i === 0;
    const studentId = isMinhAnh ? 'user_student_minhanh' : `user_student_${String(idx).padStart(2, '0')}`;
    const code = `HS8A2_${String(idx).padStart(2, '0')}`;
    const username = isMinhAnh ? 'minhanh8a2' : `hs8a2_${String(idx).padStart(2, '0')}`;
    const fullName = VIETNAMESE_STUDENT_NAMES[i];
    const pseudonymId = isMinhAnh ? 'student_a13f' : `student_${(1000 + i * 17).toString(16)}`;

    // 31 students active today, last 5 active yesterday
    const updatedAt = i < 31 ? new Date().toISOString() : '2026-10-16T09:00:00.000Z';

    registerUserWithPassword(
      {
        userId: studentId,
        schoolId,
        code,
        username,
        fullName,
        role: Role.STUDENT,
        dob: `2012-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
        gender: i % 2 === 0 ? 'Nữ' : 'Nam',
        classId,
        className: '8A2',
        grade: 8,
        academicYearId: ayId,
        status: 'ACTIVE',
        dataSource: 'DEMO',
        pseudonymId,
        createdAt: now,
        updatedAt,
        createdBy: 'user_admin',
      },
      'Demo@2026'
    );

    classMembers.push({
      memberId: `cm_stu_${idx}`,
      schoolId,
      classId,
      userId: studentId,
      memberRole: 'STUDENT',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    });

    // Competency scores for each student:
    // Ensure:
    // - Student 0 (Minh Anh): Foundation 82, Recognition 88, Transformation 63, Calc Accuracy 58, Application 42 (Overall = 67)
    // - Exactly 5 students (indices 1..5) have overallMastery < 50 (Needs Support)
    // - Exactly 17 students (indices 0..16) have Application < 60%
    // - Exactly 11 students (indices 0..10) have recurring SIGN_ERROR >= 3
    let foundation = 82;
    let recognition = 88;
    let transformation = 63;
    let calcAccuracy = 58;
    let application = 42;

    if (!isMinhAnh) {
      if (i >= 1 && i <= 5) {
        // 5 students in Needs Support (overall < 50, Application < 60)
        foundation = 44 + (i % 4);
        recognition = 48 + (i % 3);
        transformation = 42 + (i % 5);
        calcAccuracy = 40 + (i % 6);
        application = 35 + i * 2;
      } else if (i >= 6 && i <= 16) {
        // Remaining 11 students with Application < 60 (indices 0..16 = 17 students total with Application < 60)
        foundation = 74 + (i % 10);
        recognition = 76 + (i % 8);
        transformation = 58 + (i % 9);
        calcAccuracy = 62 + (i % 8);
        application = 46 + (i % 12); // max 57 < 60
      } else if (i >= 17 && i <= 27) {
        // Achieved students
        foundation = 80 + (i % 10);
        recognition = 82 + (i % 9);
        transformation = 74 + (i % 10);
        calcAccuracy = 72 + (i % 11);
        application = 68 + (i % 14);
      } else {
        // Mastered students
        foundation = 90 + (i % 8);
        recognition = 92 + (i % 7);
        transformation = 86 + (i % 9);
        calcAccuracy = 88 + (i % 8);
        application = 85 + (i % 10);
      }
    }

    const overallMastery = Math.round(
      (foundation + recognition + transformation + calcAccuracy + application) / 5
    );

    const hasRecurringSignError = i <= 10; // 11 students (0..10) have SIGN_ERROR >= 3
    const signErrorCount = isMinhAnh ? 4 : hasRecurringSignError ? 3 + (i % 2) : i < 18 ? 1 : 0;
    const procErrorCount = isMinhAnh ? 2 : i >= 1 && i <= 5 ? 3 : i < 15 ? 1 : 0;

    const recurringList: ErrorTagCode[] = [];
    if (signErrorCount >= 3) recurringList.push(ErrorTagCode.SIGN_ERROR);
    if (procErrorCount >= 3) recurringList.push(ErrorTagCode.PROCEDURE_ERROR);

    if (signErrorCount > 0) {
      detectedErrors.push({
        errorId: `derr_sign_${studentId}`,
        schoolId,
        studentId,
        errorTag: ErrorTagCode.SIGN_ERROR,
        errorName: 'Quy tắc dấu',
        occurrencesInLast10: signErrorCount,
        totalOccurrences: signErrorCount + 1,
        isRecurring: signErrorCount >= 3,
        status: isMinhAnh ? 'IMPROVING' : signErrorCount >= 3 ? 'ACTIVE' : 'IMPROVING',
        lastDetectedAt: updatedAt,
        sampleQuestionId: 'Q_DIAG_05',
        sampleStudentAnswer: '(x - 5)(2x - 1)',
        dataSource: 'DEMO',
        createdAt: now,
        updatedAt,
      });
    }

    if (procErrorCount > 0) {
      detectedErrors.push({
        errorId: `derr_proc_${studentId}`,
        schoolId,
        studentId,
        errorTag: ErrorTagCode.PROCEDURE_ERROR,
        errorName: 'Lỗi quy trình các bước',
        occurrencesInLast10: procErrorCount,
        totalOccurrences: procErrorCount,
        isRecurring: procErrorCount >= 3,
        status: procErrorCount >= 3 ? 'ACTIVE' : 'IMPROVING',
        lastDetectedAt: updatedAt,
        sampleQuestionId: 'Q_DIAG_04',
        sampleStudentAnswer: 'Khai triển hết ra rồi rút gọn',
        dataSource: 'DEMO',
        createdAt: now,
        updatedAt,
      });
    }

    const buildCompItem = (codeComp: CompetencyCode, nameComp: string, scoreVal: number) => {
      const info = getMasteryLevelInfo(scoreVal);
      return {
        competency: codeComp,
        name: nameComp,
        score: scoreVal,
        initialScore: Math.max(30, scoreVal - (isMinhAnh ? 0 : 8)),
        confidence: 0.86,
        confidenceStatus: 'SUFFICIENT' as const,
        level: info.level,
        levelLabelVi: info.labelVi,
        signals: {
          accuracy: scoreVal,
          checkpoint: isMinhAnh ? 81 : scoreVal,
          independence: Math.min(100, scoreVal + 5),
          stability: Math.max(40, scoreVal - 4),
        },
      };
    };

    const suggestedGroup: CompetencySnapshot['suggestedGroup'] =
      overallMastery < 50
        ? 'GROUP_A_FOUNDATION'
        : transformation < 70
        ? 'GROUP_B_TRANSFORMATION'
        : application < 75
        ? 'GROUP_C_APPLICATION'
        : 'GROUP_D_ADVANCED';

    competencySnapshots.push({
      snapshotId: `snap_${studentId}`,
      schoolId,
      studentId,
      studentName: fullName,
      classId,
      sourceType: 'DIAGNOSTIC',
      overallMastery,
      overallConfidence: 0.86,
      competencies: {
        [CompetencyCode.FOUNDATION]: buildCompItem(CompetencyCode.FOUNDATION, 'Kiến thức nền', foundation),
        [CompetencyCode.RECOGNITION]: buildCompItem(CompetencyCode.RECOGNITION, 'Nhận dạng', recognition),
        [CompetencyCode.TRANSFORMATION]: buildCompItem(CompetencyCode.TRANSFORMATION, 'Biến đổi', transformation),
        [CompetencyCode.CALC_ACCURACY]: buildCompItem(
          CompetencyCode.CALC_ACCURACY,
          'Chính xác tính toán',
          calcAccuracy
        ),
        [CompetencyCode.APPLICATION]: buildCompItem(CompetencyCode.APPLICATION, 'Vận dụng', application),
      },
      recurringErrors: recurringList,
      aiInsightStudent: isMinhAnh
        ? 'Em đã nắm khá tốt kiến thức nền. Phần cần ưu tiên hiện tại là vận dụng và xử lý dấu khi biến đổi.'
        : application < 60
        ? 'Em đã có nền tảng nhận diện đa thức. Hãy tập trung luyện thêm bước đổi dấu và bài toán vận dụng tìm x.'
        : 'Em nắm vững các phương pháp phân tích đa thức thành nhân tử và sẵn sàng cho các bài toán vận dụng nâng cao.',
      aiInsightTeacher: `Application ${application}%, Transformation ${transformation}%${
        signErrorCount > 0 ? `, SIGN_ERROR ×${signErrorCount}` : ''
      }`,
      suggestedGroup,
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt,
      createdBy: 'system',
    });

    // Create Learning Paths for all 36 students so PATH5 metrics are 100% derived from real LearningPath records:
    // - Student 0 (Minh Anh): Approved Path (Steps 1..3 COMPLETED, Step 4 AVAILABLE, Step 5 AVAILABLE with Checkpoint = 81%)
    // - Students 1..7 (7 students): status = WAITING_APPROVAL (so Teacher Dashboard shows 7 Path chờ duyệt)
    // - Students 8..35 (28 students): status = APPROVED or COMPLETED
    const pathId = `path_${studentId}`;
    const isWaitingApproval = i >= 1 && i <= 7;
    const isIncompleteStudent = i >= 34; // Last 2 students (indices 34, 35) have Pre-test but no submitted Post-test
    const preOverall = isMinhAnh ? 58 : Math.max(38, overallMastery - 12);
    const postOverall = isIncompleteStudent ? null : isMinhAnh ? 78 : Math.min(98, preOverall + 16 + (i % 8));
    const preApp = isMinhAnh ? 42 : application;
    const postApp = isIncompleteStudent ? 0 : isMinhAnh ? 71 : Math.min(96, preApp + 22);
    const preErr = isMinhAnh ? 4 : signErrorCount + procErrorCount;
    const postErr = isIncompleteStudent ? preErr : isMinhAnh ? 1 : Math.max(0, Math.floor(preErr / 3));

    const targetCompletedSteps = isIncompleteStudent ? 2 : isMinhAnh ? 3 : i < 25 ? 5 : 4;
    const totalHintsForStudent = isMinhAnh ? 2 : (i % 3) + 1;
    const chkScoreForStudent = isIncompleteStudent ? undefined : isMinhAnh ? 81 : Math.min(95, (postOverall || 75) + 3);
    const pathStatus = isWaitingApproval
      ? PathStatus.WAITING_APPROVAL
      : targetCompletedSteps === 5
      ? PathStatus.COMPLETED
      : PathStatus.APPROVED;

    learningPaths.push({
      pathId,
      schoolId,
      studentId,
      studentName: fullName,
      classId,
      topicCode: 'FACTORING_POLYNOMIAL',
      status: pathStatus,
      cycleNumber: 1,
      consecutiveLowCheckpoints: 0,
      triggerReasons: {
        weakCompetencies: [
          { competency: CompetencyCode.APPLICATION, score: application },
          { competency: CompetencyCode.TRANSFORMATION, score: transformation },
        ],
        recurringErrors: [
          ...(signErrorCount > 0 ? [{ errorTag: ErrorTagCode.SIGN_ERROR, count: signErrorCount }] : []),
          ...(procErrorCount > 0 ? [{ errorTag: ErrorTagCode.PROCEDURE_ERROR, count: procErrorCount }] : []),
        ],
      },
      aiExplanation: {
        studentMessage:
          'Em đã nắm khá tốt kiến thức nền. Phần cần ưu tiên hiện tại là vận dụng và xử lý dấu khi biến đổi.',
        teacherReason: `Hệ thống đề xuất lộ trình 5 bước do năng lực Vận dụng đạt ${application}%, Biến đổi đạt ${transformation}% và lặp lỗi Quy tắc dấu (SIGN_ERROR ×${signErrorCount}).`,
      },
      steps: [
        {
          stepId: `${pathId}_step_1`,
          schoolId,
          pathId,
          studentId,
          stepOrder: 1,
          stepType: 'REVIEW',
          title: 'Review Signs – Ôn tập quy tắc dấu khi đặt nhân tử chung',
          description: 'Nắm vững đẳng thức (b - a) = -(a - b) và cách đổi dấu hạng tử khi đưa vào ngoặc.',
          targetCompetency: CompetencyCode.FOUNDATION,
          targetErrorTag: ErrorTagCode.SIGN_ERROR,
          targetDifficulty: 2,
          questionIds: ['Q_DIAG_02', 'Q_PRAC_01'],
          status: isWaitingApproval ? 'LOCKED' : targetCompletedSteps >= 1 ? 'COMPLETED' : 'AVAILABLE',
          scorePercent: targetCompletedSteps >= 1 ? 90 : undefined,
          hintsUsedCount: isMinhAnh ? 0 : totalHintsForStudent >= 3 ? 1 : 0,
          completedAt: targetCompletedSteps >= 1 ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
        {
          stepId: `${pathId}_step_2`,
          schoolId,
          pathId,
          studentId,
          stepOrder: 2,
          stepType: 'PRACTICE',
          title: 'Transformation – Luyện tập biến đổi và nhóm hạng tử',
          description: 'Thực hành đặt nhân tử chung kết hợp đổi dấu nhị thức với hệ thống gợi ý 3 mức.',
          targetCompetency: CompetencyCode.TRANSFORMATION,
          targetDifficulty: 3,
          questionIds: ['Q_PRAC_03', 'Q_PRAC_04', 'Q_PRAC_06'],
          status: isWaitingApproval ? 'LOCKED' : targetCompletedSteps >= 2 ? 'COMPLETED' : 'IN_PROGRESS',
          scorePercent: targetCompletedSteps >= 2 ? 80 : undefined,
          hintsUsedCount: isMinhAnh ? 1 : 1,
          completedAt: targetCompletedSteps >= 2 ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
        {
          stepId: `${pathId}_step_3`,
          schoolId,
          pathId,
          studentId,
          stepOrder: 3,
          stepType: 'ERROR_CORRECTION',
          title: 'Error Correction – Trạm sửa lỗi Quy tắc dấu (SIGN_ERROR)',
          description: 'Phát hiện lỗi sai trong lời giải mẫu và chọn phép biến đổi đúng.',
          targetCompetency: CompetencyCode.TRANSFORMATION,
          targetErrorTag: ErrorTagCode.SIGN_ERROR,
          targetDifficulty: 3,
          questionIds: ['Q_ERR_01', 'Q_ERR_02'],
          status: isWaitingApproval
            ? 'LOCKED'
            : targetCompletedSteps >= 3
            ? 'COMPLETED'
            : targetCompletedSteps === 2
            ? 'AVAILABLE'
            : 'LOCKED',
          scorePercent: targetCompletedSteps >= 3 ? 85 : undefined,
          hintsUsedCount: isMinhAnh ? 1 : totalHintsForStudent >= 2 ? 1 : 0,
          completedAt: targetCompletedSteps >= 3 ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
        {
          stepId: `${pathId}_step_4`,
          schoolId,
          pathId,
          studentId,
          stepOrder: 4,
          stepType: 'APPLICATION',
          title: 'Application – Vận dụng giải phương trình tích và tính nhanh',
          description: 'Áp dụng phân tích đa thức thành nhân tử để tìm x và tính nhanh giá trị biểu thức.',
          targetCompetency: CompetencyCode.APPLICATION,
          targetDifficulty: 3,
          questionIds: ['Q_PRAC_07', 'Q_PRAC_08'],
          status: isMinhAnh
            ? 'AVAILABLE'
            : isWaitingApproval
            ? 'LOCKED'
            : targetCompletedSteps >= 4
            ? 'COMPLETED'
            : 'LOCKED',
          scorePercent: isMinhAnh ? 71 : targetCompletedSteps >= 4 ? 78 : undefined,
          hintsUsedCount: 0,
          completedAt: targetCompletedSteps >= 4 ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
        {
          stepId: `${pathId}_step_5`,
          schoolId,
          pathId,
          studentId,
          stepOrder: 5,
          stepType: 'CHECKPOINT',
          title: 'Checkpoint – Đánh giá độc lập cuối chu trình (Không gợi ý)',
          description: 'Hoàn thành bài kiểm tra ngắn độc lập để đánh giá mức độ tiến bộ và tái định tuyến.',
          targetCompetency: CompetencyCode.APPLICATION,
          targetDifficulty: 3,
          questionIds: ['Q_CHK_03', 'Q_CHK_04', 'Q_CHK_05', 'Q_CHK_06'],
          status: isMinhAnh
            ? 'AVAILABLE'
            : isWaitingApproval
            ? 'LOCKED'
            : targetCompletedSteps >= 5
            ? 'COMPLETED'
            : targetCompletedSteps === 4
            ? 'AVAILABLE'
            : 'LOCKED',
          scorePercent: chkScoreForStudent,
          hintsUsedCount: 0,
          completedAt: targetCompletedSteps >= 5 ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
      ],
      approvedBy: isWaitingApproval ? undefined : 'user_teacher_8a2',
      approvedAt: isWaitingApproval ? undefined : now,
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt,
      createdBy: 'system',
    });

    // Seed real Pre-test attempt (Baseline) for all 36 students in exp_demo_8a2_completed
    const preCompetencyBreakdown: Record<CompetencyCode, number> = {
      [CompetencyCode.FOUNDATION]: foundation,
      [CompetencyCode.RECOGNITION]: recognition,
      [CompetencyCode.TRANSFORMATION]: transformation,
      [CompetencyCode.CALC_ACCURACY]: calcAccuracy,
      [CompetencyCode.APPLICATION]: preApp,
    };

    const preErrorBreakdown: Partial<Record<ErrorTagCode, number>> = {};
    if (isMinhAnh) {
      preErrorBreakdown[ErrorTagCode.SIGN_ERROR] = 3;
      preErrorBreakdown[ErrorTagCode.PROCEDURE_ERROR] = 1;
    } else {
      if (signErrorCount > 0) preErrorBreakdown[ErrorTagCode.SIGN_ERROR] = signErrorCount;
      if (procErrorCount > 0) preErrorBreakdown[ErrorTagCode.PROCEDURE_ERROR] = procErrorCount;
    }

    seedAttempts.push({
      attemptId: `att_pre_demo_${studentId}`,
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      assessmentId: 'assess_pre_8a2',
      assessmentType: PrimaryUse.PRE_TEST,
      studentId,
      studentName: fullName,
      classId,
      status: 'SUBMITTED',
      currentQuestionIndex: 9,
      flaggedQuestionIds: [],
      answers: {},
      scorePercent: preOverall,
      totalPointsEarned: preOverall,
      totalPointsPossible: 100,
      competencyBreakdown: preCompetencyBreakdown,
      detectedErrorCounts: preErrorBreakdown,
      startedAt: '2026-10-02T08:00:00.000Z',
      submittedAt: '2026-10-02T08:25:00.000Z',
      dataSource: 'DEMO',
      createdAt: '2026-10-02T08:00:00.000Z',
      updatedAt: '2026-10-02T08:25:00.000Z',
      createdBy: studentId,
    });

    // Seed real Post-test attempt (Outcome) for 34 completed students, and IN_PROGRESS for 2 incomplete students
    if (!isIncompleteStudent && postOverall !== null) {
      const postCompetencyBreakdown: Record<CompetencyCode, number> = {
        [CompetencyCode.FOUNDATION]: Math.min(98, foundation + 8),
        [CompetencyCode.RECOGNITION]: Math.min(98, recognition + 6),
        [CompetencyCode.TRANSFORMATION]: isMinhAnh ? 78 : Math.min(96, transformation + 15),
        [CompetencyCode.CALC_ACCURACY]: isMinhAnh ? 76 : Math.min(95, calcAccuracy + 14),
        [CompetencyCode.APPLICATION]: postApp,
      };
      const postErrorBreakdown: Partial<Record<ErrorTagCode, number>> = {};
      if (postErr > 0) {
        postErrorBreakdown[ErrorTagCode.SIGN_ERROR] = postErr;
      }

      seedAttempts.push({
        attemptId: `att_post_demo_${studentId}`,
        schoolId,
        experimentId: 'exp_demo_8a2_completed',
        assessmentId: 'assess_post_8a2',
        assessmentType: PrimaryUse.POST_TEST,
        studentId,
        studentName: fullName,
        classId,
        status: 'SUBMITTED',
        currentQuestionIndex: 9,
        flaggedQuestionIds: [],
        answers: {},
        scorePercent: postOverall,
        totalPointsEarned: postOverall,
        totalPointsPossible: 100,
        competencyBreakdown: postCompetencyBreakdown,
        detectedErrorCounts: postErrorBreakdown,
        startedAt: '2026-10-17T08:00:00.000Z',
        submittedAt: '2026-10-17T08:25:00.000Z',
        dataSource: 'DEMO',
        createdAt: '2026-10-17T08:00:00.000Z',
        updatedAt: '2026-10-17T08:25:00.000Z',
        createdBy: studentId,
      });
    } else {
      seedAttempts.push({
        attemptId: `att_post_demo_inprog_${studentId}`,
        schoolId,
        experimentId: 'exp_demo_8a2_completed',
        assessmentId: 'assess_post_8a2',
        assessmentType: PrimaryUse.POST_TEST,
        studentId,
        studentName: fullName,
        classId,
        status: 'IN_PROGRESS',
        currentQuestionIndex: 3,
        flaggedQuestionIds: [],
        answers: {},
        startedAt: '2026-10-17T08:05:00.000Z',
        dataSource: 'DEMO',
        createdAt: '2026-10-17T08:05:00.000Z',
        updatedAt: '2026-10-17T08:15:00.000Z',
        createdBy: studentId,
      });
    }
  }

  // Assessments
  const assessments: Assessment[] = [
    {
      assessmentId: 'assess_diag_8a2',
      schoolId,
      title: 'Chẩn đoán năng lực: Phân tích đa thức thành nhân tử (Toán 8)',
      assessmentType: PrimaryUse.DIAGNOSTIC,
      classId,
      topicCode: 'FACTORING_POLYNOMIAL',
      competencies: Object.values(CompetencyCode),
      questionIds: SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.DIAGNOSTIC).map(
        (q) => q.questionId
      ),
      durationMinutes: 15,
      totalPoints: 80,
      status: 'PUBLISHED',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_teacher_8a2',
    },
    {
      assessmentId: 'assess_pre_8a2',
      schoolId,
      title: 'Đánh giá đầu vào (Pre-test): Phân tích đa thức thành nhân tử',
      assessmentType: PrimaryUse.PRE_TEST,
      classId,
      topicCode: 'FACTORING_POLYNOMIAL',
      competencies: Object.values(CompetencyCode),
      questionIds: SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.PRE_TEST).map(
        (q) => q.questionId
      ),
      durationMinutes: 25,
      totalPoints: 100,
      status: 'PUBLISHED',
      experimentId: 'exp_demo_8a2_completed',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_teacher_8a2',
    },
    {
      assessmentId: 'assess_post_8a2',
      schoolId,
      title: 'Đánh giá đầu ra (Post-test): Phân tích đa thức thành nhân tử',
      assessmentType: PrimaryUse.POST_TEST,
      classId,
      topicCode: 'FACTORING_POLYNOMIAL',
      competencies: Object.values(CompetencyCode),
      questionIds: SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.POST_TEST).map(
        (q) => q.questionId
      ),
      durationMinutes: 25,
      totalPoints: 100,
      status: 'PUBLISHED',
      experimentId: 'exp_demo_8a2_completed',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_teacher_8a2',
    },
  ];

  // Progress History for Minh Anh (Student Progress Chart: Before -> Current, Application 42% -> 71%)
  const progressHistory = [
    {
      studentId: 'user_student_minhanh',
      date: '2026-10-01',
      label: 'Chẩn đoán đầu vào',
      overall: 67,
      foundation: 82,
      recognition: 88,
      transformation: 63,
      calcAccuracy: 58,
      application: 42,
    },
    {
      studentId: 'user_student_minhanh',
      date: '2026-10-06',
      label: 'Sau Bước 1–2 (Ôn dấu & Biến đổi)',
      overall: 71,
      foundation: 85,
      recognition: 88,
      transformation: 70,
      calcAccuracy: 64,
      application: 50,
    },
    {
      studentId: 'user_student_minhanh',
      date: '2026-10-12',
      label: 'Sau Bước 3 (Trạm sửa lỗi dấu)',
      overall: 76,
      foundation: 86,
      recognition: 90,
      transformation: 75,
      calcAccuracy: 72,
      application: 61,
    },
    {
      studentId: 'user_student_minhanh',
      date: '2026-10-18',
      label: 'Hiện tại (Sau Checkpoint 81%)',
      overall: 80,
      foundation: 88,
      recognition: 91,
      transformation: 78,
      calcAccuracy: 76,
      application: 71,
    },
  ];

  // Teacher Overrides history (21 real teacher decisions: 16 APPROVE = 76%, 4 MODIFY = 19%, 1 REJECT = 5%, with 5 students receiving 1-1 intervention)
  const teacherOverrides: TeacherOverride[] = [
    {
      overrideId: 'ovr_01',
      schoolId,
      teacherId: 'user_teacher_8a2',
      teacherName: 'Nguyễn Thị Lan',
      targetType: 'LEARNING_PATH',
      targetId: 'path_user_student_minhanh',
      studentId: 'user_student_minhanh',
      action: 'APPROVE',
      reason: 'Lộ trình 5 bước xử lý đúng lỗi quy tắc dấu (SIGN_ERROR ×4) và củng cố năng lực Vận dụng.',
      createdAt: now,
      updatedAt: now,
    },
    ...([2, 3, 4, 5].map((num) => {
      const sid = `user_student_${String(num).padStart(2, '0')}`;
      return {
        overrideId: `ovr_mod_${num}`,
        schoolId,
        teacherId: 'user_teacher_8a2',
        teacherName: 'Nguyễn Thị Lan',
        targetType: 'LEARNING_PATH' as const,
        targetId: `path_${sid}`,
        studentId: sid,
        action: 'MODIFY' as const,
        reason: 'Giáo viên hỗ trợ trực tiếp 1-1 và điều chỉnh bước luyện tập phù hợp mức Cần hỗ trợ.',
        createdAt: now,
        updatedAt: now,
      };
    })),
    {
      overrideId: 'ovr_grp_01',
      schoolId,
      teacherId: 'user_teacher_8a2',
      teacherName: 'Nguyễn Thị Lan',
      targetType: 'CLASS_GROUPING',
      targetId: 'snap_user_student_01',
      studentId: 'user_student_01',
      action: 'APPROVE',
      reason: 'Hỗ trợ 1-1 nhóm nền tảng cho học sinh đầu tiết.',
      createdAt: now,
      updatedAt: now,
    },
    ...Array.from({ length: 14 }, (_, k) => {
      const num = k + 8;
      const sid = `user_student_${String(num).padStart(2, '0')}`;
      return {
        overrideId: `ovr_app_${num}`,
        schoolId,
        teacherId: 'user_teacher_8a2',
        teacherName: 'Nguyễn Thị Lan',
        targetType: 'LEARNING_PATH' as const,
        targetId: `path_${sid}`,
        studentId: sid,
        action: 'APPROVE' as const,
        reason: 'Duyệt lộ trình cá nhân hóa 5 bước theo đề xuất của Rule Engine.',
        createdAt: now,
        updatedAt: now,
      };
    }),
    {
      overrideId: 'ovr_rej_01',
      schoolId,
      teacherId: 'user_teacher_8a2',
      teacherName: 'Nguyễn Thị Lan',
      targetType: 'AI_QUESTION',
      targetId: 'Q_AI_DRAFT_01',
      action: 'REJECT',
      reason: 'Từ chối 1 câu hỏi nháp do biểu thức vượt quá phạm vi tiết học.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Experiments (No exp_real_8a2!)
  const experiments: Experiment[] = [
    {
      experimentId: 'exp_demo_8a2_completed',
      schoolId,
      title: 'Thực nghiệm Sư phạm Mẫu (Demo): Cá nhân hóa lộ trình PATH5 chủ đề Phân tích đa thức thành nhân tử (Lớp 8A2)',
      description:
        'Bộ dữ liệu mẫu mô phỏng đầy đủ chu trình học thích ứng AI-PATH5 lên 5 năng lực thành phần và tỷ lệ giảm lỗi lặp lại của 36 học sinh lớp 8A2.',
      classId,
      className: '8A2',
      topicCode: 'FACTORING_POLYNOMIAL',
      targetCompetencies: Object.values(CompetencyCode),
      preTestAssessmentId: 'assess_pre_8a2',
      postTestAssessmentId: 'assess_post_8a2',
      equivalenceScore: 96,
      equivalenceApprovedByTeacher: true,
      state: ExperimentState.COMPLETED,
      dataSource: 'DEMO',
      participantCount: 36,
      preTestSubmittedCount: 36,
      preTestInProgressCount: 0,
      postTestSubmittedCount: 34,
      postTestInProgressCount: 0,
      baselineLockedAt: '2026-10-02T10:00:00.000Z',
      completedAt: '2026-10-18T07:30:00.000Z',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: now,
      createdBy: 'user_teacher_8a2',
    },
    {
      experimentId: 'exp_demo_preview',
      schoolId,
      title: 'Đợt thực nghiệm Mô phỏng (Demo): Theo dõi trực tiếp Pre-test & PATH5 Lớp 8A2',
      description: 'Đợt dữ liệu mô phỏng phục vụ trình diễn quy trình mở/đóng Pre-test, khóa Baseline và theo dõi PATH5.',
      classId,
      className: '8A2',
      topicCode: 'FACTORING_POLYNOMIAL',
      targetCompetencies: Object.values(CompetencyCode),
      preTestAssessmentId: 'assess_pre_8a2',
      postTestAssessmentId: 'assess_post_8a2',
      equivalenceScore: 96,
      equivalenceApprovedByTeacher: true,
      state: ExperimentState.PRETEST_RUNNING,
      dataSource: 'DEMO',
      participantCount: 36,
      preTestSubmittedCount: 36,
      preTestInProgressCount: 0,
      postTestSubmittedCount: 0,
      postTestInProgressCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_teacher_8a2',
    },
  ];

  // Feedback Responses (Sections 70 & 71)
  const feedbackResponses: FeedbackResponseRecord[] = [
    {
      feedbackResponseId: 'fb_stu_minhanh',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      respondentId: 'user_student_minhanh',
      respondentName: 'Nguyễn Minh Anh',
      respondentRole: 'STUDENT',
      likertScores: [5, 5, 5, 5, 5],
      openAnswer1: 'Gợi ý 3 bước không giải hộ ngay mà giúp em tự phát hiện chỗ quên đổi dấu khi đặt dấu trừ trước ngoặc.',
      openAnswer2: 'Em mong muốn có thêm nhiều bài toán tính nhanh thực tế hơn ở bước Vận dụng.',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      feedbackResponseId: 'fb_stu_02',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      respondentId: 'user_student_02',
      respondentName: 'Trần Hoàng Bảo',
      respondentRole: 'STUDENT',
      likertScores: [4, 4, 5, 4, 5],
      openAnswer1: 'Trạm sửa lỗi giúp em nhớ kỹ hằng đẳng thức hiệu hai bình phương.',
      openAnswer2: 'Thêm chế độ xem lại lịch sử các câu đã đánh dấu.',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      feedbackResponseId: 'fb_teacher_lan',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      respondentId: 'user_teacher_8a2',
      respondentName: 'Nguyễn Thị Lan',
      respondentRole: 'TEACHER',
      likertScores: [5, 5, 5, 5, 5],
      openAnswer1:
        'Bản đồ nhiệt (Heatmap) 5 năng lực giúp tôi nhận diện ngay trong 10 giây nhóm 17 học sinh vướng ở Vận dụng và 11 em lặp lỗi quy tắc dấu để can thiệp đúng trọng tâm đầu tiết học.',
      openAnswer2:
        'Cần duy trì tốc độ duyệt hàng loạt Learning Path khi triển khai cho nhiều lớp cùng khối.',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Case Studies (Section 72)
  const experimentCaseStudies: ExperimentCaseStudy[] = [
    {
      caseId: 'case_minhanh_sign',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      studentId: 'user_student_minhanh',
      studentName: 'Nguyễn Minh Anh',
      pseudonymId: 'student_a13f',
      category: 'CLEAR_ERROR_REDUCTION',
      categoryLabelVi: 'Giảm lỗi lặp lại rõ rệt & Tiến bộ Vận dụng',
      teacherApproved: true,
      beforeSummary: {
        overallPre: 58,
        applicationPre: 42,
        transformationPre: 63,
        signErrorPre: 4,
        procedureErrorPre: 2,
      },
      path5ProcessSummary: {
        stepsCompleted: 5,
        stepsAssigned: 5,
        hintsUsed: 2,
        errorCorrectionTasks: 2,
        checkpointScore: 81,
        teacherNotes: 'Giáo viên duyệt lộ trình 5 bước tập trung vào quy tắc đổi dấu (b - a) = -(a - b).',
      },
      afterSummary: {
        overallPost: 78,
        applicationPost: 71,
        transformationPost: 78,
        signErrorPost: 1,
        procedureErrorPost: 0,
      },
      narrativeSummary:
        'Học sinh khởi đầu với Kiến thức nền (82%) và Nhận dạng (88%) tốt nhưng gặp rào cản ở Vận dụng (42%) do lặp lỗi Quy tắc dấu 4 lần. Sau khi hoàn thành Trạm sửa lỗi và đạt 81% ở Checkpoint độc lập, năng lực Vận dụng tăng từ 42% lên 71% (+29%) và lỗi Quy tắc dấu giảm từ 4 xuống 1 (-75%).',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      caseId: 'case_stu07_gain',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      studentId: 'user_student_07',
      studentName: 'Đặng Gia Hân',
      pseudonymId: 'student_42b',
      category: 'HIGH_GAIN',
      categoryLabelVi: 'Tiến bộ mạnh về tổng thể',
      teacherApproved: true,
      beforeSummary: {
        overallPre: 52,
        applicationPre: 46,
        transformationPre: 55,
        signErrorPre: 3,
        procedureErrorPre: 1,
      },
      path5ProcessSummary: {
        stepsCompleted: 5,
        stepsAssigned: 5,
        hintsUsed: 3,
        errorCorrectionTasks: 2,
        checkpointScore: 86,
        teacherNotes: 'Hoàn thành 100% lộ trình thích ứng, tăng độ khó tự động ở bước Luyện tập.',
      },
      afterSummary: {
        overallPost: 84,
        applicationPost: 78,
        transformationPost: 82,
        signErrorPost: 0,
        procedureErrorPost: 0,
      },
      narrativeSummary:
        'Học sinh tăng +32 điểm phần trăm từ Pre-test (52%) lên Post-test (84%), đạt mức Thành thạo tại Checkpoint (86%) và khắc phục triệt để lỗi dấu.',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      caseId: 'case_stu02_support',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      studentId: 'user_student_02',
      studentName: 'Trần Hoàng Bảo',
      pseudonymId: 'student_3fa',
      category: 'HIGH_SUPPORT_ACHIEVED',
      categoryLabelVi: 'Cần nhiều hỗ trợ nhưng đạt chuẩn',
      teacherApproved: false,
      beforeSummary: {
        overallPre: 41,
        applicationPre: 37,
        transformationPre: 43,
        signErrorPre: 4,
        procedureErrorPre: 3,
      },
      path5ProcessSummary: {
        stepsCompleted: 5,
        stepsAssigned: 5,
        hintsUsed: 6,
        errorCorrectionTasks: 3,
        checkpointScore: 72,
        teacherNotes: 'Sử dụng gợi ý cấp độ 2–3 ở giai đoạn đầu, đạt chuẩn Đã đạt (72%) ở Checkpoint.',
      },
      afterSummary: {
        overallPost: 70,
        applicationPost: 64,
        transformationPost: 71,
        signErrorPost: 1,
        procedureErrorPost: 1,
      },
      narrativeSummary:
        'Xuất phát ở mức Cần hỗ trợ (41%), nhờ hệ thống gợi ý từng bước và trạm sửa lỗi, học sinh vươn lên mức Đã đạt (70%).',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      caseId: 'case_stu03_intervention',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      studentId: 'user_student_03',
      studentName: 'Lê Ngọc Châu',
      pseudonymId: 'student_40b',
      category: 'TEACHER_INTERVENTION',
      categoryLabelVi: 'Cần giáo viên can thiệp trực tiếp',
      teacherApproved: true,
      beforeSummary: {
        overallPre: 39,
        applicationPre: 35,
        transformationPre: 40,
        signErrorPre: 4,
        procedureErrorPre: 3,
      },
      path5ProcessSummary: {
        stepsCompleted: 4,
        stepsAssigned: 5,
        hintsUsed: 5,
        errorCorrectionTasks: 2,
        checkpointScore: 65,
        teacherNotes: 'Giáo viên hỗ trợ trực tiếp 1-1 sau chu trình đầu và điều chỉnh độ khó bài tập về mức 2.',
      },
      afterSummary: {
        overallPost: 64,
        applicationPost: 58,
        transformationPost: 66,
        signErrorPost: 1,
        procedureErrorPost: 1,
      },
      narrativeSummary:
        'Hệ thống phát hiện kịp thời nhu cầu can thiệp sư phạm của giáo viên, giúp học sinh cải thiện +25 điểm phần trăm và nắm được quy trình đặt nhân tử chung.',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Evidence records (Section 73)
  const experimentEvidence: ExperimentEvidence[] = [
    {
      evidenceId: 'ev_01',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      title: 'Phiếu bài làm Pre-test và Post-test đối chứng (Đã ẩn danh học sinh)',
      evidenceType: 'DOCUMENT',
      fileName: 'Minh_Chung_Pre_Post_8A2_AnDanh.pdf',
      fileSize: 428000,
      mimeType: 'application/pdf',
      notes: 'Bản scan bài làm tự luận bổ sung đối chiếu bước đổi dấu (x - y) của nhóm C.',
      consentConfirmed: true,
      uploadedBy: 'user_teacher_8a2',
      uploadedByName: 'Nguyễn Thị Lan',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
    {
      evidenceId: 'ev_02',
      schoolId,
      experimentId: 'exp_demo_8a2_completed',
      title: 'Biên bản sinh hoạt chuyên môn Tổ Toán về kết quả Heatmap Lớp 8A2',
      evidenceType: 'NOTE',
      notes: 'Tổ Toán thống nhất dành 8 phút đầu tiết luyện tập để xử lý lỗi quy tắc dấu cho 11 học sinh.',
      consentConfirmed: true,
      uploadedBy: 'user_teacher_8a2',
      uploadedByName: 'Nguyễn Thị Lan',
      dataSource: 'DEMO',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const aiRuns: AIRunLog[] = [
    {
      runId: 'airun_seed_01',
      schoolId,
      taskType: 'ERROR_ANALYZER',
      model: 'gemini-3.8-flash',
      promptVersion: 'v1.0-error-analyzer',
      latencyMs: 640,
      success: true,
      confidence: 0.91,
      createdBy: 'user_student_minhanh',
      timestamp: now,
    },
    {
      runId: 'airun_seed_02',
      schoolId,
      taskType: 'PATH_EXPLAINER',
      model: 'gemini-3.8-flash',
      promptVersion: 'v1.0-path-explainer',
      latencyMs: 780,
      success: true,
      confidence: 0.93,
      createdBy: 'system',
      timestamp: now,
    },
    {
      runId: 'airun_seed_03',
      schoolId,
      taskType: 'CLASS_INSIGHT',
      model: 'gemini-3.8-flash',
      promptVersion: 'v1.0-class-insight',
      latencyMs: 820,
      success: true,
      confidence: 0.94,
      createdBy: 'user_teacher_8a2',
      timestamp: now,
    },
  ];

  const auditLogs: AuditLogRecord[] = [
    {
      logId: 'audit_seed_01',
      schoolId,
      actorId: 'user_admin',
      actorName: 'Quản trị viên AI PATH',
      actorRole: Role.ADMIN,
      action: 'ASSESSMENT_PUBLISH',
      targetId: 'assess_diag_8a2',
      details: 'Khởi tạo ngân hàng 48 câu hỏi Toán 8 (Phân tích đa thức thành nhân tử) và xuất bản bài Chẩn đoán.',
      timestamp: now,
    },
    {
      logId: 'audit_seed_02',
      schoolId,
      actorId: 'user_teacher_8a2',
      actorName: 'Nguyễn Thị Lan',
      actorRole: Role.TEACHER,
      action: 'PATH_APPROVED',
      targetId: 'path_user_student_minhanh',
      details: 'Duyệt lộ trình cá nhân hóa 5 bước cho học sinh Nguyễn Minh Anh (Lớp 8A2).',
      timestamp: now,
    },
  ];

  const dbSchema: PersistentDatabaseSchema = {
    schools,
    academicYears,
    users,
    credentials,
    classes,
    classMembers,
    subjects,
    topics,
    competencies,
    errorTypes,
    questions: [...SEED_MATH8_QUESTIONS],
    assessments,
    attempts: seedAttempts,
    responses: [],
    detectedErrors,
    competencySnapshots,
    progressHistory,
    learningPaths,
    teacherOverrides,
    experiments,
    experimentStudentMetrics,
    feedbackResponses,
    experimentCaseStudies,
    experimentEvidence,
    aiRuns,
    auditLogs,
  };

  // FIX 06 & FIX 07: Build Baseline (Pre-test) and Outcome (Post-test) metrics strictly from real attempts!
  syncExperimentMetricsFromAttempts(dbSchema);

  return dbSchema;
}

/**
 * Authoritative synchronizer: derives Experiment Baseline (Pre-test) & Outcome (Post-test)
 * and PATH5 process metrics strictly from `db.attempts`, `db.learningPaths`, and `db.teacherOverrides`.
 * Never fabricates Post-test scores when missing (missing Post-test -> postScore: null, status: 'INCOMPLETE').
 */
export function syncExperimentMetricsFromAttempts(
  db: PersistentDatabaseSchema,
  targetExperimentId?: string
): void {
  const exps = targetExperimentId
    ? db.experiments.filter((e) => e.experimentId === targetExperimentId)
    : db.experiments;

  const now = new Date().toISOString();

  for (const exp of exps) {
    const classStudents = db.users.filter(
      (u) => u.schoolId === exp.schoolId && u.role === Role.STUDENT && u.classId === exp.classId
    );
    exp.participantCount = classStudents.length;

    const matchAttemptToExp = (a: AssessmentAttempt, assessmentId: string) => {
      if (a.schoolId !== exp.schoolId || a.assessmentId !== assessmentId) return false;
      if (a.experimentId) return a.experimentId === exp.experimentId;
      if (exp.dataSource === 'REAL') return a.dataSource === 'REAL';
      if (exp.dataSource === 'DEMO') return a.dataSource === 'DEMO';
      return true;
    };

    const preAttempts = db.attempts.filter((a) => matchAttemptToExp(a, exp.preTestAssessmentId));
    const postAttempts = db.attempts.filter((a) => matchAttemptToExp(a, exp.postTestAssessmentId));

    const preSubmittedByStudent = new Map<string, AssessmentAttempt>();
    const preInProgressStudents = new Set<string>();
    for (const a of preAttempts) {
      if (a.status === 'SUBMITTED') {
        preSubmittedByStudent.set(a.studentId, a);
      } else if (a.status === 'IN_PROGRESS') {
        preInProgressStudents.add(a.studentId);
      }
    }
    for (const sid of preSubmittedByStudent.keys()) {
      preInProgressStudents.delete(sid);
    }

    const postSubmittedByStudent = new Map<string, AssessmentAttempt>();
    const postInProgressStudents = new Set<string>();
    for (const a of postAttempts) {
      if (a.status === 'SUBMITTED') {
        postSubmittedByStudent.set(a.studentId, a);
      } else if (a.status === 'IN_PROGRESS') {
        postInProgressStudents.add(a.studentId);
      }
    }
    for (const sid of postSubmittedByStudent.keys()) {
      postInProgressStudents.delete(sid);
    }

    exp.preTestSubmittedCount = preSubmittedByStudent.size;
    exp.preTestInProgressCount =
      exp.state === ExperimentState.INTERVENTION_RUNNING ||
      exp.state === ExperimentState.POSTTEST_RUNNING ||
      exp.state === ExperimentState.COMPLETED ||
      exp.state === ExperimentState.ARCHIVED
        ? 0
        : preInProgressStudents.size;

    exp.postTestSubmittedCount = postSubmittedByStudent.size;
    exp.postTestInProgressCount =
      exp.state === ExperimentState.COMPLETED || exp.state === ExperimentState.ARCHIVED
        ? 0
        : postInProgressStudents.size;

    const validStudentIds = new Set(classStudents.map((s) => s.userId));
    db.experimentStudentMetrics = db.experimentStudentMetrics.filter(
      (m) => m.experimentId !== exp.experimentId || validStudentIds.has(m.studentId)
    );

    for (const student of classStudents) {
      const preAttempt = preSubmittedByStudent.get(student.userId);
      const postAttempt = postSubmittedByStudent.get(student.userId);
      const existingMetric = db.experimentStudentMetrics.find(
        (m) => m.experimentId === exp.experimentId && m.studentId === student.userId
      );

      if (!preAttempt && !postAttempt && !existingMetric && !exp.baselineLockedAt) {
        continue;
      }

      const preScore = preAttempt?.scorePercent ?? null;
      const postScore = postAttempt?.scorePercent ?? null;
      const preComp = preAttempt?.competencyBreakdown ? { ...preAttempt.competencyBreakdown } : null;
      const postComp = postAttempt?.competencyBreakdown ? { ...postAttempt.competencyBreakdown } : null;

      const preErr = preAttempt?.detectedErrorCounts
        ? Object.values(preAttempt.detectedErrorCounts).reduce((sum, n) => sum + (n || 0), 0)
        : 0;
      const postErr = postAttempt?.detectedErrorCounts
        ? Object.values(postAttempt.detectedErrorCounts).reduce((sum, n) => sum + (n || 0), 0)
        : 0;

      const gainInfo = calculateGainMetrics(preScore, postScore);
      const errorReductionPercent =
        preScore !== null && postScore !== null ? calculateErrorReduction(preErr, postErr) : 'N/A';

      const baseline =
        preAttempt && preScore !== null && preComp
          ? {
              attemptId: preAttempt.attemptId,
              assessmentId: preAttempt.assessmentId,
              scorePercent: preScore,
              competencyBreakdown: preComp,
              errorCount: preErr,
              submittedAt: preAttempt.submittedAt || preAttempt.updatedAt,
            }
          : null;

      const outcome =
        postAttempt && postScore !== null && postComp
          ? {
              attemptId: postAttempt.attemptId,
              assessmentId: postAttempt.assessmentId,
              scorePercent: postScore,
              competencyBreakdown: postComp,
              errorCount: postErr,
              submittedAt: postAttempt.submittedAt || postAttempt.updatedAt,
              absoluteGain: gainInfo.absoluteGain,
              normalizedGain: gainInfo.normalizedGain,
              errorReductionPercent,
            }
          : null;

      const stuPath = db.learningPaths.find((p) => p.studentId === student.userId);
      const assignedSteps = stuPath ? stuPath.steps.length : 0;
      const completedSteps = stuPath
        ? stuPath.steps.filter((s) => s.status === 'COMPLETED').length
        : 0;
      const pathCompletionPercent =
        assignedSteps > 0 ? calculatePathCompletion(completedSteps, assignedSteps) : 0;
      const hintsUsed = stuPath
        ? stuPath.steps.reduce((sum, st) => sum + (st.hintsUsedCount || 0), 0)
        : 0;
      const chkStep = stuPath?.steps.find((s) => s.stepType === 'CHECKPOINT');
      const checkpointScore =
        chkStep && chkStep.scorePercent !== undefined ? chkStep.scorePercent : null;
      const teacherInterventions = db.teacherOverrides.filter(
        (o) =>
          o.studentId === student.userId &&
          (o.action === 'MODIFY' || o.targetType === 'CLASS_GROUPING')
      ).length;

      const metricRecord: ExperimentStudentMetric = {
        metricId: existingMetric?.metricId || `exp_metric_${exp.experimentId}_${student.userId}`,
        schoolId: exp.schoolId,
        experimentId: exp.experimentId,
        studentId: student.userId,
        studentName: student.fullName,
        studentCode: student.code,
        status: gainInfo.status,
        preAttemptId: preAttempt?.attemptId ?? null,
        postAttemptId: postAttempt?.attemptId ?? null,
        preSubmittedAt: preAttempt?.submittedAt ?? null,
        postSubmittedAt: postAttempt?.submittedAt ?? null,
        baseline,
        outcome,
        preScore,
        postScore,
        absoluteGain: gainInfo.absoluteGain,
        normalizedGain: gainInfo.normalizedGain,
        competencyPre: preComp,
        competencyPost: postComp,
        preErrorCount: preErr,
        postErrorCount: postErr,
        errorReductionPercent,
        assignedSteps,
        completedSteps,
        pathCompletionPercent,
        hintsUsed,
        checkpointScore,
        teacherInterventions,
        dataSource: exp.dataSource,
        createdAt: existingMetric?.createdAt || now,
        updatedAt: now,
      };

      if (existingMetric) {
        Object.assign(existingMetric, metricRecord);
      } else {
        db.experimentStudentMetrics.push(metricRecord);
      }
    }
  }
}

let cachedDb: PersistentDatabaseSchema | null = null;

export function getDatabase(): PersistentDatabaseSchema {
  if (cachedDb) return cachedDb;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      cachedDb = JSON.parse(raw) as PersistentDatabaseSchema;
      const seed = createInitialSeedDatabase();
      let dbModified = false;

      // Migrate legacy experiment ID or missing attempt-backed baseline/outcome records
      const hasLegacyExpId = cachedDb.experiments.some(
        (e) => e.experimentId !== 'exp_demo_8a2_completed' && e.experimentId !== 'exp_demo_preview' && e.title.includes('Thực nghiệm Sư phạm Mẫu')
      );
      if (hasLegacyExpId || cachedDb.attempts.length === 0) {
        cachedDb = seed;
        saveDatabase(cachedDb);
        return cachedDb;
      }

      cachedDb.topics.forEach((t) => {
        const seedTopic = seed.topics.find((st) => st.code === t.code);
        if (seedTopic && (!t.knowledgeItems || t.knowledgeItems.length === 0)) {
          t.description = t.description || seedTopic.description;
          t.knowledgeSummary = t.knowledgeSummary || seedTopic.knowledgeSummary;
          t.knowledgeItems = seedTopic.knowledgeItems;
          dbModified = true;
        }
      });

      syncExperimentMetricsFromAttempts(cachedDb);
      if (dbModified) {
        saveDatabase(cachedDb);
      }
      return cachedDb;
    } catch (e) {
      console.error('Failed to parse existing DB file, recreating seed DB:', e);
    }
  }

  cachedDb = createInitialSeedDatabase();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: PersistentDatabaseSchema): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function resetToInitialSeedDatabase(): PersistentDatabaseSchema {
  cachedDb = createInitialSeedDatabase();
  saveDatabase(cachedDb);
  return cachedDb;
}
