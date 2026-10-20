import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Lock,
  Play,
  AlertTriangle,
  Sparkles,
  Upload,
  Send,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BootstrapPayload, apiClient } from '../services/apiClient';
import {
  CompetencyCode,
  ExperimentState,
  PrimaryUse,
  UserAccount,
} from '../types';
import {
  exportExperimentToExcel,
  exportExperimentToPdf,
} from '../utils/excelAndPdfExporter';

interface ExperimentModuleProps {
  user: UserAccount;
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
}

type ExpSubTab =
  | 'overview'
  | 'batches'
  | 'prepost'
  | 'path5_monitor'
  | 'feedback'
  | 'casestudy'
  | 'evidence'
  | 'reports';

export const ExperimentModule: React.FC<ExperimentModuleProps> = ({
  user,
  data,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<ExpSubTab>('overview');
  const [selectedExpId, setSelectedExpId] = useState<string>(
    data.experiments[0]?.experimentId || ''
  );

  useEffect(() => {
    if (
      data.experiments.length > 0 &&
      (!selectedExpId || !data.experiments.some((e) => e.experimentId === selectedExpId))
    ) {
      setSelectedExpId(data.experiments[0].experimentId);
    }
  }, [data.experiments, selectedExpId]);

  const defaultPreAssessId =
    data.assessments.find((a) => a.assessmentType === PrimaryUse.PRE_TEST)?.assessmentId || '';
  const defaultPostAssessId =
    data.assessments.find((a) => a.assessmentType === PrimaryUse.POST_TEST)?.assessmentId || '';

  // Create Experiment 5-Step Wizard state (Section 59)
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpClassId, setNewExpClassId] = useState(
    data.classes?.[0]?.classId || user.classId || ''
  );
  const [newExpDataSource, setNewExpDataSource] = useState<'REAL' | 'DEMO'>('REAL');
  const [newExpCompetencies, setNewExpCompetencies] = useState<CompetencyCode[]>(
    Object.values(CompetencyCode)
  );
  const [preAssessId, setPreAssessId] = useState(defaultPreAssessId);
  const [postAssessId, setPostAssessId] = useState(defaultPostAssessId);
  const [equivalenceResult, setEquivalenceResult] = useState<{
    equivalenceScore: number;
    hasOverlappingQuestions: boolean;
    isValidForExperiment: boolean;
  } | null>(null);
  const [teacherApprovedEq, setTeacherApprovedEq] = useState(true);

  // PATH5 Monitor Filter (Section 63)
  const [monitorFilter, setMonitorFilter] = useState<
    'ALL' | 'NEEDS_SUPPORT' | 'RECURRING_ERROR' | 'WAITING_APPROVAL' | 'TEACHER_INTERVENTION' | 'IMPROVING'
  >('ALL');

  // Teacher Feedback Form (Section 71)
  const [teacherLikert, setTeacherLikert] = useState<number[]>([5, 5, 5, 5, 5]);
  const [teacherOpen1, setTeacherOpen1] = useState('');
  const [teacherOpen2, setTeacherOpen2] = useState('');
  const [fbSaved, setFbSaved] = useState(false);

  // Evidence Upload Form (Section 73)
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<'IMAGE' | 'VIDEO' | 'SCREENSHOT' | 'DOCUMENT' | 'NOTE'>('DOCUMENT');
  const [evNotes, setEvNotes] = useState('');
  const [evFileName, setEvFileName] = useState('');
  const [evConsent, setEvConsent] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [syncingMetrics, setSyncingMetrics] = useState(false);

  const currentExp =
    data.experiments.find((e) => e.experimentId === selectedExpId) || data.experiments[0];

  // Strictly filter metrics by the active experimentId (no hardcoded experiment IDs!)
  const metrics = (data.experimentStudentMetrics || []).filter(
    (m) => Boolean(currentExp) && m.experimentId === currentExp.experimentId
  );
  const preCompletedMetrics = metrics.filter((m) => m.preScore !== null);
  const completedMetrics = metrics.filter(
    (m) => m.status === 'COMPLETED' && m.preScore !== null && m.postScore !== null
  );
  const incompleteMetrics = metrics.filter((m) => m.status === 'INCOMPLETE');

  const preMean =
    preCompletedMetrics.length > 0
      ? Math.round(
          (preCompletedMetrics.reduce((s, m) => s + (m.preScore ?? 0), 0) /
            preCompletedMetrics.length) *
            10
        ) / 10
      : 0;
  const postMean =
    completedMetrics.length > 0
      ? Math.round(
          (completedMetrics.reduce((s, m) => s + (m.postScore ?? 0), 0) / completedMetrics.length) *
            10
        ) / 10
      : 0;

  const calcCompetencyPrePost = (compCode: CompetencyCode) => {
    const preSource = completedMetrics.length > 0 ? completedMetrics : preCompletedMetrics;
    const preVal =
      preSource.length > 0
        ? Math.round(
            preSource.reduce((s, m) => s + (m.competencyPre?.[compCode] ?? 0), 0) / preSource.length
          )
        : 0;
    const postVal =
      completedMetrics.length > 0
        ? Math.round(
            completedMetrics.reduce((s, m) => s + (m.competencyPost?.[compCode] ?? 0), 0) /
              completedMetrics.length
          )
        : 0;
    return { Pre: preVal, Post: postVal, Gain: postVal - preVal };
  };

  const appStats = calcCompetencyPrePost(CompetencyCode.APPLICATION);
  const appPreMean = appStats.Pre;
  const appPostMean = appStats.Post;

  const totalPreErrors = preCompletedMetrics.reduce((s, m) => s + m.preErrorCount, 0);
  const totalPostErrors = completedMetrics.reduce((s, m) => s + m.postErrorCount, 0);
  const avgPathCompletion =
    metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.pathCompletionPercent, 0) / metrics.length)
      : 0;

  // Competency Gain Chart Data computed 100% from real experimentStudentMetrics
  const competencyChartData = [
    {
      name: 'Kiến thức nền',
      ...calcCompetencyPrePost(CompetencyCode.FOUNDATION),
    },
    {
      name: 'Nhận dạng',
      ...calcCompetencyPrePost(CompetencyCode.RECOGNITION),
    },
    {
      name: 'Biến đổi',
      ...calcCompetencyPrePost(CompetencyCode.TRANSFORMATION),
    },
    {
      name: 'Chính xác TT',
      ...calcCompetencyPrePost(CompetencyCode.CALC_ACCURACY),
    },
    {
      name: 'Vận dụng',
      ...appStats,
    },
  ];

  // Teacher Approval Metric computed 100% from real teacherOverrides (Section 69)
  const overrides = data.teacherOverrides || [];
  const totalDecisions = overrides.length;
  const approvedCount = overrides.filter((o) => o.action === 'APPROVE').length;
  const modifiedCount = overrides.filter((o) => o.action === 'MODIFY').length;
  const rejectedCount = overrides.filter((o) => o.action === 'REJECT').length;
  const approvedPct = totalDecisions > 0 ? Math.round((approvedCount / totalDecisions) * 100) : 0;
  const modifiedPct = totalDecisions > 0 ? Math.round((modifiedCount / totalDecisions) * 100) : 0;
  const rejectedPct =
    totalDecisions > 0 && rejectedCount > 0
      ? Math.max(1, 100 - approvedPct - modifiedPct)
      : 0;

  // Dynamic PATH5 Monitor & Baseline counts
  const expLearningPaths = data.learningPaths.filter(
    (p) => !currentExp?.classId || p.classId === currentExp.classId
  );
  const errorCorrectionTaskCount = expLearningPaths.reduce(
    (sum, p) => sum + p.steps.filter((s) => s.stepType === 'ERROR_CORRECTION').length,
    0
  );
  const teacherInterventionCount = metrics.filter((m) => m.teacherInterventions > 0).length;
  const totalHintsUsed = metrics.reduce((sum, m) => sum + m.hintsUsed, 0);
  const completedCheckpointsCount = metrics.filter((m) => m.checkpointScore !== null).length;

  const needsSupportCount = metrics.filter((m) => (m.preScore ?? 0) < 50).length;
  const recurringErrorCount = metrics.filter((m) => m.preErrorCount >= 3).length;
  const waitingApprovalStudentIds = new Set(
    expLearningPaths.filter((p) => p.status === 'WAITING_APPROVAL').map((p) => p.studentId)
  );
  const waitingApprovalCount = waitingApprovalStudentIds.size;
  const improvingCount = metrics.filter((m) => (m.absoluteGain ?? 0) > 0).length;
  const below60AppCount = preCompletedMetrics.filter(
    (m) => (m.competencyPre?.APPLICATION ?? 0) < 60
  ).length;
  const weakestPreComp = [...competencyChartData].sort((a, b) => a.Pre - b.Pre)[0];

  // Scoped Feedbacks, Case Studies & Evidence for currentExp
  const expFeedbacks = data.feedbackResponses.filter(
    (fb) => !currentExp || fb.experimentId === currentExp.experimentId
  );
  const expCaseStudies = (data.experimentCaseStudies || []).filter(
    (cs) => !currentExp || cs.experimentId === currentExp.experimentId
  );
  const expEvidences = (data.experimentEvidence || []).filter(
    (ev) => !currentExp || ev.experimentId === currentExp.experimentId
  );

  const handleStateTransition = async (targetState: ExperimentState) => {
    if (!currentExp) return;
    setActionMessage(null);
    try {
      await apiClient.transitionExperimentState(currentExp.experimentId, targetState);
      setActionMessage(`Đã chuyển trạng thái thực nghiệm sang: ${targetState}`);
      await onRefresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Lỗi chuyển trạng thái');
    }
  };

  const handleSyncMetricsFromAttempts = async () => {
    if (!currentExp) return;
    setSyncingMetrics(true);
    setActionMessage(null);
    try {
      await apiClient.syncExperimentMetrics(currentExp.experimentId);
      await onRefresh();
      setActionMessage(
        'Đã đồng bộ trực tiếp Baseline (Pre-test) và Outcome (Post-test) từ dữ liệu Attempts của học sinh.'
      );
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Lỗi đồng bộ dữ liệu từ Attempts');
    } finally {
      setSyncingMetrics(false);
    }
  };

  const handleCheckEquivalence = async (preId: string, postId: string) => {
    if (!preId || !postId) return;
    const res = await apiClient.validateEquivalence(preId, postId);
    setEquivalenceResult(res);
  };

  const handleCreateExperiment = async () => {
    if (!newExpTitle.trim()) return;
    const res = await apiClient.createExperiment({
      title: newExpTitle,
      description: newExpDesc,
      classId: newExpClassId,
      targetCompetencies: newExpCompetencies,
      preTestAssessmentId: preAssessId,
      postTestAssessmentId: postAssessId,
      dataSource: newExpDataSource,
      equivalenceApprovedByTeacher: teacherApprovedEq,
    });
    setShowCreateWizard(false);
    setSelectedExpId(res.experiment.experimentId);
    await onRefresh();
  };

  const handleExportExcel = async () => {
    if (!currentExp) return;
    exportExperimentToExcel({
      experiment: currentExp,
      metrics,
      feedbacks: expFeedbacks,
      caseStudies: expCaseStudies,
      teacherApprovalStats: { approvedPct, modifiedPct, rejectedPct },
    });
    await apiClient.logReportExport('EXCEL', currentExp.experimentId);
    await onRefresh();
  };

  const handleExportPdf = async () => {
    if (!currentExp) return;
    exportExperimentToPdf({
      experiment: currentExp,
      metrics,
      feedbacks: expFeedbacks,
      caseStudies: expCaseStudies,
    });
    await apiClient.logReportExport('PDF', currentExp.experimentId);
    await onRefresh();
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvError(null);
    if (!evConsent) {
      setEvError('Vui lòng tích xác nhận đồng thuận sử dụng dữ liệu minh chứng (consentConfirmed).');
      return;
    }
    if (!currentExp) return;
    try {
      await apiClient.uploadExperimentEvidence(currentExp.experimentId, {
        title: evTitle,
        evidenceType: evType,
        fileName: evFileName || 'Minh_Chung_Thuc_Nghiem.pdf',
        notes: evNotes,
        consentConfirmed: evConsent,
      });
      setEvTitle('');
      setEvNotes('');
      setEvFileName('');
      setEvConsent(false);
      await onRefresh();
    } catch (err) {
      setEvError(err instanceof Error ? err.message : 'Lỗi tải minh chứng.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 76. DEMO vs REAL Banner */}
      {currentExp?.dataSource === 'DEMO' && (
        <div className="p-4 rounded-xl bg-amber-50 border border-[#F59E0B] text-sm font-bold text-[#0F172A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            <span>DỮ LIỆU DEMO – KHÔNG PHẢI KẾT QUẢ THỰC NGHIỆM</span>
          </div>
          <span className="text-xs font-normal text-slate-600">
            Báo cáo chính thức mặc định chỉ trích xuất các đợt có dataSource = REAL
          </span>
        </div>
      )}

      {/* Header & Experiment Batch Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-[#2563EB]">
            MODULE NGHIÊN CỨU & THỰC NGHIỆM SƯ PHẠM (SECTIONS 58–77)
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mt-1">{currentExp?.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Lớp: {currentExp?.className}</span>
            <span>·</span>
            <span>Trạng thái: {currentExp?.state}</span>
            <span>·</span>
            <span>Nguồn dữ liệu: {currentExp?.dataSource}</span>
            <span>·</span>
            <span className="font-mono-tabular">
              Tương đương Pre/Post: {currentExp?.equivalenceScore}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={selectedExpId}
            onChange={(e) => setSelectedExpId(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#0F172A] bg-white"
          >
            {data.experiments.map((exp) => (
              <option key={exp.experimentId} value={exp.experimentId}>
                [{exp.dataSource}] {exp.title.slice(0, 48)}... ({exp.state})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setShowCreateWizard(true);
              setWizardStep(1);
              if (preAssessId && postAssessId) {
                handleCheckEquivalence(preAssessId, postAssessId);
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>TẠO ĐỢT THỰC NGHIỆM MỚI</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#16A34A] text-[#16A34A] hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>XUẤT EXCEL (10 SHEETS)</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#2563EB] text-[#2563EB] hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>XUẤT PDF</span>
          </button>
        </div>
      </div>

      {/* Submenu Navigation (Section 58) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-xl">
        {[
          { id: 'overview', label: 'Tổng quan (Impact Dashboard)' },
          { id: 'batches', label: 'Đợt thực nghiệm & Trạng thái' },
          { id: 'prepost', label: 'Pre/Post & Baseline' },
          { id: 'path5_monitor', label: 'Theo dõi PATH5' },
          { id: 'feedback', label: 'Phản hồi (Likert)' },
          { id: 'casestudy', label: 'Case Study' },
          { id: 'evidence', label: 'Minh chứng' },
          { id: 'reports', label: 'Báo cáo & Missing Data' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as ExpSubTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              subTab === t.id
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-[#1E3A8A]">
          {actionMessage}
        </div>
      )}

      {/* =====================================================================
          59. CREATE EXPERIMENT 5-STEP WIZARD MODAL
          ===================================================================== */}
      {showCreateWizard && (
        <div className="bg-white border-2 border-[#2563EB] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold text-[#2563EB]">
                WIZARD KHỞI TẠO ĐỢT THỰC NGHIỆM – BƯỚC {wizardStep} / 5
              </span>
              <h3 className="text-base font-bold text-[#0F172A]">
                {wizardStep === 1 && 'Bước 1: Thông tin đợt thực nghiệm & Nguồn dữ liệu'}
                {wizardStep === 2 && 'Bước 2: Chọn Lớp & Đối tượng học sinh tham gia'}
                {wizardStep === 3 && 'Bước 3: Cấu hình 5 Năng lực Toán 8 mục tiêu'}
                {wizardStep === 4 && 'Bước 4: Chọn bộ đề Pre-test / Post-test & Kiểm định độ tương đương'}
                {wizardStep === 5 && 'Bước 5: Rà soát thiết kế nghiên cứu & Khởi tạo'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateWizard(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Đóng Wizard
            </button>
          </div>

          {wizardStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Tên đợt thực nghiệm
                </label>
                <input
                  type="text"
                  value={newExpTitle}
                  onChange={(e) => setNewExpTitle(e.target.value)}
                  placeholder="Nhập tên đợt thực nghiệm..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Phân loại dữ liệu (dataSource)
                </label>
                <select
                  value={newExpDataSource}
                  onChange={(e) => setNewExpDataSource(e.target.value as 'REAL' | 'DEMO')}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="REAL">REAL – Dữ liệu thực nghiệm chính thức</option>
                  <option value="DEMO">DEMO – Dữ liệu mô phỏng thử nghiệm</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Mục tiêu & Mô tả phương pháp
                </label>
                <textarea
                  rows={2}
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu đánh giá Pre/Post..."
                  className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Chọn lớp thực nghiệm
              </label>
              <select
                value={newExpClassId}
                onChange={(e) => setNewExpClassId(e.target.value)}
                className="w-full max-w-md min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {(data.classes || []).map((c) => (
                  <option key={c.classId} value={c.classId}>
                    Lớp {c.name} ({c.studentCount} học sinh)
                  </option>
                ))}
              </select>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-600 mb-2">
                Chọn các năng lực thành phần cần đo lường Pre/Post:
              </div>
              {Object.values(CompetencyCode).map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={newExpCompetencies.includes(code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewExpCompetencies([...newExpCompetencies, code]);
                      } else {
                        setNewExpCompetencies(newExpCompetencies.filter((c) => c !== code));
                      }
                    }}
                  />
                  <span>{code}</span>
                </label>
              ))}
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Đề Pre-test
                  </label>
                  <select
                    value={preAssessId}
                    onChange={(e) => {
                      setPreAssessId(e.target.value);
                      handleCheckEquivalence(e.target.value, postAssessId);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {data.assessments
                      .filter((a) => a.assessmentType === PrimaryUse.PRE_TEST)
                      .map((a) => (
                        <option key={a.assessmentId} value={a.assessmentId}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Đề Post-test
                  </label>
                  <select
                    value={postAssessId}
                    onChange={(e) => {
                      setPostAssessId(e.target.value);
                      handleCheckEquivalence(preAssessId, e.target.value);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {data.assessments
                      .filter((a) => a.assessmentType === PrimaryUse.POST_TEST)
                      .map((a) => (
                        <option key={a.assessmentId} value={a.assessmentId}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {equivalenceResult && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm space-y-1">
                  <div className="font-bold text-[#16A34A] font-mono-tabular">
                    Mức tương đương Pre/Post: {equivalenceResult.equivalenceScore}% (Không trùng câu hỏi:{' '}
                    {!equivalenceResult.hasOverlappingQuestions ? 'Đạt chuẩn' : 'Vi phạm'})
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#0F172A] pt-1">
                    <input
                      type="checkbox"
                      checked={teacherApprovedEq}
                      onChange={(e) => setTeacherApprovedEq(e.target.checked)}
                    />
                    <span>Giáo viên xác nhận duyệt độ tương đương của hai đề Pre-test và Post-test.</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {wizardStep === 5 && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-1.5">
              <div>
                <strong>Tên đợt:</strong> {newExpTitle || 'Đợt thực nghiệm mới'}
              </div>
              <div>
                <strong>Nguồn dữ liệu:</strong> {newExpDataSource}
              </div>
              <div>
                <strong>Mức tương đương Pre/Post:</strong>{' '}
                {equivalenceResult ? `${equivalenceResult.equivalenceScore}%` : `${currentExp?.equivalenceScore ?? 0}%`}{' '}
                ({teacherApprovedEq ? 'GV đã duyệt' : 'Chưa duyệt'})
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={wizardStep === 1}
              onClick={() => setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Quay lại
            </button>
            {wizardStep < 5 ? (
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(5, wizardStep + 1) as 1 | 2 | 3 | 4 | 5;
                  setWizardStep(next);
                  if (next === 4 && preAssessId && postAssessId) {
                    handleCheckEquivalence(preAssessId, postAssessId);
                  }
                }}
                className="px-5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
              >
                Tiếp tục Bước {wizardStep + 1}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateExperiment}
                className="px-6 py-2.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold cursor-pointer"
              >
                HOÀN TẤT & KHỞI TẠO ĐỢT THỰC NGHIỆM
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 1: WOW SCREEN #4: EXPERIMENT IMPACT DASHBOARD (SECTION 74 & 98)
          ===================================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Headline Impact Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Điểm trung bình (Pre Mean → Post Mean)</div>
              <div className="text-2xl font-bold font-mono-tabular text-[#2563EB] mt-1.5">
                {preMean}% → {completedMetrics.length > 0 ? `${postMean}%` : 'Chưa có Post'}
              </div>
              <div className="text-xs font-semibold text-[#16A34A] mt-1 font-mono-tabular">
                {completedMetrics.length > 0
                  ? `Absolute Gain: +${Math.round((postMean - preMean) * 10) / 10}%`
                  : 'Đang chờ kết quả Post-test'}{' '}
                (N = {completedMetrics.length}/{metrics.length})
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Năng lực Vận dụng (Application Pre → Post)</div>
              <div className="text-2xl font-bold font-mono-tabular text-[#16A34A] mt-1.5">
                {appPreMean}% → {completedMetrics.length > 0 ? `${appPostMean}%` : 'Chưa có Post'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {completedMetrics.length > 0
                  ? `Tăng ${appPostMean - appPreMean >= 0 ? '+' : ''}${appPostMean - appPreMean}% ở năng lực trọng tâm`
                  : `Baseline Vận dụng: ${appPreMean}%`}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Tổng lỗi lặp lại (Repeated Errors Pre → Post)</div>
              <div className="text-2xl font-bold font-mono-tabular text-[#7C3AED] mt-1.5">
                {totalPreErrors} → {completedMetrics.length > 0 ? `${totalPostErrors} lỗi` : 'Chưa có Post'}
              </div>
              <div className="text-xs text-slate-600 mt-1 font-mono-tabular">
                {completedMetrics.length > 0 && totalPreErrors > 0
                  ? `Giảm ${Math.round(((totalPreErrors - totalPostErrors) / totalPreErrors) * 100)}% lỗi Quy tắc dấu & Quy trình`
                  : 'Đo lường từ các bài nộp thực tế'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Hoàn thành Lộ trình (Path Completion)</div>
              <div className="text-2xl font-bold font-mono-tabular text-[#0F172A] mt-1.5">
                {avgPathCompletion}%
              </div>
              <div className="text-xs text-slate-600 mt-1">
                GV Duyệt: {approvedPct}% · Sửa: {modifiedPct}% · Từ chối: {rejectedPct}%
              </div>
            </div>
          </div>

          {/* Pre vs Post BarChart across 5 Competencies */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Biểu đồ đối chiếu Pre-test vs Post-test & Mức tăng trưởng (Gain) theo 5 Năng lực
                </h3>
                <p className="text-xs text-slate-500">
                  Dữ liệu tổng hợp từ {completedMetrics.length} học sinh hoàn thành đầy đủ cả Pre-test và Post-test
                  (Không gán 0 cho {incompleteMetrics.length} học sinh INCOMPLETE).
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-[#16A34A]">
                Độ tương đương đề: {currentExp?.equivalenceScore}%
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competencyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Pre" name="Trước thực nghiệm (Pre-test %)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Post" name="Sau thực nghiệm (Post-test %)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: EXPERIMENT STATES & WORKFLOW (SECTION 60)
          ===================================================================== */}
      {subTab === 'batches' && currentExp && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <div className="text-xs font-bold text-[#2563EB]">
              QUY TRÌNH TRẠNG THÁI THỰC NGHIỆM (STRICT STATE MACHINE – SECTION 60)
            </div>
            <h3 className="text-base font-bold text-[#0F172A] mt-1">
              DRAFT → READY → PRETEST_RUNNING → INTERVENTION_RUNNING → POSTTEST_RUNNING → COMPLETED → ARCHIVED
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Hệ thống khóa chặt thứ tự chuyển trạng thái, không cho phép nhảy cóc khi chưa hoàn thành bước trước.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {[
              ExperimentState.DRAFT,
              ExperimentState.READY,
              ExperimentState.PRETEST_RUNNING,
              ExperimentState.INTERVENTION_RUNNING,
              ExperimentState.POSTTEST_RUNNING,
              ExperimentState.COMPLETED,
              ExperimentState.ARCHIVED,
            ].map((st, idx) => {
              const isCurrent = currentExp.state === st;
              return (
                <div
                  key={st}
                  className={`p-3 rounded-lg border text-center ${
                    isCurrent
                      ? 'border-[#2563EB] bg-blue-50 text-[#1E3A8A] font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-mono-tabular">Bước {idx + 1}</div>
                  <div className="text-xs mt-1 break-all">{st}</div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[#0F172A]">
              Trạng thái hiện tại của đợt đang chọn: <strong className="text-[#2563EB]">{currentExp.state}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentExp.state === ExperimentState.DRAFT && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.READY)}
                  className="px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                >
                  CHUYỂN SANG READY
                </button>
              )}
              {currentExp.state === ExperimentState.READY && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.PRETEST_RUNNING)}
                  className="px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                >
                  MỞ PRE-TEST (PRETEST_RUNNING)
                </button>
              )}
              {currentExp.state === ExperimentState.PRETEST_RUNNING && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.INTERVENTION_RUNNING)}
                  className="px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
                >
                  ĐÓNG PRE-TEST, KHÓA BASELINE & BẮT ĐẦU PATH5
                </button>
              )}
              {currentExp.state === ExperimentState.INTERVENTION_RUNNING && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.POSTTEST_RUNNING)}
                  className="px-4 py-2.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold cursor-pointer"
                >
                  MỞ POST-TEST (POSTTEST_RUNNING)
                </button>
              )}
              {currentExp.state === ExperimentState.POSTTEST_RUNNING && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.COMPLETED)}
                  className="px-4 py-2.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold cursor-pointer"
                >
                  ĐÓNG POST-TEST & TỔNG HỢP KẾT QUẢ (COMPLETED)
                </button>
              )}
              {currentExp.state === ExperimentState.COMPLETED && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.ARCHIVED)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold cursor-pointer"
                >
                  LƯU TRỮ HỒ SƠ (ARCHIVED)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: PRE/POST, BASELINE & EQUIVALENCE CHECKLIST (SECTIONS 61, 62, 64, 65)
          ===================================================================== */}
      {subTab === 'prepost' && currentExp && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 61 & 62: Pre-test & Baseline Lock */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0F172A]">1. Theo dõi Pre-test & Khóa Baseline</h3>
                <span className="text-xs font-mono-tabular font-semibold text-[#16A34A]">
                  {currentExp.baselineLockedAt ? 'Baseline đã khóa' : 'Đang mở Pre-test'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xl font-bold font-mono-tabular text-[#0F172A]">
                    {currentExp.participantCount}
                  </div>
                  <div className="text-xs text-slate-500">Học sinh tham gia</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-xl font-bold font-mono-tabular text-[#16A34A]">
                    {currentExp.preTestSubmittedCount}
                  </div>
                  <div className="text-xs text-slate-600">Đã nộp Pre-test</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-xl font-bold font-mono-tabular text-[#F59E0B]">
                    {currentExp.preTestInProgressCount}
                  </div>
                  <div className="text-xs text-slate-600">Đang làm Pre-test</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/70 border border-[#7C3AED]/30">
                <div className="text-xs font-bold text-[#7C3AED] flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI CLASS SUMMARY (BASELINE TỪ ATTEMPTS)</span>
                </div>
                <p className="text-sm text-[#0F172A]">
                  {preCompletedMetrics.length > 0 ? (
                    <>
                      Năng lực {weakestPreComp?.name || 'Vận dụng'} là điểm cần ưu tiên (TB Baseline:{' '}
                      {weakestPreComp?.Pre ?? 0}%). Có {below60AppCount}/{preCompletedMetrics.length} học sinh đạt
                      Vận dụng dưới 60% và {recurringErrorCount} học sinh lặp lỗi từ 3 lần trở lên.
                    </>
                  ) : (
                    'Chưa có bài nộp Pre-test nào trong đợt thực nghiệm này.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentExp.state === ExperimentState.PRETEST_RUNNING && (
                  <button
                    type="button"
                    onClick={() => handleStateTransition(ExperimentState.INTERVENTION_RUNNING)}
                    className="flex-1 min-h-[48px] py-2.5 px-4 rounded-lg bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>ĐÓNG PRE-TEST, KHÓA BASELINE & BẮT ĐẦU PATH5</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={syncingMetrics}
                  onClick={handleSyncMetricsFromAttempts}
                  className="min-h-[44px] py-2 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingMetrics ? 'animate-spin' : ''}`} />
                  <span>ĐỒNG BỘ TỪ ATTEMPTS</span>
                </button>
              </div>
            </div>

            {/* Section 64 & 65: Post-test Checklist & Equivalence */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0F172A]">
                  2. Điều kiện mở Post-test & Kiểm định Tương đương
                </h3>
                <span className="text-xs font-mono-tabular font-bold text-[#2563EB]">
                  Mức tương đương: {currentExp.equivalenceScore}%
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                {[
                  {
                    label: `Pre-test đã thu thập (${currentExp.preTestSubmittedCount}/${currentExp.participantCount} bài nộp)`,
                    ok: currentExp.preTestSubmittedCount > 0,
                  },
                  {
                    label: 'Baseline 5 năng lực & lỗi ban đầu đã khóa từ Attempts',
                    ok:
                      Boolean(currentExp.baselineLockedAt) ||
                      currentExp.state === ExperimentState.COMPLETED ||
                      currentExp.state === ExperimentState.ARCHIVED,
                  },
                  {
                    label: 'Chu trình can thiệp PATH5 đã triển khai',
                    ok: metrics.some((m) => m.completedSteps > 0),
                  },
                  {
                    label: `Post-test tương đương Pre-test (${currentExp.equivalenceScore}% >= 75%, không trùng câu)`,
                    ok: currentExp.equivalenceApprovedByTeacher && currentExp.equivalenceScore >= 75,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <span className="text-xs font-medium text-[#0F172A]">{item.label}</span>
                    <span
                      className={`text-xs font-bold ${
                        item.ok ? 'text-[#16A34A]' : 'text-[#F59E0B]'
                      }`}
                    >
                      {item.ok ? '✓ Đạt' : 'Chưa đạt'}
                    </span>
                  </div>
                ))}
              </div>

              {currentExp.state === ExperimentState.INTERVENTION_RUNNING && (
                <button
                  type="button"
                  onClick={() => handleStateTransition(ExperimentState.POSTTEST_RUNNING)}
                  className="w-full min-h-[48px] py-2.5 px-4 rounded-lg bg-[#16A34A] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>MỞ POST-TEST</span>
                </button>
              )}
            </div>
          </div>

          {/* Real Baseline & Outcome from Attempts Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  3. Bảng dữ liệu Baseline (Pre-test Attempt) & Outcome (Post-test Attempt)
                </h3>
                <p className="text-xs text-slate-500">
                  Mọi bản ghi Baseline và Outcome được trích xuất tự động từ các lần nộp bài thực tế (Attempts). Học
                  sinh chưa nộp Post-test được giữ trạng thái INCOMPLETE (không gán 0).
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                Đã nộp Pre: {currentExp.preTestSubmittedCount} · Đã nộp Post: {currentExp.postTestSubmittedCount}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Mã HS</th>
                    <th className="py-2.5 px-3">Học sinh</th>
                    <th className="py-2.5 px-3">Baseline Attempt (Pre-test)</th>
                    <th className="py-2.5 px-3 text-right">Điểm Pre</th>
                    <th className="py-2.5 px-3">Outcome Attempt (Post-test)</th>
                    <th className="py-2.5 px-3 text-right">Điểm Post</th>
                    <th className="py-2.5 px-3 text-right">Gain</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.slice(0, 15).map((m) => (
                    <tr key={m.metricId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono-tabular font-semibold">{m.studentCode}</td>
                      <td className="py-2 px-3 font-medium text-[#0F172A]">{m.studentName}</td>
                      <td className="py-2 px-3 font-mono-tabular text-slate-500">
                        {m.baseline?.attemptId || m.preAttemptId || 'Chưa nộp'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold">
                        {m.preScore !== null ? `${m.preScore}%` : 'N/A'}
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-slate-500">
                        {m.outcome?.attemptId || m.postAttemptId || 'Chưa nộp Post-test'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold">
                        {m.postScore !== null ? `${m.postScore}%` : 'INCOMPLETE'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold text-[#16A34A]">
                        {m.absoluteGain !== null
                          ? `${m.absoluteGain >= 0 ? '+' : ''}${m.absoluteGain}%`
                          : 'N/A'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-bold ${
                            m.status === 'COMPLETED' ? 'text-[#16A34A]' : 'text-[#F59E0B]'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: PATH5 EXPERIMENT MONITOR (SECTION 63)
          ===================================================================== */}
      {subTab === 'path5_monitor' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {[
              { label: 'Learning Paths', val: expLearningPaths.length },
              { label: 'Path Completion', val: `${avgPathCompletion}%` },
              { label: 'Error Correction Tasks', val: errorCorrectionTaskCount },
              { label: 'Teacher Interventions', val: teacherInterventionCount },
              { label: 'Hints Used', val: totalHintsUsed },
              { label: 'Checkpoints', val: completedCheckpointsCount },
            ].map((k) => (
              <div key={k.label} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="text-xs text-slate-500">{k.label}</div>
                <div className="text-lg font-bold font-mono-tabular text-[#0F172A] mt-1">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Section 63 Filters with dynamic counts */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {[
              { id: 'ALL', label: `Tất cả (${metrics.length})` },
              { id: 'NEEDS_SUPPORT', label: `Cần hỗ trợ (${needsSupportCount})` },
              { id: 'RECURRING_ERROR', label: `Có lỗi lặp lại (${recurringErrorCount})` },
              { id: 'WAITING_APPROVAL', label: `Path chưa duyệt (${waitingApprovalCount})` },
              { id: 'TEACHER_INTERVENTION', label: `Teacher intervention (${teacherInterventionCount})` },
              { id: 'IMPROVING', label: `Đang tiến bộ (${improvingCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMonitorFilter(f.id as typeof monitorFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  monitorFilter === f.id
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-3">Mã HS</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3 text-right">Hoàn thành Path</th>
                  <th className="py-3 px-3 text-right">Số Hint đã dùng</th>
                  <th className="py-3 px-3 text-right">Điểm Checkpoint</th>
                  <th className="py-3 px-3 text-right">Lỗi Pre → Post</th>
                  <th className="py-3 px-3">Can thiệp GV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics
                  .filter((m) => {
                    if (monitorFilter === 'NEEDS_SUPPORT') return (m.preScore ?? 0) < 50;
                    if (monitorFilter === 'RECURRING_ERROR') return m.preErrorCount >= 3;
                    if (monitorFilter === 'WAITING_APPROVAL') return waitingApprovalStudentIds.has(m.studentId);
                    if (monitorFilter === 'TEACHER_INTERVENTION') return m.teacherInterventions > 0;
                    if (monitorFilter === 'IMPROVING') return (m.absoluteGain ?? 0) > 0;
                    return true;
                  })
                  .slice(0, 15)
                  .map((m) => (
                    <tr key={m.metricId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-tabular font-semibold">{m.studentCode}</td>
                      <td className="py-2.5 px-3 font-medium text-[#0F172A]">{m.studentName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {m.completedSteps}/{m.assignedSteps} ({m.pathCompletionPercent}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">{m.hintsUsed}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#2563EB]">
                        {m.checkpointScore !== null ? `${m.checkpointScore}%` : 'INCOMPLETE'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {m.preErrorCount} → {m.status === 'INCOMPLETE' ? 'N/A' : m.postErrorCount}
                      </td>
                      <td className="py-2.5 px-3">
                        {m.teacherInterventions > 0 ? (
                          <span className="text-[#DC2626] font-semibold">Đã hỗ trợ 1-1</span>
                        ) : (
                          <span className="text-slate-400">Tự chủ</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 5: FEEDBACK STUDENT & TEACHER (SECTIONS 70 & 71)
          ===================================================================== */}
      {subTab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">
              Khảo sát Giáo viên thực nghiệm (Likert 1–5 – Section 71)
            </h3>
            {fbSaved && (
              <div className="p-3 rounded-lg bg-emerald-50 text-xs font-bold text-[#16A34A]">
                Đã lưu phiếu khảo sát của Giáo viên!
              </div>
            )}
            <div className="space-y-3">
              {[
                '1. Heatmap hữu ích trong việc nhận diện nhanh vấn đề của lớp.',
                '2. Learning Path phù hợp với năng lực từng học sinh.',
                '3. AI PATH giúp giảm thời gian phân tích lỗi thủ công.',
                '4. Cơ chế Duyệt / Chỉnh sửa / Từ chối giúp kiểm soát tốt AI.',
                '5. Tôi sẵn sàng tiếp tục sử dụng AI PATH trong giảng dạy.',
              ].map((qText, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#0F172A]">{qText}</span>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const next = [...teacherLikert];
                          next[idx] = v;
                          setTeacherLikert(next);
                        }}
                        className={`w-8 h-8 rounded text-xs font-mono-tabular font-bold border cursor-pointer ${
                          teacherLikert[idx] === v
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <input
                type="text"
                value={teacherOpen1}
                onChange={(e) => setTeacherOpen1(e.target.value)}
                placeholder="Giá trị lớn nhất của hệ thống AI PATH là gì?"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <input
                type="text"
                value={teacherOpen2}
                onChange={(e) => setTeacherOpen2(e.target.value)}
                placeholder="Khó khăn lớn nhất khi triển khai?"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!currentExp) return;
                  await apiClient.submitExperimentFeedback(currentExp.experimentId, {
                    likertScores: teacherLikert,
                    openAnswer1: teacherOpen1,
                    openAnswer2: teacherOpen2,
                  });
                  setFbSaved(true);
                  await onRefresh();
                }}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>LƯU PHẢN HỒI GIÁO VIÊN</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">
              Tổng hợp Phản hồi đã thu thập ({expFeedbacks.length} phiếu)
            </h3>
            <div className="space-y-3">
              {expFeedbacks.map((fb) => (
                <div key={fb.feedbackResponseId} className="p-4 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <strong className="text-[#0F172A]">
                      {fb.respondentName} ({fb.respondentRole})
                    </strong>
                    <span className="font-mono-tabular font-bold text-[#2563EB]">
                      Điểm Likert: {fb.likertScores.join(' - ')} (TB:{' '}
                      {(fb.likertScores.reduce((a, b) => a + b, 0) / 5).toFixed(1)}/5.0)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <strong>Điểm tích cực:</strong> {fb.openAnswer1}
                  </p>
                  {fb.openAnswer2 && (
                    <p className="text-xs text-slate-500">
                      <strong>Đề xuất cải thiện:</strong> {fb.openAnswer2}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 6: CASE STUDY CANDIDATES (SECTION 72)
          ===================================================================== */}
      {subTab === 'casestudy' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-xs font-bold text-[#7C3AED]">
              HỒ SƠ ĐIỂN HÌNH (CASE STUDIES – TRƯỚC → QUÁ TRÌNH PATH5 → SAU)
            </div>
            <h3 className="text-base font-bold text-[#0F172A] mt-1">
              Hệ thống gợi ý {expCaseStudies.length} nhóm ứng viên điển hình – Giáo viên chọn và phê duyệt đưa vào báo cáo
            </h3>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {expCaseStudies.map((cs) => (
                <div
                  key={cs.caseId}
                  className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#2563EB]">{cs.categoryLabelVi}</span>
                      <span className="font-mono-tabular text-slate-500">
                        {cs.studentName} ({cs.pseudonymId})
                      </span>
                    </div>

                    {/* TRƯỚC -> QUÁ TRÌNH PATH5 -> SAU */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500">TRƯỚC (PRE)</div>
                        <div className="text-sm font-bold font-mono-tabular text-[#0F172A] mt-1">
                          App: {cs.beforeSummary.applicationPre}%
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#DC2626]">
                          SIGN_ERROR: {cs.beforeSummary.signErrorPre}
                        </div>
                      </div>

                      <div className="border-x border-slate-200 px-1">
                        <div className="text-[11px] font-bold text-[#7C3AED]">QUÁ TRÌNH PATH5</div>
                        <div className="text-xs font-mono-tabular text-[#0F172A] mt-1">
                          {cs.path5ProcessSummary.stepsCompleted}/{cs.path5ProcessSummary.stepsAssigned} bước ·{' '}
                          {cs.path5ProcessSummary.hintsUsed} Hint
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#2563EB] font-semibold">
                          Checkpoint: {cs.path5ProcessSummary.checkpointScore}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-[#16A34A]">SAU (POST)</div>
                        <div className="text-sm font-bold font-mono-tabular text-[#16A34A] mt-1">
                          App: {cs.afterSummary.applicationPost}%
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#16A34A]">
                          SIGN_ERROR: {cs.afterSummary.signErrorPost}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{cs.narrativeSummary}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span
                      className={`text-xs font-bold ${
                        cs.teacherApproved ? 'text-[#16A34A]' : 'text-[#F59E0B]'
                      }`}
                    >
                      {cs.teacherApproved ? '✓ Giáo viên đã duyệt' : 'Đang chờ Giáo viên duyệt'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!currentExp) return;
                        await apiClient.approveCaseStudy(
                          currentExp.experimentId,
                          cs.caseId,
                          !cs.teacherApproved
                        );
                        await onRefresh();
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        cs.teacherApproved
                          ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                          : 'bg-[#16A34A] text-white'
                      }`}
                    >
                      {cs.teacherApproved ? 'Bỏ duyệt' : 'DUYỆT ĐƯA VÀO BÁO CÁO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 7: EVIDENCE MANAGER (SECTION 73 - WITH CONSENT CONFIRMED)
          ===================================================================== */}
      {subTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">Tải lên Minh chứng Thực nghiệm</h3>
            {evError && (
              <div className="p-3 rounded-lg bg-red-50 text-xs font-semibold text-[#DC2626]">{evError}</div>
            )}
            <form onSubmit={handleUploadEvidence} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Tiêu đề minh chứng</label>
                <input
                  type="text"
                  required
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Ví dụ: Ảnh bài làm nhóm C..."
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Loại minh chứng</label>
                <select
                  value={evType}
                  onChange={(e) => setEvType(e.target.value as typeof evType)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="DOCUMENT">Tài liệu / Phiếu bài làm (.pdf, .docx)</option>
                  <option value="SCREENSHOT">Ảnh chụp màn hình (Screenshot)</option>
                  <option value="IMAGE">Ảnh hoạt động lớp học</option>
                  <option value="VIDEO">Video ghi hình tiết dạy</option>
                  <option value="NOTE">Biên bản / Ghi chú chuyên môn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Chọn tệp đính kèm</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setEvFileName(f.name);
                  }}
                  className="w-full text-xs text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Ghi chú mô tả</label>
                <textarea
                  rows={2}
                  value={evNotes}
                  onChange={(e) => setEvNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-[#0F172A] bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={evConsent}
                  onChange={(e) => setEvConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Xác nhận đồng thuận (consentConfirmed):</strong> Tôi xác nhận minh chứng này đã được sự đồng
                  thuận sử dụng cho mục đích nghiên cứu sư phạm và đã ẩn danh thông tin nhạy cảm của học sinh.
                </span>
              </label>
              <button
                type="submit"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>LƯU MINH CHỨNG</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">
              Kho Minh chứng Thực nghiệm ({expEvidences.length})
            </h3>
            <div className="space-y-3">
              {expEvidences.map((ev) => (
                <div key={ev.evidenceId} className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#2563EB]">{ev.evidenceType}</span>
                    <span className="text-[#16A34A] font-semibold">✓ consentConfirmed</span>
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">{ev.title}</div>
                  {ev.fileName && (
                    <div className="text-xs font-mono-tabular text-slate-500">Tệp: {ev.fileName}</div>
                  )}
                  <p className="text-xs text-slate-600">{ev.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 8: REPORTS & MISSING DATA INTEGRITY (SECTIONS 75 & 77)
          ===================================================================== */}
      {subTab === 'reports' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-bold text-[#2563EB]">
                KIỂM SOÁT DỮ LIỆU KHUYẾT (MISSING DATA – SECTION 77) & XUẤT BÁO CÁO
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mt-1">
                Thống kê mẫu nghiên cứu Lớp {currentExp?.className || ''}: {metrics.length} bắt đầu ·{' '}
                {completedMetrics.length} hoàn thành · {incompleteMetrics.length} không hoàn thành (INCOMPLETE)
              </h3>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleExportExcel}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>XUẤT EXCEL (10 SHEETS)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>XUẤT PDF KHOA HỌC</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            <strong>Nguyên tắc toàn vẹn dữ liệu nghiên cứu (Section 75 & 77):</strong> Hệ thống tuyệt đối không gán{' '}
            <code>missing = 0</code> cho {incompleteMetrics.length} học sinh có Pre-test nhưng chưa nộp Post-test (được
            đánh dấu trạng thái <code>INCOMPLETE</code>). Báo cáo PDF mô tả khách quan xu hướng dữ liệu Pre/Post, không
            tự khẳng định quan hệ nhân quả tuyệt đối khi thiết kế nghiên cứu không có nhóm đối chứng độc lập.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Mã HS</th>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Pre-test</th>
                  <th className="py-2.5 px-3 text-right">Post-test</th>
                  <th className="py-2.5 px-3 text-right">Absolute Gain</th>
                  <th className="py-2.5 px-3 text-right">Normalized Gain</th>
                  <th className="py-2.5 px-3 text-right">Giảm lỗi (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.map((m) => (
                  <tr key={m.metricId} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono-tabular font-semibold">{m.studentCode}</td>
                    <td className="py-2 px-3 font-medium text-[#0F172A]">{m.studentName}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`font-bold ${
                          m.status === 'COMPLETED' ? 'text-[#16A34A]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular">
                      {m.preScore !== null ? `${m.preScore}%` : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular">
                      {m.postScore !== null ? `${m.postScore}%` : 'INCOMPLETE'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular font-bold text-[#16A34A]">
                      {m.absoluteGain !== null ? `+${m.absoluteGain}%` : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular">
                      {m.normalizedGain !== null ? m.normalizedGain : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular">
                      {m.errorReductionPercent === 'N/A' ? 'N/A' : `${m.errorReductionPercent}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

