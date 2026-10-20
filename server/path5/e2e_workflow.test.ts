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
  canTransitionExperimentState,
  checkAccessPermission,
} from './engine.ts';
import { SEED_MATH8_QUESTIONS } from '../seed/math8Questions.ts';
import {
  getDatabase,
  verifyPassword,
  hashPassword,
} from '../repositories/database.ts';
import {
  CompetencyCode,
  ErrorTagCode,
  ExperimentState,
  MasteryLevel,
  PrimaryUse,
  Role,
} from '../../src/types/index.ts';

describe('AI PATH V1.0 — End-to-End Definition of Done (Phases 1 to 11)', () => {
  it('Phase 1: Authentication PBKDF2 hashing & RBAC + Multi-tenant isolation', () => {
    const { salt, hash } = hashPassword('Demo@2026');
    expect(verifyPassword('Demo@2026', salt, hash)).toBe(true);
    expect(verifyPassword('WrongPass', salt, hash)).toBe(false);

    // Student cannot read another student's data
    expect(
      checkAccessPermission({
        actorRole: Role.STUDENT,
        actorSchoolId: 'school_demo_aipath',
        actorUserId: 'stu_1',
        targetSchoolId: 'school_demo_aipath',
        action: 'VIEW_STUDENT_RECORD',
        targetStudentId: 'stu_2',
      }).allowed
    ).toBe(false);

    // Teacher cannot read another class outside assignment
    expect(
      checkAccessPermission({
        actorRole: Role.TEACHER,
        actorSchoolId: 'school_demo_aipath',
        actorUserId: 'tea_1',
        actorAssignedClassIds: ['class_8a2'],
        targetSchoolId: 'school_demo_aipath',
        action: 'VIEW_CLASS_DASHBOARD',
        targetClassId: 'class_8a9',
      }).allowed
    ).toBe(false);

    // School A cannot read School B
    expect(
      checkAccessPermission({
        actorRole: Role.ADMIN,
        actorSchoolId: 'school_A',
        actorUserId: 'adm_1',
        targetSchoolId: 'school_B',
        action: 'MANAGE_SCHOOL',
      }).allowed
    ).toBe(false);
  });

  it('Phase 2: Admin Teacher & Student Excel Import Validation & Assignment Check', () => {
    const teacherVal = validateTeacherImportRows(
      [
        {
          Ma_Giao_Vien: 'GV201',
          Ho_Va_Ten: 'Nguyễn Văn An',
          Ten_Dang_Nhap: 'annv_toan8',
          Email: 'an@school.edu.vn',
          Mon_Giang_Day: 'Toán 8',
          Lop_Phu_Trach: '8A2',
        },
        {
          Ma_Giao_Vien: 'GV202',
          Ho_Va_Ten: 'Lê Thị Bình',
          Ten_Dang_Nhap: 'binhlt_toan8',
          Email: 'binh@school.edu.vn',
          Mon_Giang_Day: '',
          Lop_Phu_Trach: '',
        },
      ],
      new Set(['GV001']),
      new Set(['teacher8a2']),
      new Set(),
      new Set(['8A2']),
      'AI_PATH_Mau_Import_Giao_Vien.xlsx'
    );

    expect(teacherVal.validCount).toBe(1);
    expect(teacherVal.warningCount).toBe(1);
    expect(teacherVal.errorCount).toBe(0);
    expect(teacherVal.canCommit).toBe(true);

    const studentVal = validateStudentImportRows(
      [
        {
          Ma_Hoc_Sinh: 'HS8A2_99',
          Ho_Va_Ten: 'Trần Minh Khôi',
          Ten_Dang_Nhap: 'khoitm8a2',
          Lop: '8A2',
          Khoi: '8',
        },
      ],
      new Set(),
      new Set(),
      new Set(),
      new Set(['8A2']),
      'AI_PATH_Mau_Import_Hoc_Sinh.xlsx'
    );

    expect(studentVal.validCount).toBe(1);
    expect(studentVal.canCommit).toBe(true);
  });

  it('Phase 3 & 4: 48 Verified Math 8 Questions & Pre/Post Equivalence >= 90%', () => {
    expect(SEED_MATH8_QUESTIONS.length).toBe(48);
    const preQuestions = SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.PRE_TEST);
    const postQuestions = SEED_MATH8_QUESTIONS.filter((q) => q.primaryUse === PrimaryUse.POST_TEST);
    expect(preQuestions.length).toBe(10);
    expect(postQuestions.length).toBe(10);

    const eq = validatePrePostEquivalence(preQuestions, postQuestions);
    expect(eq.hasOverlappingQuestions).toBe(false);
    expect(eq.equivalenceScore).toBeGreaterThanOrEqual(90);
    expect(eq.isValidForExperiment).toBe(true);
  });

  it('Phase 5: PATH5 Rule Engine -> Mastery, Confidence, Recurring Error, 5-Step Blueprint, Adaptive & Re-route', () => {
    const mastery = calculateMasteryScore({
      accuracy: 42,
      checkpoint: 50,
      independence: 60,
      stability: 50,
    });
    expect(getMasteryLevelInfo(mastery).level).toBe(MasteryLevel.NEEDS_SUPPORT);

    const conf = calculateConfidence(4, 3, 0.9);
    expect(conf.confidence).toBeGreaterThanOrEqual(0.75);
    expect(conf.status).toBe('SUFFICIENT');

    const recurring = detectRecurringErrors(
      [
        ErrorTagCode.SIGN_ERROR,
        ErrorTagCode.SIGN_ERROR,
        ErrorTagCode.SIGN_ERROR,
        ErrorTagCode.PROCEDURE_ERROR,
      ],
      10,
      3
    );
    expect(recurring.recurringErrors).toContain(ErrorTagCode.SIGN_ERROR);

    const blueprint = buildRuleBasedLearningPathBlueprint(
      {
        [CompetencyCode.FOUNDATION]: 75,
        [CompetencyCode.RECOGNITION]: 78,
        [CompetencyCode.TRANSFORMATION]: 62,
        [CompetencyCode.CALC_ACCURACY]: 64,
        [CompetencyCode.APPLICATION]: 42,
      },
      [ErrorTagCode.SIGN_ERROR]
    );

    expect(blueprint.steps.length).toBe(5);
    expect(blueprint.steps[2].stepType).toBe('ERROR_CORRECTION');
    expect(blueprint.steps[2].targetErrorTag).toBe(ErrorTagCode.SIGN_ERROR);

    const adaptUp = evaluateAdaptiveAdjustment({
      currentDifficulty: 2,
      recentCorrectBooleans: [true, true, true, true],
      recentHintsUsed: [0, 0, 0, 0],
      recentErrorTags: [null, null, null, null],
    });
    expect(adaptUp.nextDifficulty).toBe(3);

    const reroutePass = evaluateCheckpointReroute(88, 0);
    expect(reroutePass.decision).toBe('MASTERED');
  });

  it('Phase 9 & 10: Experiment State Machine, Gain/Normalized Gain, Error Reduction & Persistent Seed DB', () => {
    expect(canTransitionExperimentState(ExperimentState.DRAFT, ExperimentState.READY)).toBe(true);
    expect(
      canTransitionExperimentState(ExperimentState.READY, ExperimentState.PRETEST_RUNNING)
    ).toBe(true);
    expect(
      canTransitionExperimentState(
        ExperimentState.PRETEST_RUNNING,
        ExperimentState.INTERVENTION_RUNNING
      )
    ).toBe(true);
    expect(
      canTransitionExperimentState(
        ExperimentState.INTERVENTION_RUNNING,
        ExperimentState.POSTTEST_RUNNING
      )
    ).toBe(true);
    expect(
      canTransitionExperimentState(ExperimentState.POSTTEST_RUNNING, ExperimentState.COMPLETED)
    ).toBe(true);

    const gains = calculateGainMetrics(42, 71);
    expect(gains.absoluteGain).toBe(29);
    expect(gains.normalizedGain).toBe(0.5);

    expect(calculateErrorReduction(4, 1)).toBe(75);

    const db = getDatabase();
    expect(db.schools.length).toBeGreaterThanOrEqual(1);
    expect(db.questions.length).toBeGreaterThanOrEqual(48);
    expect(db.experiments.length).toBeGreaterThanOrEqual(1);
    expect(db.experimentCaseStudies.length).toBeGreaterThanOrEqual(3);
    expect(db.subjects.length).toBeGreaterThanOrEqual(1);
    expect(db.topics.length).toBeGreaterThanOrEqual(1);
    const factoringTopic = db.topics.find((t) => t.code === 'FACTORING_POLYNOMIAL');
    expect(factoringTopic).toBeDefined();
    expect(factoringTopic?.knowledgeSummary).toBeTruthy();
    expect(factoringTopic?.knowledgeItems?.length).toBeGreaterThanOrEqual(3);
  });
});

