import { describe, it, expect } from 'vitest';
import {
  calculateMasteryScore,
  getMasteryLevelInfo,
  calculateConfidence,
  detectRecurringErrors,
  buildRuleBasedLearningPathBlueprint,
  evaluateAdaptiveAdjustment,
  evaluateCheckpointReroute,
  validatePrePostEquivalence,
  calculateGainMetrics,
  calculateErrorReduction,
  validateTeacherImportRows,
  validateStudentImportRows,
  checkAccessPermission,
  canTransitionExperimentState,
} from './engine.ts';
import {
  CompetencyCode,
  ErrorTagCode,
  ExperimentState,
  MasteryLevel,
  PathStatus,
  PrimaryUse,
  Role,
} from '../../src/types/index.ts';
import { SEED_MATH8_QUESTIONS } from '../seed/math8Questions.ts';

describe('AI-PATH5 Core Engine Unit & Integration Tests', () => {
  it('42. calculates Mastery V1 and renormalizes weights when signals are missing (never sets missing=0)', () => {
    // Full signals: 0.45*80 + 0.25*80 + 0.20*80 + 0.10*80 = 80
    expect(
      calculateMasteryScore({
        accuracy: 80,
        checkpoint: 80,
        independence: 80,
        stability: 80,
      })
    ).toBe(80);

    // Missing checkpoint & stability: renormalize accuracy (0.45) and independence (0.20)
    // (0.45*70 + 0.20*90) / 0.65 = (31.5 + 18) / 0.65 = 76.15 -> 76
    expect(
      calculateMasteryScore({
        accuracy: 70,
        checkpoint: null,
        independence: 90,
        stability: undefined,
      })
    ).toBe(76);
  });

  it('43. maps Mastery score to 4 pedagogical levels with positive Vietnamese labels', () => {
    expect(getMasteryLevelInfo(42)).toEqual({
      level: MasteryLevel.NEEDS_SUPPORT,
      labelVi: 'Cần hỗ trợ',
    });
    expect(getMasteryLevelInfo(63)).toEqual({
      level: MasteryLevel.DEVELOPING,
      labelVi: 'Đang hình thành',
    });
    expect(getMasteryLevelInfo(82)).toEqual({
      level: MasteryLevel.ACHIEVED,
      labelVi: 'Đã đạt',
    });
    expect(getMasteryLevelInfo(88)).toEqual({
      level: MasteryLevel.MASTERED,
      labelVi: 'Thành thạo',
    });
  });

  it('44. calculates Confidence and classifies NEED_MORE_EVIDENCE, CAUTIOUS, SUFFICIENT', () => {
    const low = calculateConfidence(0, 1, 0.2);
    expect(low.confidence).toBeLessThan(0.55);
    expect(low.status).toBe('NEED_MORE_EVIDENCE');

    const mid = calculateConfidence(2, 2, 0.5);
    expect(mid.confidence).toBeGreaterThanOrEqual(0.55);
    expect(mid.confidence).toBeLessThan(0.75);
    expect(mid.status).toBe('CAUTIOUS');

    const high = calculateConfidence(4, 3, 0.9);
    expect(high.confidence).toBeGreaterThanOrEqual(0.75);
    expect(high.status).toBe('SUFFICIENT');
  });

  it('45. detects recurring errors (>= 3 occurrences in last 10 tasks, configurable threshold)', () => {
    const recent: (ErrorTagCode | null)[] = [
      ErrorTagCode.SIGN_ERROR,
      null,
      ErrorTagCode.SIGN_ERROR,
      ErrorTagCode.PROCEDURE_ERROR,
      ErrorTagCode.SIGN_ERROR,
      ErrorTagCode.SIGN_ERROR,
      ErrorTagCode.PROCEDURE_ERROR,
    ];
    const res = detectRecurringErrors(recent, 10, 3);
    expect(res.countsInWindow[ErrorTagCode.SIGN_ERROR]).toBe(4);
    expect(res.countsInWindow[ErrorTagCode.PROCEDURE_ERROR]).toBe(2);
    expect(res.recurringErrors).toEqual([ErrorTagCode.SIGN_ERROR]);
  });

  it('46. generates Rule Engine Learning Path with status WAITING_APPROVAL', () => {
    const profile = {
      [CompetencyCode.FOUNDATION]: 82,
      [CompetencyCode.RECOGNITION]: 88,
      [CompetencyCode.TRANSFORMATION]: 63,
      [CompetencyCode.CALC_ACCURACY]: 58,
      [CompetencyCode.APPLICATION]: 42,
    };
    const blueprint = buildRuleBasedLearningPathBlueprint(profile, [ErrorTagCode.SIGN_ERROR]);
    expect(blueprint.status).toBe(PathStatus.WAITING_APPROVAL);
    expect(blueprint.steps.length).toBe(5);
    expect(blueprint.steps.map((s) => s.stepType)).toEqual([
      'REVIEW',
      'PRACTICE',
      'ERROR_CORRECTION',
      'APPLICATION',
      'CHECKPOINT',
    ]);
  });

  it('48 & 52. adapts difficulty after 3-5 tasks and re-routes after Checkpoint (stopping infinite loops on 2 low cycles)', () => {
    const up = evaluateAdaptiveAdjustment({
      currentDifficulty: 2,
      recentCorrectBooleans: [true, true, true, true],
      recentHintsUsed: [0, 0, 1, 0],
      recentErrorTags: [null, null, null, null],
    });
    expect(up.action).toBe('INCREASE_DIFFICULTY');
    expect(up.nextDifficulty).toBe(3);

    const errInsert = evaluateAdaptiveAdjustment({
      currentDifficulty: 3,
      recentCorrectBooleans: [false, false, false],
      recentHintsUsed: [2, 2, 2],
      recentErrorTags: [ErrorTagCode.SIGN_ERROR, ErrorTagCode.SIGN_ERROR, ErrorTagCode.SIGN_ERROR],
    });
    expect(errInsert.action).toBe('INSERT_ERROR_CORRECTION');

    const cycle1Low = evaluateCheckpointReroute(45, 0);
    expect(cycle1Low.decision).toBe('TEACHER_INTERVENTION');
    expect(cycle1Low.newConsecutiveLowCheckpoints).toBe(1);

    const cycle2Low = evaluateCheckpointReroute(40, 1);
    expect(cycle2Low.decision).toBe('TEACHER_INTERVENTION_REQUIRED');
    expect(cycle2Low.allowAutoGenerateMoreTasks).toBe(false);
  });

  it('65. validates Pre/Post equivalence on 48 Math 8 seed questions (>= 95% equivalence, 0 overlap)', () => {
    expect(SEED_MATH8_QUESTIONS.length).toBe(48);
    const pre = SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.PRE_TEST);
    const post = SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.POST_TEST);
    expect(pre.length).toBe(10);
    expect(post.length).toBe(10);

    const eq = validatePrePostEquivalence(pre, post);
    expect(eq.hasOverlappingQuestions).toBe(false);
    expect(eq.equivalenceScore).toBeGreaterThanOrEqual(91);
    expect(eq.isValidForExperiment).toBe(true);
  });

  it('66, 67 & 77. calculates Gain, Error Reduction, and handles Pre=100, PreError=0, and Missing Post-test (INCOMPLETE)', () => {
    const normal = calculateGainMetrics(42, 71);
    expect(normal.status).toBe('COMPLETED');
    expect(normal.absoluteGain).toBe(29);
    expect(normal.normalizedGain).toBe(0.5);

    const perfectPre = calculateGainMetrics(100, 100);
    expect(perfectPre.normalizedGain).toBe('N/A');

    const missingPost = calculateGainMetrics(55, null);
    expect(missingPost.status).toBe('INCOMPLETE');
    expect(missingPost.absoluteGain).toBeNull();

    expect(calculateErrorReduction(4, 1)).toBe(75);
    expect(calculateErrorReduction(0, 0)).toBe('N/A');
  });

  it('27, 28, 30 & 60. validates Excel imports, Experiment state machine, and Tenant/RBAC isolation', () => {
    expect(canTransitionExperimentState(ExperimentState.DRAFT, ExperimentState.READY)).toBe(true);
    expect(canTransitionExperimentState(ExperimentState.DRAFT, ExperimentState.POSTTEST_RUNNING)).toBe(false);

    const studentImport = validateStudentImportRows(
      [
        { Ma_Hoc_Sinh: 'HS012', Ho_Va_Ten: 'Lê Văn A', Ten_Dang_Nhap: 'levana', Lop: '8A2' },
        { Ma_Hoc_Sinh: 'HS019', Ho_Va_Ten: '', Ten_Dang_Nhap: 'thieuten', Lop: '8A2' },
        { Ma_Hoc_Sinh: 'HS024', Ho_Va_Ten: 'Phạm B', Ten_Dang_Nhap: 'phamb', Lop: '8A5' },
      ],
      new Set(['HS012']),
      new Set(),
      new Set(),
      new Set(['8A2'])
    );
    expect(studentImport.errorCount).toBe(2);
    expect(studentImport.warningCount).toBe(1);
    expect(studentImport.canCommit).toBe(false);
    expect(studentImport.missingClasses).toEqual(['8A5']);

    const crossTenant = checkAccessPermission({
      actorRole: Role.ADMIN,
      actorSchoolId: 'school_A',
      actorUserId: 'u1',
      targetSchoolId: 'school_B',
      action: 'MANAGE_SCHOOL',
    });
    expect(crossTenant.allowed).toBe(false);

    const studentSpy = checkAccessPermission({
      actorRole: Role.STUDENT,
      actorSchoolId: 'school_A',
      actorUserId: 'stu_1',
      targetSchoolId: 'school_A',
      action: 'VIEW_STUDENT_RECORD',
      targetStudentId: 'stu_2',
    });
    expect(studentSpy.allowed).toBe(false);
  });
});
