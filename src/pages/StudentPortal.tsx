import React, { useState } from 'react';
import {
  Home,
  GitBranch,
  Wrench,
  TrendingUp,
  User,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Play,
  Lock,
  LogOut,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BootstrapPayload, apiClient } from '../services/apiClient';
import { BrandLogo } from '../components/brand/BrandLogo';
import {
  Assessment,
  CompetencyCode,
  ExperimentState,
  LearningPathStep,
  MasteryLevel,
  PathStatus,
  PrimaryUse,
  Question,
  QuestionType,
  UserAccount,
} from '../types';

interface StudentPortalProps {
  user: UserAccount;
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

type StudentTab = 'home' | 'path' | 'errors' | 'progress' | 'me';

export const StudentPortal: React.FC<StudentPortalProps> = ({
  user,
  data,
  onRefresh,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<StudentTab>('home');

  // Active sub-screen states (Diagnostic runner, Task runner, Checkpoint runner, Feedback form)
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [activeAssessmentQuestions, setActiveAssessmentQuestions] = useState<Question[]>([]);
  const [showDiagnosticResult, setShowDiagnosticResult] = useState(false);
  const [studentErrorBanner, setStudentErrorBanner] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState<LearningPathStep | null>(null);
  const [activeTaskQuestions, setActiveTaskQuestions] = useState<Question[]>([]);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [taskAnswerInput, setTaskAnswerInput] = useState('');
  const [unlockedHints, setUnlockedHints] = useState<{ level: number; text: string }[]>([]);
  const [taskFeedback, setTaskFeedback] = useState<{
    isCorrect: boolean;
    message: string;
    solution?: string;
    adaptiveNote?: string;
  } | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);

  // Checkpoint Runner state
  const [checkpointRunning, setCheckpointRunning] = useState(false);
  const [checkpointAnswers, setCheckpointAnswers] = useState<Record<string, string>>({});
  const [checkpointResult, setCheckpointResult] = useState<{
    score: number;
    decision: string;
    messageVi: string;
  } | null>(null);

  // Diagnostic / Pre / Post Assessment Runner state
  const [diagIdx, setDiagIdx] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`aipath_autosave_${user.userId}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [diagFlagged, setDiagFlagged] = useState<string[]>([]);
  const [diagSubmitting, setDiagSubmitting] = useState(false);

  // Student Feedback state (Section 70)
  const [likertScores, setLikertScores] = useState<number[]>([5, 5, 4, 5, 5]);
  const [open1, setOpen1] = useState('');
  const [open2, setOpen2] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const snapshot = data.competencySnapshots[0];
  const learningPath = data.learningPaths[0];
  const myErrors = data.detectedErrors;
  const diagnosticAssessment =
    data.assessments.find((a) => a.assessmentType === PrimaryUse.DIAGNOSTIC) || data.assessments[0];
  const preTestAssessment = data.assessments.find((a) => a.assessmentType === PrimaryUse.PRE_TEST);
  const postTestAssessment = data.assessments.find((a) => a.assessmentType === PrimaryUse.POST_TEST);

  const getControllingExperiment = (assessment?: Assessment) => {
    if (!assessment) return undefined;
    if (assessment.experimentId) {
      const byId = data.experiments.find((e) => e.experimentId === assessment.experimentId);
      if (byId) return byId;
    }
    return data.experiments.find(
      (e) =>
        e.preTestAssessmentId === assessment.assessmentId ||
        e.postTestAssessmentId === assessment.assessmentId
    );
  };

  const preExperiment = getControllingExperiment(preTestAssessment);
  const postExperiment = getControllingExperiment(postTestAssessment);
  const preSubmitted = Boolean(
    preTestAssessment &&
      data.attempts.some(
        (a) => a.assessmentId === preTestAssessment.assessmentId && a.status === 'SUBMITTED'
      )
  );
  const postSubmitted = Boolean(
    postTestAssessment &&
      data.attempts.some(
        (a) => a.assessmentId === postTestAssessment.assessmentId && a.status === 'SUBMITTED'
      )
  );
  const isPreTestOpen =
    Boolean(preTestAssessment) &&
    preExperiment?.state === ExperimentState.PRETEST_RUNNING &&
    !preSubmitted;
  const isPostTestOpen =
    Boolean(postTestAssessment) &&
    postExperiment?.state === ExperimentState.POSTTEST_RUNNING &&
    !postSubmitted;

  // Helper to get positive level badge colors (never use negative words)
  const getLevelColorClasses = (level: MasteryLevel) => {
    switch (level) {
      case MasteryLevel.MASTERED:
        return 'text-[#16A34A] bg-emerald-50 border-emerald-200';
      case MasteryLevel.ACHIEVED:
        return 'text-[#2563EB] bg-blue-50 border-blue-200';
      case MasteryLevel.DEVELOPING:
        return 'text-[#F59E0B] bg-amber-50 border-amber-200';
      case MasteryLevel.NEEDS_SUPPORT:
        return 'text-[#DC2626] bg-red-50 border-red-200';
    }
  };

  // Start Diagnostic / Pre-test / Post-test (fetches scoped assessment questions on demand)
  const startAssessment = async (assessmentId: string) => {
    setStudentErrorBanner(null);
    try {
      const detail = await apiClient.getAssessmentWithQuestions(assessmentId);
      const existingAttempt = data.attempts.find(
        (a) => a.assessmentId === assessmentId && a.status === 'IN_PROGRESS'
      );
      if (existingAttempt) {
        setDiagAnswers(existingAttempt.answers || {});
        setDiagFlagged(existingAttempt.flaggedQuestionIds || []);
        setDiagIdx(existingAttempt.currentQuestionIndex || 0);
      } else {
        setDiagIdx(0);
      }
      setActiveAssessmentQuestions(detail.questions || []);
      setActiveAssessmentId(assessmentId);
      setShowDiagnosticResult(false);
    } catch (err) {
      setStudentErrorBanner(
        err instanceof Error ? err.message : 'Bài đánh giá hiện đang khóa theo quy trình thực nghiệm.'
      );
    }
  };

  const handleSelectDiagAnswer = async (questionId: string, val: string) => {
    const next = { ...diagAnswers, [questionId]: val };
    setDiagAnswers(next);
    localStorage.setItem(`aipath_autosave_${user.userId}`, JSON.stringify(next));
    if (activeAssessmentId) {
      await apiClient
        .saveAttemptProgress({
          assessmentId: activeAssessmentId,
          currentQuestionIndex: diagIdx,
          flaggedQuestionIds: diagFlagged,
          answers: next,
        })
        .catch(() => {});
    }
  };

  const handleToggleFlag = async (questionId: string) => {
    const next = diagFlagged.includes(questionId)
      ? diagFlagged.filter((id) => id !== questionId)
      : [...diagFlagged, questionId];
    setDiagFlagged(next);
    if (activeAssessmentId) {
      await apiClient
        .saveAttemptProgress({
          assessmentId: activeAssessmentId,
          currentQuestionIndex: diagIdx,
          flaggedQuestionIds: next,
          answers: diagAnswers,
        })
        .catch(() => {});
    }
  };

  const handleSubmitDiagnostic = async () => {
    if (!activeAssessmentId) return;
    setDiagSubmitting(true);
    try {
      await apiClient.submitAttempt(activeAssessmentId, diagAnswers);
      localStorage.removeItem(`aipath_autosave_${user.userId}`);
      await onRefresh();
      setActiveAssessmentId(null);
      setShowDiagnosticResult(true);
      setActiveTab('home');
    } finally {
      setDiagSubmitting(false);
    }
  };

  // Start a Learning Path Step or Error Correction Task
  const startStepTask = (step: LearningPathStep) => {
    if (step.stepType === 'CHECKPOINT') {
      setCheckpointRunning(true);
      setCheckpointAnswers({});
      setCheckpointResult(null);
      return;
    }
    const qs = data.questions.filter((q) => step.questionIds.includes(q.questionId));
    const fallbackQs =
      qs.length > 0
        ? qs
        : data.questions.filter((q) => q.competency === step.targetCompetency).slice(0, 3);
    setActiveStep(step);
    setActiveTaskQuestions(fallbackQs);
    setCurrentTaskIdx(0);
    setTaskAnswerInput('');
    setUnlockedHints([]);
    setTaskFeedback(null);
  };

  const startErrorRemediation = (errorTag: string) => {
    if (!learningPath) return;
    const targetStep =
      learningPath.steps.find(
        (s) =>
          s.stepType === 'ERROR_CORRECTION' &&
          s.status !== 'LOCKED' &&
          (!s.targetErrorTag || s.targetErrorTag === errorTag)
      ) ||
      learningPath.steps.find((s) => s.stepType === 'ERROR_CORRECTION' && s.status !== 'LOCKED') ||
      learningPath.steps.find((s) => s.status === 'AVAILABLE' || s.status === 'IN_PROGRESS') ||
      learningPath.steps.find((s) => s.status === 'COMPLETED');

    if (targetStep) {
      startStepTask(targetStep);
    } else {
      setActiveTab('path');
    }
  };

  const handleRequestHint = async () => {
    const currentQ = activeTaskQuestions[currentTaskIdx];
    if (!currentQ || unlockedHints.length >= 3) return;
    const nextLevel = (unlockedHints.length + 1) as 1 | 2 | 3;
    setHintLoading(true);
    try {
      const res = await apiClient.requestHint(currentQ.questionId, nextLevel, taskAnswerInput, {
        learningPathId: learningPath?.pathId,
        stepId: activeStep?.stepId,
      });
      setUnlockedHints([...unlockedHints, { level: res.hintLevel, text: res.hintText }]);
    } finally {
      setHintLoading(false);
    }
  };

  const handleSubmitTaskAnswer = async () => {
    const currentQ = activeTaskQuestions[currentTaskIdx];
    if (!currentQ || !taskAnswerInput.trim()) return;
    setTaskSubmitting(true);
    try {
      const res = await apiClient.submitTaskAnswer({
        pathId: learningPath?.pathId,
        stepId: activeStep?.stepId,
        questionId: currentQ.questionId,
        studentAnswer: taskAnswerInput,
        hintsUsed: unlockedHints.length,
      });

      const actionLabel =
        res.adaptiveAdjustment.action === 'INCREASE_DIFFICULTY'
          ? `Tăng độ khó lên mức ${res.adaptiveAdjustment.nextDifficulty}/5 (Chính xác ${res.adaptiveAdjustment.accuracyPercent}%)`
          : res.adaptiveAdjustment.action === 'INSERT_ERROR_CORRECTION'
          ? 'Hệ thống chèn bài Sửa lỗi chuyên biệt để củng cố chắc chắn.'
          : res.adaptiveAdjustment.action === 'DECREASE_AND_REVIEW'
          ? `Điều chỉnh độ khó về mức ${res.adaptiveAdjustment.nextDifficulty}/5 để ôn tập.`
          : `Giữ ổn định độ khó mức ${res.adaptiveAdjustment.nextDifficulty}/5`;

      setTaskFeedback({
        isCorrect: res.isCorrect,
        message: res.feedbackMessage,
        solution: res.solution,
        adaptiveNote: actionLabel,
      });
      await onRefresh();
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleSubmitCheckpoint = async () => {
    if (!learningPath) return;
    setTaskSubmitting(true);
    try {
      const res = await apiClient.submitCheckpoint(learningPath.pathId, checkpointAnswers);
      setCheckpointResult({
        score: res.checkpointScore,
        decision: res.reroute.decision,
        messageVi: res.reroute.messageVi,
      });
      await onRefresh();
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const expId =
      data.experiments.find((exp) => exp.classId === user.classId)?.experimentId ||
      data.experiments[0]?.experimentId;
    if (!expId) return;
    await apiClient.submitExperimentFeedback(expId, {
      likertScores,
      openAnswer1: open1,
      openAnswer2: open2,
    });
    setFeedbackSaved(true);
    await onRefresh();
  };

  // ============================================================================
  // SUB-VIEW 1: DIAGNOSTIC / PRE-TEST / POST-TEST FULL-SCREEN RUNNER (SECTION 39)
  // ============================================================================
  if (activeAssessmentId) {
    const assessment = data.assessments.find((a) => a.assessmentId === activeAssessmentId);
    const questions =
      activeAssessmentQuestions.length > 0
        ? activeAssessmentQuestions
        : data.questions.filter((q) => assessment?.questionIds.includes(q.questionId));
    const currentQ = questions[diagIdx];

    if (!assessment || !currentQ) {
      return null;
    }

    const isFlagged = diagFlagged.includes(currentQ.questionId);
    const currentAns = diagAnswers[currentQ.questionId] || '';

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              {assessment.assessmentType} · Autosave đã bật (Tự động lưu khi đổi câu)
            </div>
            <h1 className="text-base font-bold text-[#0F172A]">{assessment.title}</h1>
          </div>
          <div className="text-sm font-mono-tabular font-bold text-[#2563EB]">
            Câu {diagIdx + 1} / {questions.length}
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col justify-between">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
              <span>
                Năng lực: <strong className="text-[#0F172A]">{currentQ.competency}</strong> · Độ khó:{' '}
                <span className="font-mono-tabular">{currentQ.difficulty}/5</span>
              </span>
              {isFlagged && (
                <span className="text-[#F59E0B] font-semibold flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5" /> Đã đánh dấu xem lại
                </span>
              )}
            </div>

            <div className="text-base sm:text-lg font-semibold text-[#0F172A] whitespace-pre-line leading-relaxed">
              {currentQ.questionText}
            </div>

            <div className="mt-6 space-y-3">
              {currentQ.options && currentQ.options.length > 0 ? (
                currentQ.options.map((opt, idx) => {
                  const selected = currentAns === opt;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDiagAnswer(currentQ.questionId, opt)}
                      className={`w-full min-h-[48px] p-4 rounded-lg border text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        selected
                          ? 'border-[#2563EB] bg-blue-50/70 text-[#1E3A8A]'
                          : 'border-slate-200 hover:bg-slate-50 text-[#0F172A]'
                      }`}
                    >
                      <span>{opt}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Nhập đáp án của em:
                  </label>
                  <input
                    type="text"
                    value={currentAns}
                    onChange={(e) => handleSelectDiagAnswer(currentQ.questionId, e.target.value)}
                    placeholder="Nhập kết quả..."
                    className="w-full min-h-[48px] px-4 py-3 rounded-lg border border-slate-300 text-base font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Question Palette + 4 Required Buttons: CÂU TRƯỚC, CÂU TIẾP, ĐÁNH DẤU, NỘP BÀI */}
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => {
                const answered = Boolean(diagAnswers[q.questionId]);
                const flagged = diagFlagged.includes(q.questionId);
                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => setDiagIdx(i)}
                    className={`w-10 h-10 rounded-lg text-xs font-mono-tabular font-bold border transition-colors cursor-pointer ${
                      diagIdx === i
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : flagged
                        ? 'border-[#F59E0B] bg-amber-50 text-[#F59E0B]'
                        : answered
                        ? 'border-emerald-300 bg-emerald-50 text-[#16A34A]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                disabled={diagIdx === 0}
                onClick={() => setDiagIdx((x) => Math.max(0, x - 1))}
                className="min-h-[48px] px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>CÂU TRƯỚC</span>
              </button>

              <button
                type="button"
                disabled={diagIdx === questions.length - 1}
                onClick={() => setDiagIdx((x) => Math.min(questions.length - 1, x + 1))}
                className="min-h-[48px] px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>CÂU TIẾP</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleToggleFlag(currentQ.questionId)}
                className={`min-h-[48px] px-4 py-2.5 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isFlagged
                    ? 'border-[#F59E0B] bg-amber-50 text-[#F59E0B]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>ĐÁNH DẤU</span>
              </button>

              <button
                type="button"
                disabled={diagSubmitting}
                onClick={handleSubmitDiagnostic}
                className="min-h-[48px] px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{diagSubmitting ? 'ĐANG CHẤM...' : 'NỘP BÀI'}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 2: ADAPTIVE TASK RUNNER (SECTION 48 & 49 - WITH 3-LEVEL HINTS)
  // ============================================================================
  if (activeStep && activeTaskQuestions.length > 0) {
    const currentQ = activeTaskQuestions[currentTaskIdx];
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              {activeStep.stepType} · Độ khó hiện tại:{' '}
              <span className="font-mono-tabular font-bold text-[#2563EB]">{currentQ.difficulty}/5</span>
            </div>
            <h1 className="text-base font-bold text-[#0F172A]">{activeStep.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setActiveStep(null)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Quay lại Lộ trình
          </button>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
              <span>
                Nhiệm vụ {currentTaskIdx + 1} / {activeTaskQuestions.length} · Năng lực: {currentQ.competency}
              </span>
              <span className="font-mono-tabular">Đã dùng {unlockedHints.length}/3 gợi ý</span>
            </div>

            <div className="text-base sm:text-lg font-semibold text-[#0F172A] whitespace-pre-line leading-relaxed">
              {currentQ.questionText}
            </div>

            <div className="mt-6 space-y-3">
              {currentQ.options && currentQ.options.length > 0 ? (
                currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTaskAnswerInput(opt)}
                    className={`w-full min-h-[48px] p-4 rounded-lg border text-left text-sm font-medium transition-colors cursor-pointer ${
                      taskAnswerInput === opt
                        ? 'border-[#2563EB] bg-blue-50/70 text-[#1E3A8A]'
                        : 'border-slate-200 hover:bg-slate-50 text-[#0F172A]'
                    }`}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <input
                  type="text"
                  value={taskAnswerInput}
                  onChange={(e) => setTaskAnswerInput(e.target.value)}
                  placeholder="Nhập câu trả lời của em..."
                  className="w-full min-h-[48px] px-4 py-3 rounded-lg border border-slate-300 text-base font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              )}
            </div>

            {/* Progressive 3-Level AI Hints (Section 49 & 79 - AI Violet #7C3AED) */}
            {unlockedHints.length > 0 && (
              <div className="mt-6 space-y-2.5">
                {unlockedHints.map((h) => (
                  <div
                    key={h.level}
                    className="p-4 rounded-lg bg-purple-50/80 border border-[#7C3AED]/30 text-sm text-[#0F172A]"
                  >
                    <div className="text-xs font-bold text-[#7C3AED] mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        Gợi ý AI Cấp độ {h.level}{' '}
                        {h.level === 1
                          ? '(Nhắc kiến thức nền)'
                          : h.level === 2
                          ? '(Chỉ rõ bước biến đổi)'
                          : '(Hướng dẫn sâu để em tự hoàn thành)'}
                      </span>
                    </div>
                    <p>{h.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Task Feedback (Section 49: Does NOT give answer immediately if wrong!) */}
            {taskFeedback && (
              <div
                className={`mt-6 p-4 rounded-lg border text-sm ${
                  taskFeedback.isCorrect
                    ? 'bg-emerald-50 border-[#16A34A]/30 text-[#0F172A]'
                    : 'bg-amber-50 border-[#F59E0B]/40 text-[#0F172A]'
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  {taskFeedback.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  )}
                  <span>{taskFeedback.message}</span>
                </div>
                {taskFeedback.solution && (
                  <div className="mt-2 text-xs text-slate-700 bg-white/80 p-3 rounded border border-emerald-200">
                    <strong>Lời giải chi tiết:</strong> {taskFeedback.solution}
                  </div>
                )}
                {taskFeedback.adaptiveNote && (
                  <div className="mt-2 text-xs font-medium text-[#7C3AED]">
                    P4 Thích ứng: {taskFeedback.adaptiveNote}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={unlockedHints.length >= 3 || hintLoading}
                onClick={handleRequestHint}
                className="min-h-[48px] px-4 py-2.5 rounded-lg border border-[#7C3AED] text-[#7C3AED] hover:bg-purple-50 text-sm font-semibold flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <Lightbulb className="w-4 h-4" />
                <span>
                  {hintLoading
                    ? 'AI PATH đang tạo gợi ý...'
                    : unlockedHints.length < 3
                    ? `GỢI Ý (Mức ${unlockedHints.length + 1}/3)`
                    : 'ĐÃ MỞ ĐỦ 3 GỢI Ý'}
                </span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={taskSubmitting || !taskAnswerInput.trim()}
                  onClick={handleSubmitTaskAnswer}
                  className="min-h-[48px] px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
                >
                  {taskSubmitting ? 'ĐANG KIỂM TRA...' : 'KIỂM TRA ĐÁP ÁN'}
                </button>

                {taskFeedback?.isCorrect && (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentTaskIdx + 1 < activeTaskQuestions.length) {
                        setCurrentTaskIdx(currentTaskIdx + 1);
                        setTaskAnswerInput('');
                        setUnlockedHints([]);
                        setTaskFeedback(null);
                      } else {
                        setActiveStep(null);
                        setActiveTab('path');
                      }
                    }}
                    className="min-h-[48px] px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-bold cursor-pointer"
                  >
                    {currentTaskIdx + 1 < activeTaskQuestions.length ? 'CÂU TIẾP THEO' : 'HOÀN THÀNH BƯỚC NÀY'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 3: INDEPENDENT CHECKPOINT RUNNER (SECTION 51 & 52 - NO HINTS)
  // ============================================================================
  if (checkpointRunning && learningPath) {
    const chkStep =
      learningPath.steps.find((s) => s.stepType === 'CHECKPOINT') ||
      learningPath.steps[learningPath.steps.length - 1];
    const chkQuestions = data.questions.filter((q) => chkStep.questionIds.includes(q.questionId));

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              P5 – CHECKPOINT ĐÁNH GIÁ ĐỘC LẬP · Không sử dụng Gợi ý AI
            </div>
            <h1 className="text-base font-bold text-[#0F172A]">{chkStep.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setCheckpointRunning(false)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Đóng
          </button>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-6">
          {checkpointResult ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="text-xs font-bold text-[#7C3AED]">KẾT QUẢ CHECKPOINT & TÁI ĐỊNH TUYẾN (P5 – RE-ROUTE)</div>
              <div className="text-3xl font-bold font-mono-tabular text-[#0F172A]">
                Điểm độc lập: {checkpointResult.score}%
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{checkpointResult.messageVi}</p>
              <button
                type="button"
                onClick={() => {
                  setCheckpointRunning(false);
                  setActiveTab('progress');
                }}
                className="min-h-[48px] px-6 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-bold cursor-pointer"
              >
                XEM TIẾN BỘ HỌC TẬP
              </button>
            </div>
          ) : (
            <>
              {chkQuestions.map((q, idx) => (
                <div key={q.questionId} className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="text-xs text-slate-500 mb-2">
                    Câu {idx + 1} / {chkQuestions.length} · Năng lực: {q.competency}
                  </div>
                  <div className="text-base font-semibold text-[#0F172A]">{q.questionText}</div>
                  <div className="mt-4 space-y-2.5">
                    {q.options && q.options.length > 0 ? (
                      q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCheckpointAnswers({ ...checkpointAnswers, [q.questionId]: opt })}
                          className={`w-full min-h-[48px] p-3.5 rounded-lg border text-left text-sm font-medium cursor-pointer ${
                            checkpointAnswers[q.questionId] === opt
                              ? 'border-[#2563EB] bg-blue-50 text-[#1E3A8A]'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))
                    ) : (
                      <input
                        type="text"
                        value={checkpointAnswers[q.questionId] || ''}
                        onChange={(e) =>
                          setCheckpointAnswers({ ...checkpointAnswers, [q.questionId]: e.target.value })
                        }
                        placeholder="Nhập đáp án số nguyên..."
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                disabled={taskSubmitting}
                onClick={handleSubmitCheckpoint}
                className="w-full min-h-[48px] py-3 px-6 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white font-bold text-sm cursor-pointer"
              >
                {taskSubmitting ? 'ĐANG CHẤM CHECKPOINT...' : 'NỘP BÀI CHECKPOINT ĐỘC LẬP'}
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-8 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-20">
        <div className="flex items-center gap-3 shrink-0">
          <BrandLogo size="sm" />
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
            {user.fullName} (Lớp {user.className || '8A2'})
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          {[
            { id: 'home', label: 'Hôm nay' },
            { id: 'path', label: 'Lộ trình' },
            { id: 'errors', label: 'Sửa lỗi' },
            { id: 'progress', label: 'Tiến bộ' },
            { id: 'me', label: 'Tôi' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as StudentTab)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'text-[#2563EB] font-bold border-b-2 border-[#2563EB]'
                  : 'hover:text-[#0F172A]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* =================================================================
            TAB 1: HÔM NAY & WOW SCREEN #1: SKILL PROFILE (SECTION 40 & 98)
            ================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Primary Action Banner (15. UX: Học sinh - Một màn hình, một hành động chính) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  {data.subjects[0]?.name || 'Toán 8'} · Chủ đề:{' '}
                  {data.topics[0]?.name || 'Phân tích đa thức thành nhân tử'} (
                  {data.topics[0]?.code || 'FACTORING_POLYNOMIAL'})
                </div>
                <h1 className="text-xl font-bold text-[#0F172A] mt-1">
                  Xin chào {user.fullName}, đây là nhiệm vụ trọng tâm hôm nay của em
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {learningPath
                    ? 'Lộ trình cá nhân hóa AI-PATH5 của em đã sẵn sàng. Hãy tiếp tục bước luyện tập tiếp theo.'
                    : `Hãy hoàn thành bài Chẩn đoán ${
                        diagnosticAssessment?.questionIds.length || 8
                      } câu hỏi để AI PATH lập bản đồ 5 năng lực cho riêng em.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                {learningPath ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('path')}
                    className="min-h-[48px] px-5 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>TIẾP TỤC LỘ TRÌNH HỌC</span>
                  </button>
                ) : null}
                {diagnosticAssessment && (
                  <button
                    type="button"
                    onClick={() => startAssessment(diagnosticAssessment.assessmentId)}
                    className="min-h-[48px] px-4 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
                  >
                    LÀM BÀI CHẨN ĐOÁN ({diagnosticAssessment.questionIds.length} CÂU)
                  </button>
                )}
              </div>
            </div>

            {showDiagnosticResult && (
              <div className="p-4 rounded-lg bg-emerald-50 border border-[#16A34A]/30 text-sm text-[#16A34A] font-medium">
                Đã hoàn thành bài đánh giá và cập nhật Hồ sơ năng lực 5 thành phần (P1 – PROFILE) của em!
              </div>
            )}

            {/* WOW SCREEN #1: SKILL PROFILE (SECTION 40) */}
            {snapshot ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs font-semibold text-[#2563EB]">
                      P1 – HỒ SƠ NĂNG LỰC CÁ NHÂN (SKILL PROFILE)
                    </div>
                    <h2 className="text-lg font-bold text-[#0F172A] mt-0.5">
                      Bản đồ 5 năng lực Toán 8: Phân tích đa thức thành nhân tử
                    </h2>
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    Độ tin cậy dữ liệu (Confidence):{' '}
                    <strong className="text-[#0F172A]">{Math.round(snapshot.overallConfidence * 100)}%</strong> (Đủ tạo
                    Learning Path)
                  </div>
                </div>

                {/* 5 Competency Bars */}
                <div className="space-y-4">
                  {(
                    [
                      CompetencyCode.FOUNDATION,
                      CompetencyCode.RECOGNITION,
                      CompetencyCode.TRANSFORMATION,
                      CompetencyCode.CALC_ACCURACY,
                      CompetencyCode.APPLICATION,
                    ] as CompetencyCode[]
                  ).map((code) => {
                    const item = snapshot.competencies[code];
                    if (!item) return null;
                    return (
                      <div key={code} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-semibold text-[#0F172A] flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="text-xs font-normal text-slate-400">·</span>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded border ${getLevelColorClasses(
                                item.level
                              )}`}
                            >
                              {item.levelLabelVi}
                            </span>
                          </div>
                          <span className="font-mono-tabular font-bold text-[#0F172A]">{item.score}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.score >= 85
                                ? 'bg-[#16A34A]'
                                : item.score >= 70
                                ? 'bg-[#2563EB]'
                                : item.score >= 50
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#DC2626]'
                            }`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Violet Insight Box (#7C3AED - Section 14 & 40) */}
                <div className="p-4 rounded-xl bg-purple-50/70 border border-[#7C3AED]/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#7C3AED] mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>AI PATH INSIGHT – NHẬN ĐỊNH HỌC TẬP CÁ NHÂN HÓA</span>
                  </div>
                  <p className="text-sm text-[#0F172A] leading-relaxed">{snapshot.aiInsightStudent}</p>
                </div>

                {studentErrorBanner && (
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{studentErrorBanner}</span>
                  </div>
                )}

                {/* Pre-test / Post-test Experiment Quick Cards (FIX 01: Strictly gated by Experiment State Machine) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {preTestAssessment && (
                    <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">
                          Đánh giá đầu vào Thực nghiệm ({preExperiment?.state || 'LOCKED'})
                        </div>
                        <div className="text-sm font-bold text-[#0F172A] mt-0.5">{preTestAssessment.title}</div>
                      </div>
                      {isPreTestOpen ? (
                        <button
                          type="button"
                          onClick={() => startAssessment(preTestAssessment.assessmentId)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#2563EB] text-[#2563EB] text-xs font-bold hover:bg-blue-50 whitespace-nowrap cursor-pointer"
                        >
                          Làm Pre-test
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold whitespace-nowrap">
                          <Lock className="w-3.5 h-3.5" />
                          <span>
                            {preSubmitted
                              ? 'Đã nộp Pre-test'
                              : preExperiment?.state === ExperimentState.READY ||
                                preExperiment?.state === ExperimentState.DRAFT
                              ? 'Chưa mở Pre-test'
                              : 'Đã khóa Pre-test'}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                  {postTestAssessment && (
                    <div className="p-4 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">
                          Đánh giá đầu ra Thực nghiệm ({postExperiment?.state || 'LOCKED'})
                        </div>
                        <div className="text-sm font-bold text-[#0F172A] mt-0.5">{postTestAssessment.title}</div>
                      </div>
                      {isPostTestOpen ? (
                        <button
                          type="button"
                          onClick={() => startAssessment(postTestAssessment.assessmentId)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#16A34A] text-[#16A34A] text-xs font-bold hover:bg-emerald-50 whitespace-nowrap cursor-pointer"
                        >
                          Làm Post-test
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold whitespace-nowrap">
                          <Lock className="w-3.5 h-3.5" />
                          <span>
                            {postSubmitted
                              ? 'Đã nộp Post-test'
                              : postExperiment?.state === ExperimentState.COMPLETED ||
                                postExperiment?.state === ExperimentState.ARCHIVED
                              ? 'Đã đóng Post-test'
                              : 'Chưa mở Post-test'}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 93. EMPTY STATE */
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
                <p className="text-base font-semibold text-[#0F172A]">
                  Chưa đủ dữ liệu để tạo bản đồ năng lực.
                </p>
                {diagnosticAssessment && (
                  <button
                    type="button"
                    onClick={() => startAssessment(diagnosticAssessment.assessmentId)}
                    className="min-h-[48px] px-6 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-bold cursor-pointer"
                  >
                    BẮT ĐẦU BÀI CHẨN ĐOÁN
                  </button>
                )}
              </div>
            )}

            {/* KHO KIẾN THỨC & TÀI LIỆU CỦA CHỦ ĐỀ MÔN HỌC */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-xs font-bold text-[#2563EB] uppercase">
                    KIẾN THỨC CHỦ ĐỀ MÔN HỌC ĐÃ TẢI LÊN
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A] mt-0.5">
                    Lý thuyết cốt lõi, Công thức & Ví dụ mẫu theo Chủ đề
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {data.topics.length} chủ đề •{' '}
                  {data.topics.reduce((sum, t) => sum + (t.knowledgeItems?.length || 0), 0)} đơn vị
                  kiến thức
                </span>
              </div>

              <div className="space-y-4">
                {data.topics.map((tp) => {
                  const items = tp.knowledgeItems || [];
                  const subj = data.subjects.find((s) => s.code === tp.subjectCode);
                  return (
                    <div
                      key={tp.topicId}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">{tp.name}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
                            {subj?.name || tp.subjectCode} • Khối {tp.grade}
                          </span>
                        </div>
                        <span className="text-xs font-mono-tabular text-slate-500">{tp.code}</span>
                      </div>

                      {tp.knowledgeSummary && (
                        <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-blue-950">
                          <strong>Trọng tâm kiến thức:</strong> {tp.knowledgeSummary}
                        </div>
                      )}

                      {items.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {items.map((item) => (
                            <div
                              key={item.knowledgeId}
                              className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-[#0F172A]">{item.title}</span>
                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold text-[11px] shrink-0">
                                  {item.knowledgeType === 'CORE_THEORY'
                                    ? 'Lý thuyết'
                                    : item.knowledgeType === 'FORMULA_RULES'
                                    ? 'Công thức'
                                    : item.knowledgeType === 'SOLVED_EXAMPLES'
                                    ? 'Ví dụ mẫu'
                                    : 'Tài liệu'}
                                </span>
                              </div>
                              <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                                {item.contentText}
                              </div>
                              {item.fileDataUrl && item.fileName && (
                                <div className="pt-1">
                                  <a
                                    href={item.fileDataUrl}
                                    download={item.fileName}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold hover:bg-emerald-100"
                                  >
                                    <span>Tải tài liệu đính kèm: {item.fileName}</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            TAB 2: WOW SCREEN #2: PERSONALIZED LEARNING PATH (SECTION 46-52)
            ================================================================= */}
        {activeTab === 'path' && (
          <div className="space-y-6">
            {learningPath ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs font-bold text-[#7C3AED] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>P3 & P4 – LỘ TRÌNH HỌC TẬP THÍCH ỨNG (PERSONALIZED LEARNING PATH)</span>
                    </div>
                    <h2 className="text-lg font-bold text-[#0F172A] mt-1">
                      Chu trình #{learningPath.cycleNumber}: Phân tích đa thức thành nhân tử
                    </h2>
                  </div>
                  <div className="text-xs font-medium text-slate-600">
                    Trạng thái:{' '}
                    <strong className="text-[#16A34A]">
                      {learningPath.status === PathStatus.WAITING_APPROVAL
                        ? 'Đang chờ Giáo viên duyệt'
                        : learningPath.status === PathStatus.TEACHER_INTERVENTION_REQUIRED
                        ? 'Cần giáo viên hỗ trợ trực tiếp'
                        : 'Đã được Giáo viên phê duyệt'}
                    </strong>
                  </div>
                </div>

                {/* Why this path was tailored */}
                <div className="p-4 rounded-xl bg-purple-50/70 border border-[#7C3AED]/30 space-y-2">
                  <div className="text-xs font-bold text-[#7C3AED]">
                    Vì sao lộ trình này được thiết kế riêng cho em?
                  </div>
                  <p className="text-sm text-[#0F172A]">{learningPath.aiExplanation.studentMessage}</p>
                  <div className="text-xs text-slate-600 pt-1">
                    Trọng tâm cần cải thiện:{' '}
                    {learningPath.triggerReasons.weakCompetencies
                      .map((w) => `${w.competency} (${w.score}%)`)
                      .join(' · ')}{' '}
                    {learningPath.triggerReasons.recurringErrors.length > 0 &&
                      `· Lỗi lặp lại: ${learningPath.triggerReasons.recurringErrors
                        .map((e) => `${e.errorTag} ×${e.count}`)
                        .join(', ')}`}
                  </div>
                </div>

                {learningPath.status === PathStatus.TEACHER_INTERVENTION_REQUIRED && (
                  <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/30 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                    <div className="text-sm text-[#0F172A]">
                      <strong>Thông báo hỗ trợ sư phạm:</strong> Em đã hoàn thành 2 chu trình Checkpoint liên tiếp cần
                      hỗ trợ thêm. Hệ thống không tự sinh thêm bài tập tự động để{' '}
                      {data.classes?.[0]?.teacherName
                        ? `Giáo viên ${data.classes[0].teacherName}`
                        : 'Giáo viên phụ trách'}{' '}
                      trực tiếp hướng dẫn em trên lớp.
                    </div>
                  </div>
                )}

                {/* 5 Steps Timeline */}
                <div className="space-y-4">
                  {learningPath.steps.map((step) => {
                    const isCompleted = step.status === 'COMPLETED';
                    const isLocked = step.status === 'LOCKED';
                    return (
                      <div
                        key={step.stepId}
                        className={`p-5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isCompleted
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : isLocked
                            ? 'border-slate-200 bg-slate-50/60 opacity-75'
                            : 'border-[#2563EB] bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-tabular font-bold text-[#2563EB]">
                              BƯỚC {step.stepOrder}
                            </span>
                            <span>·</span>
                            <span>{step.stepType}</span>
                            <span>·</span>
                            <span>Năng lực: {step.targetCompetency}</span>
                            <span>·</span>
                            <span className="font-mono-tabular">Độ khó {step.targetDifficulty}/5</span>
                          </div>
                          <h3 className="text-base font-bold text-[#0F172A]">{step.title}</h3>
                          <p className="text-xs text-slate-600">{step.description}</p>
                          {typeof step.scorePercent === 'number' && (
                            <div className="text-xs font-mono-tabular font-semibold text-[#16A34A] pt-1">
                              Kết quả đạt được: {step.scorePercent}%
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => startStepTask(step)}
                            className={`min-h-[48px] px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                              isCompleted
                                ? 'border border-emerald-300 bg-white text-[#16A34A] hover:bg-emerald-50'
                                : 'bg-[#2563EB] hover:bg-[#1E3A8A] text-white'
                            }`}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>
                              {step.stepType === 'CHECKPOINT'
                                ? 'LÀM CHECKPOINT (KHÔNG GỢI Ý)'
                                : isCompleted
                                ? 'LUYỆN LẠI BƯỚC NÀY'
                                : 'BẮT ĐẦU NHIỆM VỤ'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
                <p className="text-base font-semibold text-[#0F172A]">
                  Chưa có lộ trình cá nhân hóa. Hãy hoàn thành bài Chẩn đoán trước!
                </p>
              </div>
            )}
          </div>
        )}

        {/* =================================================================
            TAB 3: TRẠM SỬA LỖI (SECTION 50 - ERROR CENTER)
            ================================================================= */}
        {activeTab === 'errors' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="text-xs font-bold text-[#7C3AED]">P2 – PHÂN TÍCH & KHẮC PHỤC LỖI (ERROR CENTER)</div>
              <h2 className="text-lg font-bold text-[#0F172A] mt-1">
                Các lỗi đại số cần lưu ý trong 10 nhiệm vụ gần nhất
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Khi cùng một loại lỗi xuất hiện từ 3 lần trở lên trong 10 nhiệm vụ gần nhất, AI PATH đánh dấu là lỗi
                lặp lại (Recurring Error) và tạo bài luyện chuyên biệt.
              </p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {myErrors.map((err) => (
                  <div
                    key={err.errorId}
                    className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular font-bold text-[#DC2626]">
                          Gặp {err.occurrencesInLast10} lần
                        </span>
                        <span className="font-semibold text-[#16A34A]">
                          {err.status === 'IMPROVING'
                            ? 'Đang cải thiện'
                            : err.status === 'RESOLVED'
                            ? 'Đã khắc phục'
                            : 'Cần ưu tiên sửa'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[#0F172A]">{err.errorName}</h3>
                      <p className="text-xs text-slate-600">
                        Mã phân loại: <span className="font-mono-tabular">{err.errorTag}</span> ·{' '}
                        {err.isRecurring ? 'Lỗi lặp lại (>=3 lần/10 bài)' : 'Lỗi đơn lẻ'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => startErrorRemediation(err.errorTag)}
                      className="w-full min-h-[48px] py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>LUYỆN LỖI NÀY</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            TAB 4: TIẾN BỘ HỌC TẬP (SECTION 53 - STUDENT PROGRESS)
            ================================================================= */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <div className="text-xs font-semibold text-[#2563EB]">ĐO LƯỜNG TIẾN BỘ (BEFORE → CURRENT)</div>
                <h2 className="text-lg font-bold text-[#0F172A] mt-1">
                  Sự thay đổi năng lực của {user.fullName} qua chu trình AI-PATH5
                </h2>
              </div>

              {(() => {
                const firstProg = data.progressHistory[0];
                const lastProg =
                  data.progressHistory.length > 0
                    ? data.progressHistory[data.progressHistory.length - 1]
                    : undefined;

                const appInitial =
                  firstProg?.application ??
                  snapshot?.competencies[CompetencyCode.APPLICATION]?.initialScore ??
                  snapshot?.competencies[CompetencyCode.APPLICATION]?.score ??
                  0;
                const appCurrent =
                  lastProg?.application ??
                  snapshot?.competencies[CompetencyCode.APPLICATION]?.score ??
                  0;
                const appDelta = appCurrent - appInitial;

                const transInitial =
                  firstProg?.transformation ??
                  snapshot?.competencies[CompetencyCode.TRANSFORMATION]?.initialScore ??
                  snapshot?.competencies[CompetencyCode.TRANSFORMATION]?.score ??
                  0;
                const transCurrent =
                  lastProg?.transformation ??
                  snapshot?.competencies[CompetencyCode.TRANSFORMATION]?.score ??
                  0;
                const transDelta = transCurrent - transInitial;

                const signErrRecord = myErrors.find((e) => e.errorTag === 'SIGN_ERROR') || myErrors[0];
                const signInitial =
                  firstProg?.signErrorCount ?? signErrRecord?.occurrencesInLast10 ?? 0;
                const signCurrent =
                  lastProg?.signErrorCount ?? signErrRecord?.occurrencesInLast10 ?? 0;
                const signReductionPct =
                  signInitial > 0
                    ? Math.max(0, Math.round(((signInitial - signCurrent) / signInitial) * 100))
                    : 0;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="text-xs text-slate-500">Năng lực Vận dụng (Application)</div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#16A34A] mt-1">
                        {appInitial}% → {appCurrent}%
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {appDelta >= 0 ? `Tăng +${appDelta}%` : `Thay đổi ${appDelta}%`} qua chu trình học tập
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="text-xs text-slate-500">Năng lực Biến đổi (Transformation)</div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#2563EB] mt-1">
                        {transInitial}% → {transCurrent}%
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {transDelta >= 0 ? `Tăng +${transDelta}%` : `Thay đổi ${transDelta}%`} (
                        {snapshot?.competencies[CompetencyCode.TRANSFORMATION]?.levelLabelVi ||
                          'Đang cập nhật'}
                        )
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="text-xs text-slate-500">
                        {signErrRecord ? signErrRecord.errorName : 'Lỗi Quy tắc dấu (SIGN_ERROR)'}
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#7C3AED] mt-1">
                        {signInitial} lần → {signCurrent} lần
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {signInitial > 0
                          ? `Giảm ${signReductionPct}% tần suất lặp lỗi`
                          : 'Chưa ghi nhận lỗi lặp lại'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recharts Progress Chart */}
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.progressHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="application"
                      name="Vận dụng (%)"
                      stroke="#16A34A"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="transformation"
                      name="Biến đổi (%)"
                      stroke="#2563EB"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Tổng thể (%)"
                      stroke="#7C3AED"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            TAB 5: TÔI & PHẢN HỒI THỰC NGHIỆM (SECTION 70)
            ================================================================= */}
        {activeTab === 'me' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-lg font-bold text-[#0F172A]">Thông tin tài khoản Học sinh</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Họ và tên:</span>{' '}
                  <strong className="text-[#0F172A]">{user.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Mã học sinh:</span>{' '}
                  <strong className="font-mono-tabular text-[#0F172A]">{user.code}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Lớp / Mã ẩn danh AI:</span>{' '}
                  <strong className="font-mono-tabular text-[#0F172A]">
                    {user.className} · {user.pseudonymId}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Trường học:</span>{' '}
                  <strong className="text-[#0F172A]">
                    {data.schools[0]?.name || 'Trường THCS Demo AI PATH'}
                  </strong>
                  {data.schools[0]?.address && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Địa chỉ: {data.schools[0].address}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 70: Student Feedback Likert Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <div className="text-xs font-bold text-[#2563EB]">PHẢN HỒI HỌC SINH SAU ĐỢT THỰC NGHIỆM</div>
                <h3 className="text-base font-bold text-[#0F172A] mt-1">
                  Đánh giá trải nghiệm học tập thích ứng cùng AI PATH (Thang Likert 1–5)
                </h3>
              </div>

              {feedbackSaved && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-[#16A34A] font-medium">
                  Cảm ơn em! Phản hồi của em đã được lưu vào cơ sở dữ liệu thực nghiệm.
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                {[
                  '1. Lộ trình phù hợp với phần em cần cải thiện.',
                  '2. Gợi ý AI giúp em tự sửa lỗi.',
                  '3. Em hiểu rõ hơn phần mình cần cải thiện.',
                  '4. AI PATH dễ sử dụng.',
                  '5. Em muốn tiếp tục sử dụng AI PATH.',
                ].map((label, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <span className="text-sm font-medium text-[#0F172A]">{label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {[1, 2, 3, 4, 5].map((scoreVal) => (
                        <button
                          key={scoreVal}
                          type="button"
                          onClick={() => {
                            const next = [...likertScores];
                            next[idx] = scoreVal;
                            setLikertScores(next);
                          }}
                          className={`w-10 h-10 rounded-lg font-mono-tabular text-xs font-bold border cursor-pointer ${
                            likertScores[idx] === scoreVal
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {scoreVal}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Điều em thích nhất khi học trên AI PATH?
                    </label>
                    <textarea
                      rows={3}
                      value={open1}
                      onChange={(e) => setOpen1(e.target.value)}
                      placeholder="Chia sẻ cảm nhận của em..."
                      className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Điều gì cần cải thiện thêm?
                    </label>
                    <textarea
                      rows={3}
                      value={open2}
                      onChange={(e) => setOpen2(e.target.value)}
                      placeholder="Ý kiến đóng góp của em..."
                      className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[48px] px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>GỬI PHẢN HỒI THỰC NGHIỆM</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation (Section 16: Hôm nay | Lộ trình | Sửa lỗi | Tiến bộ | Tôi) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 grid grid-cols-5 z-30">
        {[
          { id: 'home', label: 'Hôm nay', icon: Home },
          { id: 'path', label: 'Lộ trình', icon: GitBranch },
          { id: 'errors', label: 'Sửa lỗi', icon: Wrench },
          { id: 'progress', label: 'Tiến bộ', icon: TrendingUp },
          { id: 'me', label: 'Tôi', icon: User },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as StudentTab)}
              className={`min-h-[54px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer ${
                active ? 'text-[#2563EB]' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
