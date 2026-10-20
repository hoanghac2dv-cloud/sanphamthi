import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Server } from 'http';
import { app } from '../../server.ts';
import {
  getDatabase,
  saveDatabase,
  resetToInitialSeedDatabase,
  syncExperimentMetricsFromAttempts,
} from '../repositories/database.ts';
import { Role } from '../../src/types/index.ts';
import * as firebaseAdmin from './firebaseAdmin.ts';

describe('PHASE 1 — Authentication, Authorization, Tenant Isolation & Assessment Security', () => {
  let server: Server;
  let baseUrl = '';
  let studentToken = '';
  let teacherToken = '';
  let adminToken = '';

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = '';
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // Reset to clean initial seed database so tests are 100% deterministic and idempotent
    const db = resetToInitialSeedDatabase();
    for (const u of db.users) {
      if (['minhanh8a2', 'teacher8a2', 'admin'].includes(u.username)) {
        u.status = 'ACTIVE';
      }
    }
    saveDatabase(db);

    // Login as Student, Teacher, Admin to get valid tokens
    const loginUser = async (username: string, password: string) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      return data.token as string;
    };

    studentToken = await loginUser('minhanh8a2', 'Demo@2026');
    teacherToken = await loginUser('teacher8a2', 'Demo@2026');
    adminToken = await loginUser('admin', 'Demo@2026');
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  });

  it('Test 1: Forged Google Sync without valid Firebase ID token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@thcsnguyendu.edu.vn',
        displayName: 'Fake Admin',
        uid: 'fake_uid',
      }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it('Test 2: Valid Google Sync without approved account in database returns 403 and does not auto-create ADMIN/TEACHER', async () => {
    const spy = vi.spyOn(firebaseAdmin, 'verifyFirebaseIdToken').mockResolvedValueOnce({
      uid: 'verified_uid_unknown',
      email: 'unknown_hacker@gmail.com',
      emailVerified: true,
      displayName: 'Unknown User',
    });

    const dbBeforeCount = getDatabase().users.length;
    const res = await fetch(`${baseUrl}/api/auth/google-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_valid_firebase_token',
      },
      body: JSON.stringify({ idToken: 'mock_valid_firebase_token' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(['ACCOUNT_NOT_PROVISIONED', 'GOOGLE_ACCOUNT_NOT_PROVISIONED']).toContain(body.code);
    expect(getDatabase().users.length).toBe(dbBeforeCount);
    spy.mockRestore();
  });

  it('Test 3: Disabled user cannot login and existing session token is immediately rejected with 403', async () => {
    const db = getDatabase();
    const student = db.users.find((u) => u.username === 'minhanh8a2')!;
    student.status = 'INACTIVE';
    saveDatabase(db);

    try {
      // 1) Try logging in while INACTIVE
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'minhanh8a2', password: 'Demo@2026' }),
      });
      expect(loginRes.status).toBe(403);

      // 2) Try calling protected API with previously issued token
      const bootRes = await fetch(`${baseUrl}/api/bootstrap`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(bootRes.status).toBe(403);
    } finally {
      const dbRestore = getDatabase();
      const s = dbRestore.users.find((u) => u.username === 'minhanh8a2')!;
      s.status = 'ACTIVE';
      saveDatabase(dbRestore);
    }
  });

  it('Test 4: Student cannot read correctAnswer, solution, hints, errorTags, aiGenerated, or teacherApproved', async () => {
    const forbiddenFields = [
      'correctAnswer',
      'solution',
      'hints',
      'errorTags',
      'aiGenerated',
      'teacherApproved',
    ];

    // Check GET /api/bootstrap
    const bootRes = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(bootRes.status).toBe(200);
    const bootData = await bootRes.json();
    expect(Array.isArray(bootData.questions)).toBe(true);
    expect(bootData.questions.length).toBeGreaterThan(0);

    for (const q of bootData.questions) {
      for (const field of forbiddenFields) {
        expect(q).not.toHaveProperty(field);
      }
    }

    // Student only sees their own user account in bootstrap
    expect(bootData.users).toHaveLength(1);
    expect(bootData.users[0].username).toBe('minhanh8a2');
    expect(bootData.auditLogs).toHaveLength(0);
    expect(bootData.aiRuns).toHaveLength(0);

    // Check GET /api/questions
    const qRes = await fetch(`${baseUrl}/api/questions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(qRes.status).toBe(200);
    const qData = await qRes.json();
    for (const q of qData.questions) {
      for (const field of forbiddenFields) {
        expect(q).not.toHaveProperty(field);
      }
    }

    // Check GET /api/assessments/:assessmentId
    const firstAssessmentId = bootData.assessments[0]?.assessmentId;
    if (firstAssessmentId) {
      const aRes = await fetch(`${baseUrl}/api/assessments/${firstAssessmentId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(aRes.status).toBe(200);
      const aData = await aRes.json();
      for (const q of aData.questions) {
        for (const field of forbiddenFields) {
          expect(q).not.toHaveProperty(field);
        }
      }
    }
  });

  it('Test 5 & Test 6: Wrong answer does not reveal solution; Correct answer returns solution (with step gating)', async () => {
    const db = getDatabase();
    const student = db.users.find((u) => u.username === 'minhanh8a2')!;
    const studentPath = db.learningPaths.find((p) => p.studentId === student.userId)!;
    const activeStep = studentPath.steps.find(
      (s) => s.status === 'AVAILABLE' && s.stepType !== 'CHECKPOINT'
    )!;
    const sampleQ = db.questions.find((q) => q.questionId === activeStep.questionIds[0])!;

    // Verify step gating rejects submission for a question not in an active practice step
    const unauthStepRes = await fetch(`${baseUrl}/api/tasks/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        learningPathId: studentPath.pathId,
        stepId: activeStep.stepId,
        questionId: 'Q_PRE_01',
        studentAnswer: '__DEFINITELY_WRONG_ANSWER__',
        hintsUsed: 0,
      }),
    });
    expect(unauthStepRes.status).toBe(403);

    // Test 5: Wrong Answer on valid assigned step
    const wrongRes = await fetch(`${baseUrl}/api/tasks/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        learningPathId: studentPath.pathId,
        stepId: activeStep.stepId,
        questionId: sampleQ.questionId,
        studentAnswer: '__DEFINITELY_WRONG_ANSWER__',
        hintsUsed: 0,
      }),
    });
    expect(wrongRes.status).toBe(200);
    const wrongData = await wrongRes.json();
    expect(wrongData.isCorrect).toBe(false);
    expect(wrongData.solution).toBeUndefined();
    expect(JSON.stringify(wrongData)).not.toContain(sampleQ.correctAnswer);

    // Test 6: Correct Answer on valid assigned step
    const rightRes = await fetch(`${baseUrl}/api/tasks/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        learningPathId: studentPath.pathId,
        stepId: activeStep.stepId,
        questionId: sampleQ.questionId,
        studentAnswer: sampleQ.correctAnswer,
        hintsUsed: 0,
      }),
    });
    expect(rightRes.status).toBe(200);
    const rightData = await rightRes.json();
    expect(rightData.isCorrect).toBe(true);
    expect(rightData.solution).toBe(sampleQ.solution);

    // Restore step 4 back to AVAILABLE so subsequent tests see initial 3/5 completed steps
    activeStep.status = 'AVAILABLE';
    activeStep.completedAt = undefined;
    syncExperimentMetricsFromAttempts(db);
    saveDatabase(db);
  }, 20000);

  it('Test 7, 8, 9: Teacher scope isolation (cannot access other class, cannot edit unassigned student, cannot move student outside own classes)', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const schoolId = db.schools[0]?.schoolId || 'school_demo_aipath';

    // Ensure class 8A9_OTHER and two test students exist (one in 8A9_OTHER, one unassigned)
    db.classes = db.classes.filter((c) => c.classId !== 'class_8a9_other_test' && c.name !== '8A9_OTHER');
    db.classes.push({
      classId: 'class_8a9_other_test',
      schoolId,
      academicYearId: 'ay_2026_2027',
      name: '8A9_OTHER',
      grade: 8,
      teacherId: 'user_teacher_other_99',
      teacherName: 'GV Khác',
      studentCount: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user_admin',
    });

    const otherStudentId = 'user_hs_8a9_test';
    const unassignedStudentId = 'user_hs_unassigned_test';
    db.users = db.users.filter((u) => u.userId !== otherStudentId && u.userId !== unassignedStudentId);
    db.users.push(
      {
        userId: otherStudentId,
        schoolId,
        code: 'HS8A9_99',
        username: 'hs8a9_test',
        fullName: 'Học Sinh Lớp 8A9',
        role: Role.STUDENT,
        classId: 'class_8a9_other_test',
        className: '8A9_OTHER',
        grade: 8,
        status: 'ACTIVE',
        dataSource: 'REAL',
        pseudonymId: 'student_8a9t',
        createdAt: now,
        updatedAt: now,
        createdBy: 'user_admin',
      },
      {
        userId: unassignedStudentId,
        schoolId,
        code: 'HS_UNASSIGNED_99',
        username: 'hs_unassigned_test',
        fullName: 'Học Sinh Chưa Gán Lớp',
        role: Role.STUDENT,
        classId: undefined,
        className: undefined,
        grade: 8,
        status: 'ACTIVE',
        dataSource: 'REAL',
        pseudonymId: 'student_unas',
        createdAt: now,
        updatedAt: now,
        createdBy: 'user_admin',
      }
    );
    saveDatabase(db);

    try {
      // Test 7a: Teacher 8A2 tries to run AI insight on class 8A9_OTHER -> 403
      const insightRes = await fetch(`${baseUrl}/api/classes/class_8a9_other_test/ai-insight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
      });
      expect(insightRes.status).toBe(403);

      // Test 7b: Teacher 8A2 tries to edit student in 8A9_OTHER -> 403
      const editOtherRes = await fetch(`${baseUrl}/api/admin/users/${otherStudentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ fullName: 'Hacked Name' }),
      });
      expect(editOtherRes.status).toBe(403);

      // Test 8: Teacher 8A2 tries to edit student with classId = null/undefined -> 403
      const editUnassignedRes = await fetch(`${baseUrl}/api/admin/users/${unassignedStudentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ fullName: 'Claimed Unassigned Student' }),
      });
      expect(editUnassignedRes.status).toBe(403);

      // Test 9: Teacher 8A2 tries to move student from 8A2 to 8A9_OTHER -> 403
      const student8A2 = getDatabase().users.find((u) => u.username === 'minhanh8a2')!;
      const moveRes = await fetch(`${baseUrl}/api/admin/users/${student8A2.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ className: '8A9_OTHER' }),
      });
      expect(moveRes.status).toBe(403);
    } finally {
      const cleanupDb = getDatabase();
      cleanupDb.users = cleanupDb.users.filter(
        (u) => u.userId !== otherStudentId && u.userId !== unassignedStudentId
      );
      cleanupDb.classes = cleanupDb.classes.filter((c) => c.classId !== 'class_8a9_other_test');
      saveDatabase(cleanupDb);
    }
  });

  it('Test 10: Cross-school spoofing in body or query is rejected with 403 TENANT_MISMATCH', async () => {
    const resBody = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        schoolId: 'school_other',
        questionText: 'Phân tích x^2 - 4',
        correctAnswer: '(x-2)(x+2)',
        solution: 'Hằng đẳng thức hiệu hai bình phương',
      }),
    });
    expect(resBody.status).toBe(403);
    const dataBody = await resBody.json();
    expect(dataBody.code).toBe('TENANT_MISMATCH');

    const resQuery = await fetch(`${baseUrl}/api/bootstrap?schoolId=school_other`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(resQuery.status).toBe(403);
  });

  it('Test 11: Client role escalation in request body is ignored', async () => {
    const db = getDatabase();
    const student8A2 = db.users.find((u) => u.username === 'minhanh8a2')!;

    const res = await fetch(`${baseUrl}/api/admin/users/${student8A2.userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        fullName: student8A2.fullName,
        role: Role.ADMIN,
      }),
    });
    expect(res.status).toBe(200);
    const updated = getDatabase().users.find((u) => u.userId === student8A2.userId)!;
    expect(updated.role).toBe(Role.STUDENT);
  });

  it('Test 12: Student cannot call Teacher or Admin routes (returns 403)', async () => {
    const r1 = await fetch(`${baseUrl}/api/questions/ai-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ count: 1 }),
    });
    expect(r1.status).toBe(403);

    const r2 = await fetch(`${baseUrl}/api/paths/path_any/teacher-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    expect(r2.status).toBe(403);

    const r3 = await fetch(`${baseUrl}/api/admin/teachers/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        code: 'GV999',
        fullName: 'Fake Teacher',
        username: 'faketeacher999',
      }),
    });
    expect(r3.status).toBe(403);
  });

  it('Test 13 (FIX 05 & FIX 08): exp_real_8a2 is completely removed and baseline/outcome records are derived strictly from attempts', () => {
    const db = getDatabase();
    expect(db.experiments.some((e) => e.experimentId === 'exp_real_8a2')).toBe(false);
    expect(db.experimentStudentMetrics.some((m) => m.experimentId === 'exp_real_8a2')).toBe(false);

    const demoExp = db.experiments.find((e) => e.experimentId === 'exp_demo_8a2_completed');
    expect(demoExp).toBeDefined();
    expect(demoExp?.dataSource).toBe('DEMO');
    expect(demoExp?.preTestSubmittedCount).toBe(36);
    expect(demoExp?.postTestSubmittedCount).toBe(34);

    const metrics = db.experimentStudentMetrics.filter(
      (m) => m.experimentId === 'exp_demo_8a2_completed'
    );
    expect(metrics.length).toBe(36);

    const completed = metrics.filter((m) => m.status === 'COMPLETED');
    const incomplete = metrics.filter((m) => m.status === 'INCOMPLETE');
    expect(completed.length).toBe(34);
    expect(incomplete.length).toBe(2);

    // Every metric has a real baseline record linked to a real Pre-test attempt
    for (const m of metrics) {
      expect(m.baseline).toBeDefined();
      expect(m.baseline?.attemptId).toBeTruthy();
      expect(m.preScore).toBe(m.baseline?.scorePercent);
      const preAtt = db.attempts.find((a) => a.attemptId === m.baseline?.attemptId);
      expect(preAtt).toBeDefined();
      expect(preAtt?.scorePercent).toBe(m.preScore);
    }

    // Every COMPLETED metric has a real outcome record linked to a real Post-test attempt
    for (const m of completed) {
      expect(m.outcome).toBeDefined();
      expect(m.outcome?.attemptId).toBeTruthy();
      expect(m.postScore).toBe(m.outcome?.scorePercent);
      expect(m.absoluteGain).toBe((m.postScore || 0) - (m.preScore || 0));
      const postAtt = db.attempts.find((a) => a.attemptId === m.outcome?.attemptId);
      expect(postAtt).toBeDefined();
      expect(postAtt?.scorePercent).toBe(m.postScore);
    }

    // Incomplete students have null outcome and null postScore
    for (const inc of incomplete) {
      expect(inc.outcome).toBeNull();
      expect(inc.postScore).toBeNull();
      expect(inc.absoluteGain).toBeNull();
    }
  });

  it('Test 14 (FIX 06 & FIX 07): PATH5 metrics and Teacher Overrides are derived directly from learningPaths and teacherOverrides', () => {
    const db = getDatabase();
    const metrics = db.experimentStudentMetrics.filter(
      (m) => m.experimentId === 'exp_demo_8a2_completed'
    );
    for (const m of metrics) {
      const path = db.learningPaths.find((p) => p.studentId === m.studentId);
      expect(path).toBeDefined();
      const expectedCompleted = path!.steps.filter((s) => s.status === 'COMPLETED').length;
      expect(m.assignedSteps).toBe(path!.steps.length);
      expect(m.completedSteps).toBe(expectedCompleted);
      expect(m.pathCompletionPercent).toBe(
        Math.round((expectedCompleted / path!.steps.length) * 100)
      );
    }
    expect(db.teacherOverrides.length).toBeGreaterThanOrEqual(21);
  });

  it('Test 15 (PHASE 1, 2, 3): Pre/Post state machine blocks unauthorized access and zero seed records are labeled REAL', async () => {
    const db = getDatabase();
    // 1. Verify zero seed records have dataSource === 'REAL' in experiments, learningPaths, competencySnapshots, feedbackResponses, caseStudies
    expect(db.experiments.every((e) => e.dataSource === 'DEMO')).toBe(true);
    expect(db.learningPaths.every((p) => p.dataSource === 'DEMO')).toBe(true);
    expect(db.competencySnapshots.every((s) => s.dataSource === 'DEMO')).toBe(true);
    expect(db.feedbackResponses.every((f) => f.dataSource === 'DEMO')).toBe(true);
    expect(db.experimentCaseStudies.every((c) => c.dataSource === 'DEMO')).toBe(true);

    // 2. Verify PRE_TEST / POST_TEST question cannot be submitted via Practice Task endpoint
    const student = db.users.find((u) => u.username === 'minhanh8a2')!;
    const studentPath = db.learningPaths.find((p) => p.studentId === student.userId)!;
    const activeStep = studentPath.steps.find((s) => s.status === 'AVAILABLE')!;
    const preInTaskRes = await fetch(`${baseUrl}/api/tasks/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        learningPathId: studentPath.pathId,
        stepId: activeStep.stepId,
        questionId: 'Q_POST_01',
        studentAnswer: 'A',
        hintsUsed: 0,
      }),
    });
    expect(preInTaskRes.status).toBe(403);
    const preInTaskData = await preInTaskRes.json();
    expect(preInTaskData.code).toBe('QUESTION_NOT_ALLOWED_IN_TASK');
  });
});

