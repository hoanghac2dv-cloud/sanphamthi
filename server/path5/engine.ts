import {
  CompetencyCode,
  ErrorTagCode,
  MasteryLevel,
  PathStatus,
  PrimaryUse,
  Question,
  Role,
  ExperimentState,
  ImportValidationResult,
  ImportPreviewRow,
} from '../../src/types/index.ts';

/**
 * 42. MASTERY ENGINE V1
 * Formula:
 * Mastery = 45% Accuracy + 25% Checkpoint + 20% Independence + 10% Stability
 * If signals are missing (undefined/null), renormalize weights among available signals.
 * Never assign missing signal = 0.
 */
export interface MasterySignals {
  accuracy?: number | null; // 0..100
  checkpoint?: number | null; // 0..100
  independence?: number | null; // 0..100 (e.g. 100 - hintDependencyPenalty)
  stability?: number | null; // 0..100
}

export function calculateMasteryScore(signals: MasterySignals): number {
  const weights: { key: keyof MasterySignals; weight: number }[] = [
    { key: 'accuracy', weight: 0.45 },
    { key: 'checkpoint', weight: 0.25 },
    { key: 'independence', weight: 0.20 },
    { key: 'stability', weight: 0.10 },
  ];

  let activeWeightSum = 0;
  let weightedValueSum = 0;

  for (const item of weights) {
    const val = signals[item.key];
    if (typeof val === 'number' && !Number.isNaN(val)) {
      const clamped = Math.max(0, Math.min(100, val));
      activeWeightSum += item.weight;
      weightedValueSum += clamped * item.weight;
    }
  }

  if (activeWeightSum === 0) {
    return 0;
  }

  return Math.round(weightedValueSum / activeWeightSum);
}

/**
 * 43. LEVELS
 * 0-49: Needs Support (Cần hỗ trợ)
 * 50-69: Developing (Đang hình thành)
 * 70-84: Achieved (Đã đạt)
 * 85-100: Mastered (Thành thạo)
 */
export function getMasteryLevelInfo(score: number): {
  level: MasteryLevel;
  labelVi: 'Cần hỗ trợ' | 'Đang hình thành' | 'Đã đạt' | 'Thành thạo';
} {
  const s = Math.round(score);
  if (s < 50) {
    return { level: MasteryLevel.NEEDS_SUPPORT, labelVi: 'Cần hỗ trợ' };
  }
  if (s < 70) {
    return { level: MasteryLevel.DEVELOPING, labelVi: 'Đang hình thành' };
  }
  if (s < 85) {
    return { level: MasteryLevel.ACHIEVED, labelVi: 'Đã đạt' };
  }
  return { level: MasteryLevel.MASTERED, labelVi: 'Thành thạo' };
}

/**
 * 44. CONFIDENCE
 * < 0.55 -> NEED_MORE_EVIDENCE
 * 0.55 - 0.74 -> CAUTIOUS (đề xuất thận trọng)
 * >= 0.75 -> SUFFICIENT (đủ tạo Learning Path)
 */
export function calculateConfidence(
  evidenceCount: number,
  signalsPresentCount: number,
  varianceScore = 0.85
): {
  confidence: number;
  status: 'NEED_MORE_EVIDENCE' | 'CAUTIOUS' | 'SUFFICIENT';
} {
  // Base confidence scales with number of observed items and signal completeness
  const countFactor = Math.min(1, evidenceCount / 4); // 4+ questions per competency gives strong evidence
  const signalFactor = Math.min(1, signalsPresentCount / 3);
  const raw = 0.35 + 0.40 * countFactor + 0.15 * signalFactor + 0.10 * Math.max(0, Math.min(1, varianceScore));
  const confidence = Math.round(Math.min(0.98, Math.max(0.1, raw)) * 100) / 100;

  let status: 'NEED_MORE_EVIDENCE' | 'CAUTIOUS' | 'SUFFICIENT' = 'NEED_MORE_EVIDENCE';
  if (confidence >= 0.75) {
    status = 'SUFFICIENT';
  } else if (confidence >= 0.55) {
    status = 'CAUTIOUS';
  }

  return { confidence, status };
}

/**
 * 45. RECURRING ERROR
 * Default: same error tag >= 3 times in last 10 tasks -> recurring error.
 * Threshold is configurable.
 */
export function detectRecurringErrors(
  recentErrorTags: (ErrorTagCode | undefined | null)[],
  windowSize = 10,
  threshold = 3
): {
  countsInWindow: Record<ErrorTagCode, number>;
  recurringErrors: ErrorTagCode[];
} {
  const windowSlice = recentErrorTags.slice(-windowSize);
  const countsInWindow: Record<ErrorTagCode, number> = {
    [ErrorTagCode.CONCEPT_ERROR]: 0,
    [ErrorTagCode.FORMULA_ERROR]: 0,
    [ErrorTagCode.PROCEDURE_ERROR]: 0,
    [ErrorTagCode.SIGN_ERROR]: 0,
    [ErrorTagCode.CALCULATION_ERROR]: 0,
    [ErrorTagCode.APPLICATION_ERROR]: 0,
  };

  for (const tag of windowSlice) {
    if (tag && tag in countsInWindow) {
      countsInWindow[tag] += 1;
    }
  }

  const recurringErrors = (Object.keys(countsInWindow) as ErrorTagCode[]).filter(
    (tag) => countsInWindow[tag] >= threshold
  );

  return { countsInWindow, recurringErrors };
}

/**
 * 46. PATH GENERATION (Rule Engine)
 * Rule Engine decides the structural Learning Path framework.
 * Gemini only explains it.
 * Status is always WAITING_APPROVAL when generated.
 */
export interface GeneratedStepBlueprint {
  stepOrder: number;
  stepType: 'REVIEW' | 'PRACTICE' | 'ERROR_CORRECTION' | 'APPLICATION' | 'CHECKPOINT';
  title: string;
  description: string;
  targetCompetency: CompetencyCode;
  targetErrorTag?: ErrorTagCode;
  targetDifficulty: 1 | 2 | 3 | 4 | 5;
}

export function buildRuleBasedLearningPathBlueprint(
  competencyScores: Record<CompetencyCode, number>,
  recurringErrors: ErrorTagCode[]
): {
  status: PathStatus;
  steps: GeneratedStepBlueprint[];
  weakCompetencies: { competency: CompetencyCode; score: number }[];
} {
  const orderedCompetencies: CompetencyCode[] = [
    CompetencyCode.FOUNDATION,
    CompetencyCode.RECOGNITION,
    CompetencyCode.TRANSFORMATION,
    CompetencyCode.CALC_ACCURACY,
    CompetencyCode.APPLICATION,
  ];

  const sortedByWeakness = [...orderedCompetencies]
    .map((c) => ({ competency: c, score: competencyScores[c] ?? 50 }))
    .sort((a, b) => a.score - b.score);

  const weakest = sortedByWeakness[0];
  const secondWeakest = sortedByWeakness[1] || weakest;
  const primaryError = recurringErrors[0];

  const steps: GeneratedStepBlueprint[] = [];

  // Step 1: Review foundational concept or sign/procedure rule
  steps.push({
    stepOrder: 1,
    stepType: 'REVIEW',
    title:
      primaryError === ErrorTagCode.SIGN_ERROR
        ? 'Ôn tập quy tắc dấu khi đặt nhân tử chung'
        : `Hệ thống hóa kiến thức trọng tâm: ${getCompetencyNameVi(weakest.competency)}`,
    description:
      primaryError === ErrorTagCode.SIGN_ERROR
        ? 'Nắm vững quy tắc đổi dấu khi đưa hạng tử vào trong hoặc ra ngoài dấu ngoặc trước khi phân tích.'
        : 'Ôn tập có hướng dẫn các bước nhận diện và phân tích đa thức thành nhân tử.',
    targetCompetency: weakest.score < 65 ? secondWeakest.competency : CompetencyCode.FOUNDATION,
    targetErrorTag: primaryError,
    targetDifficulty: 2,
  });

  // Step 2: Guided Practice on Transformation / second weakest competency
  const practiceComp =
    competencyScores[CompetencyCode.TRANSFORMATION] < 75
      ? CompetencyCode.TRANSFORMATION
      : secondWeakest.competency;

  steps.push({
    stepOrder: 2,
    stepType: 'PRACTICE',
    title: `Luyện tập thích ứng: ${getCompetencyNameVi(practiceComp)}`,
    description: 'Thực hành phân tích đa thức theo từng bước với hệ thống gợi ý 3 cấp độ.',
    targetCompetency: practiceComp,
    targetDifficulty: practiceComp === CompetencyCode.APPLICATION ? 3 : 2,
  });

  // Step 3: Error Correction (if recurring error exists or accuracy/transformation < 75)
  const targetError = primaryError || ErrorTagCode.SIGN_ERROR;
  steps.push({
    stepOrder: 3,
    stepType: 'ERROR_CORRECTION',
    title: `Trạm sửa lỗi chuyên sâu: ${getErrorNameVi(targetError)}`,
    description: 'Phát hiện lỗi sai trong lời giải mẫu và tự hoàn thiện bước biến đổi đúng.',
    targetCompetency:
      targetError === ErrorTagCode.SIGN_ERROR
        ? CompetencyCode.TRANSFORMATION
        : CompetencyCode.CALC_ACCURACY,
    targetErrorTag: targetError,
    targetDifficulty: 3,
  });

  // Step 4: Application practice
  steps.push({
    stepOrder: 4,
    stepType: 'APPLICATION',
    title: 'Vận dụng phân tích đa thức vào bài toán tìm x và tính nhanh',
    description: 'Kết hợp nhiều phương pháp phân tích đa thức để giải quyết bài toán vận dụng.',
    targetCompetency: CompetencyCode.APPLICATION,
    targetDifficulty: competencyScores[CompetencyCode.APPLICATION] < 50 ? 2 : 3,
  });

  // Step 5: Independent Checkpoint (No hints)
  steps.push({
    stepOrder: 5,
    stepType: 'CHECKPOINT',
    title: 'Checkpoint đánh giá độc lập (Không sử dụng gợi ý)',
    description: 'Kiểm tra mức độ tự chủ và độ vững chắc năng lực sau lộ trình cá nhân hóa.',
    targetCompetency: weakest.competency,
    targetDifficulty: 3,
  });

  return {
    status: PathStatus.WAITING_APPROVAL,
    steps,
    weakCompetencies: sortedByWeakness.filter((x) => x.score < 70),
  };
}

/**
 * 48. ADAPTIVE LEARNING (P4 - HELP & ADAPT)
 * After 3-5 questions:
 * - accuracy >= 80% AND low hint dependency (avgHintsPerQuestion <= 0.5) -> difficulty + 1 (max 5)
 * - 60-79% -> keep difficulty
 * - < 60% -> difficulty - 1 (min 1) + flag review
 * - if recurring error -> insert Error Correction
 */
export function evaluateAdaptiveAdjustment(params: {
  currentDifficulty: 1 | 2 | 3 | 4 | 5;
  recentCorrectBooleans: boolean[]; // last 3-5 responses
  recentHintsUsed: number[]; // hints used per response
  recentErrorTags: (ErrorTagCode | undefined | null)[];
  recurringThreshold?: number;
}): {
  nextDifficulty: 1 | 2 | 3 | 4 | 5;
  action: 'INCREASE_DIFFICULTY' | 'KEEP_DIFFICULTY' | 'DECREASE_AND_REVIEW' | 'INSERT_ERROR_CORRECTION';
  accuracyPercent: number;
  avgHintsUsed: number;
  triggeredErrorTag?: ErrorTagCode;
} {
  const { currentDifficulty, recentCorrectBooleans, recentHintsUsed, recentErrorTags, recurringThreshold = 3 } = params;
  const count = recentCorrectBooleans.length;
  if (count === 0) {
    return {
      nextDifficulty: currentDifficulty,
      action: 'KEEP_DIFFICULTY',
      accuracyPercent: 0,
      avgHintsUsed: 0,
    };
  }

  const correctCount = recentCorrectBooleans.filter(Boolean).length;
  const accuracyPercent = Math.round((correctCount / count) * 100);
  const totalHints = recentHintsUsed.reduce((acc, h) => acc + h, 0);
  const avgHintsUsed = Math.round((totalHints / count) * 100) / 100;

  const { recurringErrors } = detectRecurringErrors(recentErrorTags, 10, recurringThreshold);
  if (recurringErrors.length > 0) {
    return {
      nextDifficulty: Math.max(1, currentDifficulty - 1) as 1 | 2 | 3 | 4 | 5,
      action: 'INSERT_ERROR_CORRECTION',
      accuracyPercent,
      avgHintsUsed,
      triggeredErrorTag: recurringErrors[0],
    };
  }

  if (accuracyPercent >= 80 && avgHintsUsed <= 0.5) {
    const nextDiff = Math.min(5, currentDifficulty + 1) as 1 | 2 | 3 | 4 | 5;
    return {
      nextDifficulty: nextDiff,
      action: 'INCREASE_DIFFICULTY',
      accuracyPercent,
      avgHintsUsed,
    };
  }

  if (accuracyPercent < 60) {
    const nextDiff = Math.max(1, currentDifficulty - 1) as 1 | 2 | 3 | 4 | 5;
    return {
      nextDifficulty: nextDiff,
      action: 'DECREASE_AND_REVIEW',
      accuracyPercent,
      avgHintsUsed,
    };
  }

  return {
    nextDifficulty: currentDifficulty,
    action: 'KEEP_DIFFICULTY',
    accuracyPercent,
    avgHintsUsed,
  };
}

/**
 * 52. RE-ROUTE (P5 - RE-ROUTE after Checkpoint)
 * >= 85 -> MASTERED
 * 70 - 84 -> LIGHT_REINFORCEMENT (thêm củng cố nhẹ)
 * 50 - 69 -> RETURN_WEAK_COMPETENCY (quay lại competency cần hỗ trợ)
 * < 50 -> TEACHER_INTERVENTION
 * If 2 consecutive cycles < 50 -> TEACHER_INTERVENTION_REQUIRED (Do not generate infinite tasks)
 */
export function evaluateCheckpointReroute(
  checkpointScore: number,
  previousConsecutiveLowCheckpoints: number
): {
  decision:
    | 'MASTERED'
    | 'LIGHT_REINFORCEMENT'
    | 'RETURN_WEAK_COMPETENCY'
    | 'TEACHER_INTERVENTION'
    | 'TEACHER_INTERVENTION_REQUIRED';
  newConsecutiveLowCheckpoints: number;
  allowAutoGenerateMoreTasks: boolean;
  messageVi: string;
} {
  const score = Math.round(checkpointScore);
  if (score >= 85) {
    return {
      decision: 'MASTERED',
      newConsecutiveLowCheckpoints: 0,
      allowAutoGenerateMoreTasks: false,
      messageVi: 'Thành thạo năng lực mục tiêu! Hoàn thành xuất sắc chu trình PATH5.',
    };
  }

  if (score >= 70) {
    return {
      decision: 'LIGHT_REINFORCEMENT',
      newConsecutiveLowCheckpoints: 0,
      allowAutoGenerateMoreTasks: true,
      messageVi: 'Đã đạt chuẩn năng lực (70–84%). Hệ thống bổ sung 1 nhiệm vụ củng cố nhẹ để tiến tới Thành thạo.',
    };
  }

  if (score >= 50) {
    return {
      decision: 'RETURN_WEAK_COMPETENCY',
      newConsecutiveLowCheckpoints: 0,
      allowAutoGenerateMoreTasks: true,
      messageVi: 'Đang hình thành (50–69%). Tái định tuyến quay lại củng cố năng lực trọng tâm với hướng dẫn từng bước.',
    };
  }

  const nextLowCount = previousConsecutiveLowCheckpoints + 1;
  if (nextLowCount >= 2) {
    return {
      decision: 'TEACHER_INTERVENTION_REQUIRED',
      newConsecutiveLowCheckpoints: nextLowCount,
      allowAutoGenerateMoreTasks: false,
      messageVi:
        'Cần giáo viên hỗ trợ trực tiếp (2 chu trình Checkpoint liên tiếp dưới 50%). Hệ thống tạm dừng tự sinh bài để giáo viên can thiệp sư phạm.',
    };
  }

  return {
    decision: 'TEACHER_INTERVENTION',
    newConsecutiveLowCheckpoints: nextLowCount,
    allowAutoGenerateMoreTasks: false,
    messageVi: 'Cần hỗ trợ (<50%). Đã gửi thông báo để giáo viên xem xét hỗ trợ và điều chỉnh lộ trình.',
  };
}

/**
 * 65. PRE/POST EQUIVALENCE VALIDATOR
 * Compares competencies, difficulty, total points, question types, distribution.
 * Also ensures zero overlapping questionIds between Pre-test and Post-test.
 */
export function validatePrePostEquivalence(
  preQuestions: Question[],
  postQuestions: Question[]
): {
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
} {
  if (preQuestions.length === 0 || postQuestions.length === 0) {
    return {
      equivalenceScore: 0,
      hasOverlappingQuestions: false,
      details: {
        competencyMatchPercent: 0,
        difficultyMatchPercent: 0,
        pointsMatchPercent: 0,
        questionTypeMatchPercent: 0,
        countMatchPercent: 0,
      },
      isValidForExperiment: false,
    };
  }

  const preIds = new Set(preQuestions.map((q) => q.questionId));
  const hasOverlappingQuestions = postQuestions.some((q) => preIds.has(q.questionId));

  // 1. Question count similarity
  const maxLen = Math.max(preQuestions.length, postQuestions.length);
  const minLen = Math.min(preQuestions.length, postQuestions.length);
  const countMatchPercent = Math.round((minLen / maxLen) * 100);

  // 2. Total points similarity
  const prePoints = preQuestions.reduce((s, q) => s + q.points, 0);
  const postPoints = postQuestions.reduce((s, q) => s + q.points, 0);
  const pointsMatchPercent =
    Math.max(prePoints, postPoints) > 0
      ? Math.round((Math.min(prePoints, postPoints) / Math.max(prePoints, postPoints)) * 100)
      : 100;

  // 3. Competency distribution similarity
  const competencies = Object.values(CompetencyCode);
  let compDiffSum = 0;
  for (const comp of competencies) {
    const preRatio = preQuestions.filter((q) => q.competency === comp).length / preQuestions.length;
    const postRatio = postQuestions.filter((q) => q.competency === comp).length / postQuestions.length;
    compDiffSum += Math.abs(preRatio - postRatio);
  }
  const competencyMatchPercent = Math.round(Math.max(0, (1 - compDiffSum / 2) * 100));

  // 4. Average difficulty similarity
  const preAvgDiff = preQuestions.reduce((s, q) => s + q.difficulty, 0) / preQuestions.length;
  const postAvgDiff = postQuestions.reduce((s, q) => s + q.difficulty, 0) / postQuestions.length;
  const difficultyMatchPercent = Math.round(Math.max(0, (1 - Math.abs(preAvgDiff - postAvgDiff) / 4) * 100));

  // 5. Question type distribution similarity
  const allTypes = Array.from(new Set([...preQuestions.map((q) => q.questionType), ...postQuestions.map((q) => q.questionType)]));
  let typeDiffSum = 0;
  for (const t of allTypes) {
    const preR = preQuestions.filter((q) => q.questionType === t).length / preQuestions.length;
    const postR = postQuestions.filter((q) => q.questionType === t).length / postQuestions.length;
    typeDiffSum += Math.abs(preR - postR);
  }
  const questionTypeMatchPercent = Math.round(Math.max(0, (1 - typeDiffSum / 2) * 100));

  const rawScore = Math.round(
    0.30 * competencyMatchPercent +
      0.25 * difficultyMatchPercent +
      0.20 * pointsMatchPercent +
      0.15 * questionTypeMatchPercent +
      0.10 * countMatchPercent
  );

  const equivalenceScore = hasOverlappingQuestions ? Math.min(45, rawScore) : rawScore;

  return {
    equivalenceScore,
    hasOverlappingQuestions,
    details: {
      competencyMatchPercent,
      difficultyMatchPercent,
      pointsMatchPercent,
      questionTypeMatchPercent,
      countMatchPercent,
    },
    isValidForExperiment: !hasOverlappingQuestions && equivalenceScore >= 75,
  };
}

/**
 * 66. GAIN
 * Absolute Gain = Post - Pre
 * Normalized Gain = (Post - Pre) / (100 - Pre)
 * If Pre = 100 -> 'N/A'
 */
export function calculateGainMetrics(
  preScore: number | null | undefined,
  postScore: number | null | undefined
): {
  status: 'COMPLETED' | 'INCOMPLETE';
  absoluteGain: number | null;
  normalizedGain: number | null | 'N/A';
} {
  if (
    preScore === null ||
    preScore === undefined ||
    postScore === null ||
    postScore === undefined ||
    Number.isNaN(preScore) ||
    Number.isNaN(postScore)
  ) {
    return {
      status: 'INCOMPLETE',
      absoluteGain: null,
      normalizedGain: null,
    };
  }

  const absoluteGain = Math.round((postScore - preScore) * 10) / 10;
  if (preScore >= 100) {
    return {
      status: 'COMPLETED',
      absoluteGain,
      normalizedGain: 'N/A',
    };
  }

  const norm = Math.round(((postScore - preScore) / (100 - preScore)) * 100) / 100;
  return {
    status: 'COMPLETED',
    absoluteGain,
    normalizedGain: norm,
  };
}

/**
 * 67. ERROR REDUCTION
 * ((Pre Error - Post Error) / Pre Error) * 100
 * If Pre Error = 0 -> 'N/A'
 */
export function calculateErrorReduction(preErrorCount: number, postErrorCount: number): number | 'N/A' {
  if (preErrorCount <= 0) {
    return 'N/A';
  }
  return Math.round(((preErrorCount - postErrorCount) / preErrorCount) * 1000) / 10;
}

/**
 * 68. PATH COMPLETION
 * Completed Steps / Assigned Steps * 100
 */
export function calculatePathCompletion(completedSteps: number, assignedSteps: number): number {
  if (assignedSteps <= 0) return 0;
  return Math.round((Math.min(completedSteps, assignedSteps) / assignedSteps) * 100);
}

/**
 * 60. EXPERIMENT STATE TRANSITION VALIDATOR
 * DRAFT -> READY -> PRETEST_RUNNING -> INTERVENTION_RUNNING -> POSTTEST_RUNNING -> COMPLETED -> ARCHIVED
 */
const VALID_EXPERIMENT_TRANSITIONS: Record<ExperimentState, ExperimentState[]> = {
  [ExperimentState.DRAFT]: [ExperimentState.READY],
  [ExperimentState.READY]: [ExperimentState.PRETEST_RUNNING],
  [ExperimentState.PRETEST_RUNNING]: [ExperimentState.INTERVENTION_RUNNING],
  [ExperimentState.INTERVENTION_RUNNING]: [ExperimentState.POSTTEST_RUNNING],
  [ExperimentState.POSTTEST_RUNNING]: [ExperimentState.COMPLETED],
  [ExperimentState.COMPLETED]: [ExperimentState.ARCHIVED],
  [ExperimentState.ARCHIVED]: [],
};

export function canTransitionExperimentState(from: ExperimentState, to: ExperimentState): boolean {
  return (VALID_EXPERIMENT_TRANSITIONS[from] || []).includes(to);
}

/**
 * 27 & 28. EXCEL IMPORT VALIDATION (Backend Validator)
 */
export function validateTeacherImportRows(
  rawRows: Record<string, unknown>[],
  existingCodes: Set<string>,
  existingUsernames: Set<string>,
  existingEmails: Set<string>,
  existingClassNames: Set<string>,
  fileName = 'AI_PATH_Mau_Import_Giao_Vien.xlsx'
): ImportValidationResult {
  const seenCodes = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();
  const missingClassesSet = new Set<string>();
  const rows: ImportPreviewRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const maGV = String(raw['Ma_Giao_Vien'] ?? '').trim();
    const hoTen = String(raw['Ho_Va_Ten'] ?? '').trim();
    const username = String(raw['Ten_Dang_Nhap'] ?? '').trim();
    const email = String(raw['Email'] ?? '').trim();
    const sdt = String(raw['So_Dien_Thoai'] ?? '').trim();
    const mon = String(raw['Mon_Giang_Day'] ?? 'Toán 8').trim();
    const lop = String(raw['Lop_Phu_Trach'] ?? '').trim();
    const trangThai = String(raw['Trang_Thai'] ?? 'ACTIVE').trim() || 'ACTIVE';

    const messages: string[] = [];
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';

    if (!maGV) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Mã giáo viên (Ma_Giao_Vien).`);
    } else if (existingCodes.has(maGV.toUpperCase()) || seenCodes.has(maGV.toUpperCase())) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Mã giáo viên ${maGV} đã tồn tại.`);
    }

    if (!hoTen) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Họ và tên.`);
    }

    if (!username) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Tên đăng nhập (Ten_Dang_Nhap).`);
    } else if (existingUsernames.has(username.toLowerCase()) || seenUsernames.has(username.toLowerCase())) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Tên đăng nhập ${username} đã tồn tại.`);
    }

    if (email && (existingEmails.has(email.toLowerCase()) || seenEmails.has(email.toLowerCase()))) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Email ${email} đã tồn tại.`);
    }

    if (status !== 'ERROR' && (!lop || !existingClassNames.has(lop.toUpperCase()))) {
      status = 'WARNING';
      if (!lop) {
        messages.push(`Dòng ${rowNumber}: Chưa điền Lớp phụ trách — cần kiểm tra phân công sau khi tạo.`);
      } else {
        missingClassesSet.add(lop);
        messages.push(`Dòng ${rowNumber}: Lớp ${lop} chưa tồn tại — cần kiểm tra phân công.`);
      }
    }

    if (maGV) seenCodes.add(maGV.toUpperCase());
    if (username) seenUsernames.add(username.toLowerCase());
    if (email) seenEmails.add(email.toLowerCase());

    rows.push({
      rowNumber,
      rawData: {
        STT: String(raw['STT'] ?? idx + 1),
        Ma_Giao_Vien: maGV,
        Ho_Va_Ten: hoTen,
        Ten_Dang_Nhap: username,
        Email: email,
        So_Dien_Thoai: sdt,
        Mon_Giang_Day: mon,
        Lop_Phu_Trach: lop,
        Trang_Thai: trangThai,
      },
      status,
      messages,
      missingClassName: lop && !existingClassNames.has(lop.toUpperCase()) ? lop : undefined,
    });
  });

  const validCount = rows.filter((r) => r.status === 'VALID').length;
  const warningCount = rows.filter((r) => r.status === 'WARNING').length;
  const errorCount = rows.filter((r) => r.status === 'ERROR').length;

  return {
    importType: 'TEACHER',
    fileName,
    totalRows: rows.length,
    validCount,
    warningCount,
    errorCount,
    canCommit: rows.length > 0 && errorCount === 0,
    missingClasses: Array.from(missingClassesSet),
    rows,
  };
}

export function validateStudentImportRows(
  rawRows: Record<string, unknown>[],
  existingCodes: Set<string>,
  existingUsernames: Set<string>,
  existingEmails: Set<string>,
  existingClassNames: Set<string>,
  fileName = 'AI_PATH_Mau_Import_Hoc_Sinh.xlsx'
): ImportValidationResult {
  const seenCodes = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();
  const missingClassesSet = new Set<string>();
  const rows: ImportPreviewRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const maHS = String(raw['Ma_Hoc_Sinh'] ?? '').trim();
    const hoTen = String(raw['Ho_Va_Ten'] ?? '').trim();
    const username = String(raw['Ten_Dang_Nhap'] ?? '').trim();
    const ngaySinh = String(raw['Ngay_Sinh'] ?? '').trim();
    const gioiTinh = String(raw['Gioi_Tinh'] ?? '').trim();
    const lop = String(raw['Lop'] ?? '').trim();
    const khoi = String(raw['Khoi'] ?? '8').trim();
    const namHoc = String(raw['Nam_Hoc'] ?? '2026-2027').trim();
    const email = String(raw['Email'] ?? '').trim();
    const trangThai = String(raw['Trang_Thai'] ?? 'ACTIVE').trim() || 'ACTIVE';

    const messages: string[] = [];
    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';

    if (!maHS) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Mã học sinh (Ma_Hoc_Sinh).`);
    } else if (existingCodes.has(maHS.toUpperCase()) || seenCodes.has(maHS.toUpperCase())) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Mã học sinh ${maHS} đã tồn tại.`);
    }

    if (!hoTen) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Họ và tên.`);
    }

    if (!username) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Tên đăng nhập (Ten_Dang_Nhap).`);
    } else if (existingUsernames.has(username.toLowerCase()) || seenUsernames.has(username.toLowerCase())) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Tên đăng nhập ${username} đã tồn tại.`);
    }

    if (!lop) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Thiếu Lớp (Lop).`);
    } else if (!existingClassNames.has(lop.toUpperCase())) {
      if (status !== 'ERROR') status = 'WARNING';
      missingClassesSet.add(lop);
      messages.push(`Dòng ${rowNumber}: Lớp ${lop} chưa tồn tại trong năm học hiện tại.`);
    }

    if (email && (existingEmails.has(email.toLowerCase()) || seenEmails.has(email.toLowerCase()))) {
      status = 'ERROR';
      messages.push(`Dòng ${rowNumber}: Email ${email} đã tồn tại.`);
    }

    if (maHS) seenCodes.add(maHS.toUpperCase());
    if (username) seenUsernames.add(username.toLowerCase());
    if (email) seenEmails.add(email.toLowerCase());

    rows.push({
      rowNumber,
      rawData: {
        STT: String(raw['STT'] ?? idx + 1),
        Ma_Hoc_Sinh: maHS,
        Ho_Va_Ten: hoTen,
        Ten_Dang_Nhap: username,
        Ngay_Sinh: ngaySinh,
        Gioi_Tinh: gioiTinh,
        Lop: lop,
        Khoi: khoi,
        Nam_Hoc: namHoc,
        Email: email,
        Trang_Thai: trangThai,
      },
      status,
      messages,
      missingClassName: lop && !existingClassNames.has(lop.toUpperCase()) ? lop : undefined,
    });
  });

  const validCount = rows.filter((r) => r.status === 'VALID').length;
  const warningCount = rows.filter((r) => r.status === 'WARNING').length;
  const errorCount = rows.filter((r) => r.status === 'ERROR').length;

  return {
    importType: 'STUDENT',
    fileName,
    totalRows: rows.length,
    validCount,
    warningCount,
    errorCount,
    canCommit: rows.length > 0 && errorCount === 0 && missingClassesSet.size === 0,
    missingClasses: Array.from(missingClassesSet),
    rows,
  };
}

/**
 * 8, 9, 10, 11, 30. RBAC & TENANT ISOLATION CHECKER
 */
export function checkAccessPermission(params: {
  actorRole: Role;
  actorSchoolId: string;
  actorUserId: string;
  actorAssignedClassIds?: string[];
  targetSchoolId: string;
  action:
    | 'MANAGE_SCHOOL'
    | 'IMPORT_EXCEL'
    | 'VIEW_AI_LOGS'
    | 'APPROVE_PATH'
    | 'VIEW_CLASS_DASHBOARD'
    | 'VIEW_STUDENT_RECORD'
    | 'EDIT_SCORE';
  targetStudentId?: string;
  targetClassId?: string;
}): { allowed: boolean; reason?: string } {
  const {
    actorRole,
    actorSchoolId,
    actorUserId,
    actorAssignedClassIds = [],
    targetSchoolId,
    action,
    targetStudentId,
    targetClassId,
  } = params;

  // 30. Tenant Isolation: School A cannot access School B
  if (actorSchoolId !== targetSchoolId) {
    return { allowed: false, reason: 'Vi phạm cô lập dữ liệu trường học (Tenant Isolation).' };
  }

  if (actorRole === Role.ADMIN) {
    return { allowed: true };
  }

  if (actorRole === Role.TEACHER) {
    if (action === 'MANAGE_SCHOOL' || action === 'IMPORT_EXCEL' || action === 'VIEW_AI_LOGS') {
      return { allowed: false, reason: 'Giáo viên không có quyền Quản trị hệ thống.' };
    }
    if (targetClassId && actorAssignedClassIds.length > 0 && !actorAssignedClassIds.includes(targetClassId)) {
      return { allowed: false, reason: 'Giáo viên không được xem lớp ngoài phân công.' };
    }
    return { allowed: true };
  }

  if (actorRole === Role.STUDENT) {
    if (action === 'VIEW_STUDENT_RECORD') {
      if (targetStudentId && targetStudentId === actorUserId) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Học sinh không được xem dữ liệu của học sinh khác.' };
    }
    return { allowed: false, reason: 'Học sinh không có quyền thực hiện thao tác này.' };
  }

  return { allowed: false, reason: 'Vai trò không hợp lệ.' };
}

export function getCompetencyNameVi(code: CompetencyCode): string {
  switch (code) {
    case CompetencyCode.FOUNDATION:
      return 'Kiến thức nền';
    case CompetencyCode.RECOGNITION:
      return 'Nhận dạng';
    case CompetencyCode.TRANSFORMATION:
      return 'Biến đổi';
    case CompetencyCode.CALC_ACCURACY:
      return 'Chính xác tính toán';
    case CompetencyCode.APPLICATION:
      return 'Vận dụng';
  }
}

export function getErrorNameVi(code: ErrorTagCode): string {
  switch (code) {
    case ErrorTagCode.CONCEPT_ERROR:
      return 'Lỗi khái niệm';
    case ErrorTagCode.FORMULA_ERROR:
      return 'Lỗi hằng đẳng thức / công thức';
    case ErrorTagCode.PROCEDURE_ERROR:
      return 'Lỗi quy trình các bước';
    case ErrorTagCode.SIGN_ERROR:
      return 'Quy tắc dấu';
    case ErrorTagCode.CALCULATION_ERROR:
      return 'Lỗi tính toán hệ số / số mũ';
    case ErrorTagCode.APPLICATION_ERROR:
      return 'Lỗi vận dụng giải toán';
  }
}
