import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Grid,
  GitBranch,
  Layers,
  FlaskConical,
  FileBarChart,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileText,
  Search,
  Upload,
  Download,
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
import { BrandLogo } from '../components/brand/BrandLogo';
import {
  CompetencyCode,
  CompetencySnapshot,
  ErrorTagCode,
  LearningPath,
  MasteryLevel,
  PathStatus,
  PrimaryUse,
  Question,
  QuestionType,
  Role,
  TopicKnowledgeItem,
  UserAccount,
} from '../types';
import { ExperimentModule } from '../features/ExperimentModule';
import {
  exportExperimentToExcel,
  exportExperimentToPdf,
} from '../utils/excelAndPdfExporter';

interface TeacherPortalProps {
  user: UserAccount;
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

type TeacherNav =
  | 'overview'
  | 'classes'
  | 'assessments'
  | 'heatmap'
  | 'paths'
  | 'grouping'
  | 'experiments'
  | 'reports';

const COMPETENCY_LABELS: Record<CompetencyCode, string> = {
  [CompetencyCode.FOUNDATION]: 'Nền tảng',
  [CompetencyCode.RECOGNITION]: 'Nhận dạng',
  [CompetencyCode.TRANSFORMATION]: 'Biến đổi',
  [CompetencyCode.CALC_ACCURACY]: 'Tính toán',
  [CompetencyCode.APPLICATION]: 'Vận dụng',
};

const ERROR_LABELS: Record<ErrorTagCode, string> = {
  [ErrorTagCode.CONCEPT_ERROR]: 'Sai bản chất khái niệm',
  [ErrorTagCode.FORMULA_ERROR]: 'Nhầm hằng đẳng thức',
  [ErrorTagCode.PROCEDURE_ERROR]: 'Sai quy trình tách/nhóm',
  [ErrorTagCode.SIGN_ERROR]: 'Sai quy tắc dấu khi đặt ngoặc',
  [ErrorTagCode.CALCULATION_ERROR]: 'Sai tính toán hệ số',
  [ErrorTagCode.APPLICATION_ERROR]: 'Không lập được biểu thức thực tế',
};

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  user,
  data,
  onRefresh,
  onLogout,
}) => {
  const [activeNav, setActiveNav] = useState<TeacherNav>('overview');
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');

  const [selectedPathId, setSelectedPathId] = useState<string | null>(
    data.learningPaths.find((p) => p.status === PathStatus.WAITING_APPROVAL)?.pathId ||
      data.learningPaths[0]?.pathId ||
      null
  );
  const [decisionReason, setDecisionReason] = useState(
    'Đã kiểm tra hồ sơ năng lực và lỗi sai của học sinh, đồng ý với lộ trình 5 bước.'
  );
  const [editingSteps, setEditingSteps] = useState<LearningPath['steps'] | null>(null);
  const [submittingPathDecision, setSubmittingPathDecision] = useState(false);

  const [assessSubTab, setAssessSubTab] = useState<
    'list' | 'create_assessment' | 'question_bank' | 'ai_generator' | 'topic_knowledge'
  >('list');
  const [selectedKnowledgeTopicId, setSelectedKnowledgeTopicId] = useState<string>(
    data.topics[0]?.topicId || 'topic_factoring'
  );
  const [editingTeacherKnowledgeId, setEditingTeacherKnowledgeId] = useState<string | null>(null);
  const [savingTeacherKnowledge, setSavingTeacherKnowledge] = useState(false);
  const [teacherKnowledgeForm, setTeacherKnowledgeForm] = useState<{
    title: string;
    knowledgeType: 'CORE_THEORY' | 'FORMULA_RULES' | 'SOLVED_EXAMPLES' | 'FILE_DOCUMENT';
    contentText: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    fileDataUrl?: string;
  }>({
    title: '',
    knowledgeType: 'CORE_THEORY',
    contentText: '',
  });
  const [questionFilterComp, setQuestionFilterComp] = useState<string>('ALL');
  const [questionFilterUse, setQuestionFilterUse] = useState<string>('ALL');

  const [newAssessTitle, setNewAssessTitle] = useState(
    'Kiểm tra Chẩn đoán Phân tích đa thức (Tuần 5)'
  );
  const [newAssessType, setNewAssessType] = useState<PrimaryUse>(PrimaryUse.DIAGNOSTIC);
  const [newAssessDuration, setNewAssessDuration] = useState(20);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    data.questions.filter((q) => q.primaryUse === PrimaryUse.DIAGNOSTIC).map((q) => q.questionId)
  );
  const [creatingAssessment, setCreatingAssessment] = useState(false);

  const [showManualQuestionModal, setShowManualQuestionModal] = useState(false);
  const [manualQText, setManualQText] = useState('');
  const [manualQType, setManualQType] = useState<QuestionType>(QuestionType.MULTIPLE_CHOICE);
  const [manualQComp, setManualQComp] = useState<CompetencyCode>(CompetencyCode.RECOGNITION);
  const [manualQDiff, setManualQDiff] = useState<number>(2);
  const [manualQErrorTag, setManualQErrorTag] = useState<ErrorTagCode>(ErrorTagCode.SIGN_ERROR);
  const [manualQUse, setManualQUse] = useState<PrimaryUse>(PrimaryUse.PRACTICE);
  const [manualQOptA, setManualQOptA] = useState('');
  const [manualQOptB, setManualQOptB] = useState('');
  const [manualQOptC, setManualQOptC] = useState('');
  const [manualQOptD, setManualQOptD] = useState('');
  const [manualQAnswer, setManualQAnswer] = useState('');
  const [manualQSolution, setManualQSolution] = useState('');
  const [manualQHint1, setManualQHint1] = useState('');
  const [manualQHint2, setManualQHint2] = useState('');
  const [manualQHint3, setManualQHint3] = useState('');

  const [aiComp, setAiComp] = useState<CompetencyCode>(CompetencyCode.TRANSFORMATION);
  const [aiDiff, setAiDiff] = useState<number>(2);
  const [aiErrorTag, setAiErrorTag] = useState<ErrorTagCode>(ErrorTagCode.SIGN_ERROR);
  const [aiPrimaryUse, setAiPrimaryUse] = useState<PrimaryUse>(PrimaryUse.ERROR_CORRECTION);
  const [aiCount] = useState<number>(2);
  const [generatingAiQ, setGeneratingAiQ] = useState(false);

  const [classInsight, setClassInsight] = useState<{
    finding: string;
    evidence: string;
    suggestion: string;
  } | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Student Edit & Delete states in Teacher Portal
  const [editingStudent, setEditingStudent] = useState<UserAccount | null>(null);
  const [studentEditForm, setStudentEditForm] = useState({
    code: '',
    fullName: '',
    username: '',
    email: '',
    dob: '',
    gender: 'Nữ',
    className: '8A2',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    newPassword: '',
  });
  const [savingStudentEdit, setSavingStudentEdit] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<UserAccount | null>(null);
  const [deletingStudentLoading, setDeletingStudentLoading] = useState(false);

  // Teacher Profile Edit states
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [teacherProfileForm, setTeacherProfileForm] = useState({
    code: user.code || 'GV001',
    fullName: user.fullName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    dob: user.dob || '',
    gender: user.gender || 'Nữ',
    subjectCode: user.subjectCode || 'Toán 8',
    newPassword: '',
  });
  const [savingTeacherProfile, setSavingTeacherProfile] = useState(false);

  const classes = data.classes || [];
  const activeClass = classes[0];
  const students = (data.users || []).filter((u) => u.role === Role.STUDENT);
  const snapshots = data.competencySnapshots || [];
  const learningPaths = data.learningPaths || [];
  const detectedErrors = data.detectedErrors || [];

  const activeStudentsCount = students.filter((s) => s.status === 'ACTIVE').length;
  const studentsNeedingSupport = snapshots.filter((snap) => {
    const appScore = snap.competencies[CompetencyCode.APPLICATION]?.score ?? 100;
    const hasRecurring = snap.recurringErrors.length > 0;
    const path = learningPaths.find((p) => p.studentId === snap.studentId);
    const lowCheckpoints = (path?.consecutiveLowCheckpoints ?? 0) >= 2;
    return appScore < 50 || hasRecurring || lowCheckpoints || snap.overallMastery < 55;
  });
  const pendingPaths = learningPaths.filter((p) => p.status === PathStatus.WAITING_APPROVAL);

  const totalStepsCount = learningPaths.reduce((acc, p) => acc + p.steps.length, 0);
  const completedStepsCount = learningPaths.reduce(
    (acc, p) => acc + p.steps.filter((s) => s.status === 'COMPLETED').length,
    0
  );
  const weeklyCompletionRate =
    totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;

  const competencyChartData = [
    CompetencyCode.FOUNDATION,
    CompetencyCode.RECOGNITION,
    CompetencyCode.TRANSFORMATION,
    CompetencyCode.CALC_ACCURACY,
    CompetencyCode.APPLICATION,
  ].map((code) => {
    const scores = snapshots.map((s) => s.competencies[code]?.score ?? 0);
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const needSupportCount = scores.filter((sc) => sc < 50).length;
    const masteredCount = scores.filter((sc) => sc >= 70).length;
    return {
      name: COMPETENCY_LABELS[code],
      'Điểm làm chủ TB (%)': avg,
      'Số HS Đạt/Thành thạo': masteredCount,
      'Số HS Cần củng cố': needSupportCount,
    };
  });

  const getMasteryCellColor = (score: number, level?: MasteryLevel) => {
    if (level === MasteryLevel.NEEDS_SUPPORT || score < 50) {
      return 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]';
    }
    if (level === MasteryLevel.DEVELOPING || score < 70) {
      return 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';
    }
    if (level === MasteryLevel.ACHIEVED || score < 85) {
      return 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
    }
    return 'bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]';
  };

  const handleTeacherPathDecision = async (action: 'APPROVE' | 'MODIFY' | 'REJECT') => {
    if (!selectedPathId) return;
    if ((action === 'MODIFY' || action === 'REJECT') && !decisionReason.trim()) {
      setBannerMsg({
        type: 'error',
        text: 'Vui lòng nhập lý do chuyên môn khi chỉnh sửa hoặc từ chối lộ trình.',
      });
      return;
    }
    setSubmittingPathDecision(true);
    setBannerMsg(null);
    try {
      await apiClient.submitTeacherPathDecision(selectedPathId, {
        action,
        reason: decisionReason,
        updatedSteps: action === 'MODIFY' && editingSteps ? editingSteps : undefined,
      });
      await onRefresh();
      setEditingSteps(null);
      setBannerMsg({
        type: 'success',
        text:
          action === 'APPROVE'
            ? 'Đã duyệt lộ trình học tập cá nhân hóa cho học sinh.'
            : action === 'MODIFY'
            ? 'Đã lưu chỉnh sửa lộ trình và ghi nhận Teacher Override.'
            : 'Đã từ chối lộ trình và ghi nhận lý do chuyên môn.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể cập nhật lộ trình.',
      });
    } finally {
      setSubmittingPathDecision(false);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    if (selectedQuestionIds.length === 0) {
      setBannerMsg({ type: 'error', text: 'Vui lòng chọn ít nhất 1 câu hỏi cho bài đánh giá.' });
      return;
    }
    setCreatingAssessment(true);
    setBannerMsg(null);
    try {
      await apiClient.createAssessment({
        title: newAssessTitle,
        assessmentType: newAssessType,
        classId: activeClass.classId,
        competencies: [
          CompetencyCode.FOUNDATION,
          CompetencyCode.RECOGNITION,
          CompetencyCode.TRANSFORMATION,
          CompetencyCode.CALC_ACCURACY,
          CompetencyCode.APPLICATION,
        ],
        questionIds: selectedQuestionIds,
        durationMinutes: newAssessDuration,
      });
      await onRefresh();
      setAssessSubTab('list');
      setBannerMsg({
        type: 'success',
        text: `Đã tạo và phát hành bài đánh giá "${newAssessTitle}" cho lớp ${activeClass.name}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo bài đánh giá.',
      });
    } finally {
      setCreatingAssessment(false);
    }
  };

  const handleGenerateAiQuestions = async () => {
    setGeneratingAiQ(true);
    setBannerMsg(null);
    try {
      const res = await apiClient.generateAiQuestions({
        competency: aiComp,
        difficulty: aiDiff,
        targetError: aiErrorTag,
        primaryUse: aiPrimaryUse,
        count: aiCount,
      });
      await onRefresh();
      setBannerMsg({
        type: res.aiWarning ? 'info' : 'success',
        text:
          res.aiWarning ||
          `Gemini AI đã sinh ${res.questions.length} câu hỏi nháp. Vui lòng kiểm duyệt trước khi đưa vào ngân hàng chính thức.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi gọi AI tạo câu hỏi.',
      });
    } finally {
      setGeneratingAiQ(false);
    }
  };

  const handleApproveQuestion = async (
    questionId: string,
    action: 'APPROVE' | 'MODIFY' | 'REJECT',
    q?: Question
  ) => {
    try {
      await apiClient.approveAiQuestion(questionId, {
        action,
        questionText: q?.questionText,
        correctAnswer: q?.correctAnswer,
        solution: q?.solution,
      });
      await onRefresh();
      setBannerMsg({
        type: 'success',
        text:
          action === 'REJECT'
            ? 'Đã từ chối và loại bỏ câu hỏi nháp.'
            : 'Đã duyệt câu hỏi vào Ngân hàng câu hỏi chuẩn.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi duyệt câu hỏi.',
      });
    }
  };

  const handleCreateManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const options =
        manualQType === QuestionType.MULTIPLE_CHOICE
          ? [
              `A. ${manualQOptA}`,
              `B. ${manualQOptB}`,
              `C. ${manualQOptC}`,
              `D. ${manualQOptD}`,
            ]
          : undefined;
      await apiClient.createManualQuestion({
        questionText: manualQText,
        questionType: manualQType,
        competency: manualQComp,
        difficulty: manualQDiff as 1 | 2 | 3 | 4 | 5,
        errorTags: [manualQErrorTag],
        primaryUse: manualQUse,
        options,
        correctAnswer: manualQAnswer,
        solution: manualQSolution,
        hint1: manualQHint1,
        hint2: manualQHint2,
        hint3: manualQHint3,
      });
      await onRefresh();
      setShowManualQuestionModal(false);
      setManualQText('');
      setManualQAnswer('');
      setManualQSolution('');
      setBannerMsg({
        type: 'success',
        text: 'Đã thêm câu hỏi mới vào Ngân hàng câu hỏi.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo câu hỏi.',
      });
    }
  };

  const handleGroupChange = async (
    studentId: string,
    group: CompetencySnapshot['suggestedGroup']
  ) => {
    if (!activeClass) return;
    try {
      await apiClient.updateClassGrouping(activeClass.classId, studentId, group);
      await onRefresh();
      setBannerMsg({
        type: 'success',
        text: 'Đã cập nhật nhóm học tập cho học sinh và lưu lịch sử phân nhóm.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đổi nhóm học sinh.',
      });
    }
  };

  const handleRequestClassInsight = async () => {
    if (!activeClass) return;
    setLoadingInsight(true);
    try {
      const res = await apiClient.requestClassAiInsight(activeClass.classId);
      setClassInsight(res);
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lấy phân tích AI.',
      });
    } finally {
      setLoadingInsight(false);
    }
  };

  const openEditStudentModal = (st: UserAccount) => {
    setEditingStudent(st);
    setStudentEditForm({
      code: st.code || '',
      fullName: st.fullName || '',
      username: st.username || '',
      email: st.email || '',
      dob: st.dob || '',
      gender: st.gender || 'Nữ',
      className: st.className || activeClass?.name || '8A2',
      status: st.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      newPassword: '',
    });
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingStudentEdit(true);
    setBannerMsg(null);
    try {
      await apiClient.updateUser(editingStudent.userId, {
        code: studentEditForm.code,
        fullName: studentEditForm.fullName,
        username: studentEditForm.username,
        email: studentEditForm.email,
        dob: studentEditForm.dob,
        gender: studentEditForm.gender,
        className: studentEditForm.className,
        status: studentEditForm.status,
        newPassword: studentEditForm.newPassword || undefined,
      });
      await onRefresh();
      setEditingStudent(null);
      setBannerMsg({
        type: 'success',
        text: `Đã cập nhật thông tin học sinh ${studentEditForm.fullName}.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể cập nhật học sinh.',
      });
    } finally {
      setSavingStudentEdit(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setDeletingStudentLoading(true);
    setBannerMsg(null);
    try {
      await apiClient.deleteUser(deletingStudent.userId);
      await onRefresh();
      const deletedName = deletingStudent.fullName;
      setDeletingStudent(null);
      setBannerMsg({
        type: 'success',
        text: `Đã xóa học sinh ${deletedName} khỏi danh sách lớp.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa học sinh.',
      });
    } finally {
      setDeletingStudentLoading(false);
    }
  };

  const openEditTeacherProfileModal = () => {
    setTeacherProfileForm({
      code: user.code || 'GV001',
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      dob: user.dob || '',
      gender: user.gender || 'Nữ',
      subjectCode: user.subjectCode || data.subjects[0]?.name || 'Toán 8',
      newPassword: '',
    });
    setShowEditTeacherModal(true);
  };

  const handleSaveTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTeacherProfile(true);
    setBannerMsg(null);
    try {
      const res = await apiClient.updateUser(user.userId, {
        code: teacherProfileForm.code,
        fullName: teacherProfileForm.fullName,
        username: teacherProfileForm.username,
        email: teacherProfileForm.email,
        phone: teacherProfileForm.phone,
        dob: teacherProfileForm.dob,
        gender: teacherProfileForm.gender,
        subjectCode: teacherProfileForm.subjectCode,
        newPassword: teacherProfileForm.newPassword.trim()
          ? teacherProfileForm.newPassword.trim()
          : undefined,
      });
      await onRefresh();
      setShowEditTeacherModal(false);
      setBannerMsg({
        type: 'success',
        text: `Đã cập nhật thông tin giáo viên ${res.user.fullName} (${res.user.code}).`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu thông tin giáo viên.',
      });
    } finally {
      setSavingTeacherProfile(false);
    }
  };

  const handleTeacherKnowledgeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isTextLike =
      file.type.startsWith('text/') ||
      /\.(txt|md|csv|json|tex)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (isTextLike) {
        const textReader = new FileReader();
        textReader.onload = () => {
          const extractedText = typeof textReader.result === 'string' ? textReader.result : '';
          setTeacherKnowledgeForm((prev) => ({
            ...prev,
            title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
            knowledgeType: prev.knowledgeType || 'FILE_DOCUMENT',
            contentText: extractedText || prev.contentText,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'text/plain',
            fileDataUrl: dataUrl,
          }));
        };
        textReader.readAsText(file, 'utf-8');
      } else {
        setTeacherKnowledgeForm((prev) => ({
          ...prev,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
          knowledgeType: 'FILE_DOCUMENT',
          contentText:
            prev.contentText ||
            `Tài liệu kiến thức chủ đề đính kèm: ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB).`,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          fileDataUrl: dataUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTeacherTopicKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTopicId = selectedKnowledgeTopicId || data.topics[0]?.topicId;
    if (!targetTopicId) {
      setBannerMsg({ type: 'error', text: 'Vui lòng chọn chủ đề môn học cần tải lên kiến thức.' });
      return;
    }
    if (
      !teacherKnowledgeForm.title.trim() ||
      (!teacherKnowledgeForm.contentText.trim() && !teacherKnowledgeForm.fileDataUrl)
    ) {
      setBannerMsg({
        type: 'error',
        text: 'Vui lòng nhập tiêu đề kiến thức và nội dung hoặc chọn file tài liệu tải lên.',
      });
      return;
    }

    setSavingTeacherKnowledge(true);
    setBannerMsg(null);
    try {
      if (editingTeacherKnowledgeId) {
        await apiClient.updateTopicKnowledge(
          targetTopicId,
          editingTeacherKnowledgeId,
          teacherKnowledgeForm
        );
        setBannerMsg({
          type: 'success',
          text: `Đã cập nhật đơn vị kiến thức "${teacherKnowledgeForm.title}".`,
        });
      } else {
        await apiClient.uploadTopicKnowledge(targetTopicId, teacherKnowledgeForm);
        setBannerMsg({
          type: 'success',
          text: `Đã tải lên kiến thức "${teacherKnowledgeForm.title}" cho chủ đề thành công.`,
        });
      }
      await onRefresh();
      setEditingTeacherKnowledgeId(null);
      setTeacherKnowledgeForm({
        title: '',
        knowledgeType: 'CORE_THEORY',
        contentText: '',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tải lên kiến thức chủ đề.',
      });
    } finally {
      setSavingTeacherKnowledge(false);
    }
  };

  const openEditTeacherKnowledgeItem = (topicId: string, item: TopicKnowledgeItem) => {
    setSelectedKnowledgeTopicId(topicId);
    setEditingTeacherKnowledgeId(item.knowledgeId);
    setTeacherKnowledgeForm({
      title: item.title,
      knowledgeType: item.knowledgeType,
      contentText: item.contentText,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      fileDataUrl: item.fileDataUrl,
    });
  };

  const handleDeleteTeacherKnowledgeItem = async (topicId: string, item: TopicKnowledgeItem) => {
    try {
      await apiClient.deleteTopicKnowledge(topicId, item.knowledgeId);
      await onRefresh();
      setBannerMsg({
        type: 'success',
        text: `Đã xóa đơn vị kiến thức "${item.title}".`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa đơn vị kiến thức.',
      });
    }
  };

  const selectedStudent = students.find((s) => s.userId === selectedStudentId) || null;
  const selectedSnapshot = snapshots.find((s) => s.studentId === selectedStudentId) || null;
  const selectedStudentErrors = detectedErrors.filter((e) => e.studentId === selectedStudentId);
  const selectedStudentPath = learningPaths.find((p) => p.studentId === selectedStudentId) || null;

  const activePathForReview =
    learningPaths.find((p) => p.pathId === selectedPathId) || learningPaths[0] || null;
  const activePathStudent = activePathForReview
    ? students.find((s) => s.userId === activePathForReview.studentId)
    : null;
  const activePathSnapshot = activePathForReview
    ? snapshots.find((s) => s.studentId === activePathForReview.studentId)
    : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#0F172A]">
      {/* Fixed Left Sidebar (260px) */}
      <aside className="w-[260px] bg-[#0F172A] text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <BrandLogo
            size="sm"
            variant="dark"
            showSubtitle
            subtitleText="Không gian Giáo viên"
          />
          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="truncate font-medium">{user.fullName}</span>
              <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700/50 text-[11px]">
                Lớp {activeClass?.name || '8A2'}
              </span>
            </div>
            <button
              onClick={openEditTeacherProfileModal}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
            >
              <Edit3 className="w-3 h-3 text-blue-400" />
              <span>Sửa thông tin Giáo viên</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {[
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'classes', label: 'Lớp của tôi', icon: Users },
            { id: 'assessments', label: 'Đánh giá & Ngân hàng', icon: ClipboardCheck },
            { id: 'heatmap', label: 'Bản đồ năng lực', icon: Grid },
            {
              id: 'paths',
              label: 'Lộ trình AI-PATH5',
              icon: GitBranch,
              badge: pendingPaths.length > 0 ? pendingPaths.length : undefined,
            },
            { id: 'grouping', label: 'Phân nhóm & Can thiệp', icon: Layers },
            { id: 'experiments', label: 'Thực nghiệm Sư phạm', icon: FlaskConical },
            { id: 'reports', label: 'Báo cáo & Xuất file', icon: FileBarChart },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id as TeacherNav)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-500 text-slate-950 font-mono-tabular">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="text-xs text-slate-400 mb-2 space-y-0.5">
            <div>
              Khối & Lớp:{' '}
              <strong className="text-slate-200">
                Khối {activeClass?.grade || 8} • Lớp {activeClass?.name || '8A2'}
              </strong>
            </div>
            <div>
              Môn & Chủ đề:{' '}
              <strong className="text-slate-200">
                {data.subjects[0]?.name || 'Toán 8'} — {data.topics[0]?.name || 'Phân tích đa thức'}
              </strong>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950/80 text-slate-200 hover:text-red-200 text-xs font-medium transition-colors border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">
              {activeNav === 'overview' &&
                `Bảng điều khiển Sư phạm & Chẩn đoán — Khối ${activeClass?.grade || 8} (Lớp ${
                  activeClass?.name || '8A2'
                })`}
              {activeNav === 'classes' &&
                `Thông tin Khối ${activeClass?.grade || 8}, Lớp ${
                  activeClass?.name || '8A2'
                }, Môn học & Danh sách Học sinh`}
              {activeNav === 'assessments' && 'Quản lý Bài Đánh giá & Ngân hàng Câu hỏi Chuẩn hóa'}
              {activeNav === 'heatmap' && 'Bản đồ Năng lực (Mastery Heatmap) — 5 Năng lực Toán 8'}
              {activeNav === 'paths' && 'Quản trị & Phê duyệt Lộ trình Cá nhân hóa AI-PATH5'}
              {activeNav === 'grouping' && 'Phân nhóm Sư phạm & Can thiệp Mục tiêu'}
              {activeNav === 'experiments' && 'Module Thực nghiệm Sư phạm & Kiểm chứng Hiệu quả'}
              {activeNav === 'reports' && 'Báo cáo Tiến bộ, Đối sánh Pre/Post & Xuất dữ liệu'}
            </h1>
            <p className="text-xs text-[#475569]">
              {data.schools[0]?.name || 'Trường THCS Thực Nghiệm AI PATH'}
              {data.schools[0]?.address ? ` (${data.schools[0].address})` : ''} • Năm học{' '}
              {data.academicYears.find((y) => y.isCurrent)?.name || '2026–2027'} • Khối{' '}
              {activeClass?.grade || 8} • Môn {data.subjects[0]?.name || 'Toán 8'} • Chủ đề:{' '}
              {data.topics[0]?.name || 'Phân tích đa thức thành nhân tử'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingPaths.length > 0 && (
              <button
                onClick={() => setActiveNav('paths')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{pendingPaths.length} Lộ trình chờ duyệt</span>
              </button>
            )}
            <button
              onClick={openEditTeacherProfileModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Sửa thông tin Giáo viên</span>
            </button>
            <button
              onClick={() => setActiveNav('experiments')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-blue-900"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Thực nghiệm Sư phạm</span>
            </button>
          </div>
        </header>

        {bannerMsg && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-lg border flex items-center justify-between text-sm ${
              bannerMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : bannerMsg.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {bannerMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : bannerMsg.type === 'error' ? (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{bannerMsg.text}</span>
            </div>
            <button
              onClick={() => setBannerMsg(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Đóng
            </button>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* 1. OVERVIEW TAB */}
          {activeNav === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Học sinh đang học
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-[#0F172A] font-mono-tabular">
                      {activeStudentsCount}
                    </span>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {students.length > 0
                        ? Math.round((activeStudentsCount / students.length) * 100)
                        : 0}
                      % lớp {activeClass?.name || ''}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Đã có hồ sơ năng lực đầu vào (Skill Profile)
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    HS cần hỗ trợ ngay
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-[#DC2626] font-mono-tabular">
                      {studentsNeedingSupport.length}
                    </span>
                    <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      Cần can thiệp
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Vận dụng &lt; 50% hoặc lặp lỗi hệ thống &ge; 2 lần
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Lộ trình chờ duyệt
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-[#D97706] font-mono-tabular">
                      {pendingPaths.length}
                    </span>
                    <button
                      onClick={() => setActiveNav('paths')}
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Duyệt ngay →
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    AI đề xuất lộ trình 5 bước, chờ GV xác nhận
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Mức hoàn thành tuần
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-[#2563EB] font-mono-tabular">
                      {weeklyCompletionRate}%
                    </span>
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono-tabular">
                      {completedStepsCount}/{totalStepsCount} bước
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Tỷ lệ hoàn thành các bước trên lộ trình AI-PATH5
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Học sinh cần can thiệp sư phạm
                      </h2>
                      <p className="text-xs text-[#475569]">
                        Phát hiện tự động từ Mastery V1 và Bộ phát hiện lỗi lặp lại (Recurring Error)
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav('heatmap')}
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Xem Bản đồ năng lực →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {studentsNeedingSupport.map((snap) => {
                      const st = students.find((u) => u.userId === snap.studentId);
                      if (!st) return null;
                      const primaryErr = snap.recurringErrors[0];
                      return (
                        <div
                          key={snap.studentId}
                          className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#0F172A]">
                                {st.fullName}
                              </span>
                              <span className="text-xs text-slate-500 font-mono-tabular">
                                ({st.code})
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200 font-mono-tabular">
                                Tổng Mastery: {snap.overallMastery}%
                              </span>
                            </div>
                            <div className="text-xs text-[#475569] flex flex-wrap items-center gap-2">
                              <span>
                                Vận dụng:{' '}
                                <strong className="text-red-700 font-mono-tabular">
                                  {snap.competencies[CompetencyCode.APPLICATION]?.score ?? 0}%
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Lỗi lặp lại:{' '}
                                <strong className="text-amber-800">
                                  {primaryErr ? ERROR_LABELS[primaryErr] : 'Không có lỗi'}
                                </strong>
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedStudentId(st.userId);
                              setActiveNav('heatmap');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Hồ sơ & Lỗi
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Lộ trình AI-PATH5 chờ giáo viên duyệt
                      </h2>
                      <p className="text-xs text-[#475569]">
                        AI gợi ý lộ trình 5 bước — Giáo viên giữ quyền quyết định
                      </p>
                    </div>
                  </div>

                  <div className="p-4 flex-1 space-y-3">
                    {pendingPaths.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Tất cả lộ trình học tập hiện tại đã được giáo viên phê duyệt.
                      </div>
                    ) : (
                      pendingPaths.map((path) => {
                        const st = students.find((u) => u.userId === path.studentId);
                        return (
                          <div
                            key={path.pathId}
                            className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-[#0F172A]">
                                {st?.fullName || path.studentName}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                Chờ GV duyệt
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {path.aiExplanation.teacherReason}
                            </p>
                            <div className="pt-1 flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedPathId(path.pathId);
                                  setActiveNav('paths');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                              >
                                Kiểm tra & Duyệt lộ trình
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Biểu đồ Năng lực Lớp {activeClass?.name || '8A2'} theo 5 Năng lực Toán 8
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Chủ đề: Phân tích đa thức thành nhân tử (Nền tảng, Nhận dạng, Biến đổi, Tính toán, Vận dụng)
                    </p>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={competencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="Điểm làm chủ TB (%)"
                        fill="#2563EB"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 2. MY CLASSES TAB */}
          {activeNav === 'classes' && (
            <div className="space-y-6">
              {/* Thẻ Thông tin Khối, Lớp, Môn học & Chủ đề môn học */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold uppercase text-slate-500">Khối Lớp</div>
                  <div className="text-base font-bold text-[#0F172A]">
                    Khối {activeClass?.grade || 8} (THCS)
                  </div>
                  <div className="text-xs text-slate-500">
                    Năm học: {data.academicYears.find((y) => y.isCurrent)?.name || '2026–2027'}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Lớp học Phụ trách
                    </div>
                    <button
                      onClick={openEditTeacherProfileModal}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Sửa TT Giáo viên</span>
                    </button>
                  </div>
                  <div className="text-base font-bold text-[#2563EB]">
                    Lớp {activeClass?.name || '8A2'} ({students.length} HS)
                  </div>
                  <div className="text-xs text-slate-500">
                    GV phụ trách: {user.fullName} ({user.code})
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Môn học Giảng dạy ({data.subjects.length})
                  </div>
                  <div className="text-base font-bold text-[#0F172A]">
                    {data.subjects.map((s) => s.name).join(', ') || 'Toán 8'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    Mã môn: {data.subjects.map((s) => s.code).join(', ') || 'TOAN_8'}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Chủ đề Môn học ({data.topics.length})
                  </div>
                  <div className="text-sm font-bold text-[#0F172A] line-clamp-1">
                    {data.topics.map((t) => t.name).join(', ') ||
                      'Phân tích đa thức thành nhân tử'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    Mã chủ đề: {data.topics.map((t) => t.code).join(', ')}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchStudentQuery}
                      onChange={(e) => setSearchStudentQuery(e.target.value)}
                      placeholder="Tìm theo mã HS hoặc họ tên..."
                      className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono-tabular">
                    Tổng số: {students.length} học sinh
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveNav('heatmap')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Chuyển sang chế độ Heatmap
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-3 px-4">Mã HS</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Khối / Lớp</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Mastery Tổng</th>
                      <th className="py-3 px-4">Nhóm Sư phạm</th>
                      <th className="py-3 px-4">Lỗi sai đặc trưng</th>
                      <th className="py-3 px-4">Trạng thái Lộ trình</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {students
                      .filter(
                        (s) =>
                          s.fullName.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
                          s.code.toLowerCase().includes(searchStudentQuery.toLowerCase())
                      )
                      .map((st) => {
                        const snap = snapshots.find((sn) => sn.studentId === st.userId);
                        const path = learningPaths.find((p) => p.studentId === st.userId);
                        const primaryErr = snap?.recurringErrors[0];
                        return (
                          <tr key={st.userId} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-600">
                              {st.code}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#0F172A]">
                              {st.fullName}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-blue-700">
                              Khối {st.grade || activeClass?.grade || 8} • Lớp{' '}
                              {st.className || activeClass?.name || '8A2'}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                              {st.username}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded text-xs font-bold border font-mono-tabular ${getMasteryCellColor(
                                  snap?.overallMastery ?? 0
                                )}`}
                              >
                                {snap?.overallMastery ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">
                              {snap?.suggestedGroup === 'GROUP_A_FOUNDATION' && (
                                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                  Nhóm A — Củng cố Nền tảng
                                </span>
                              )}
                              {snap?.suggestedGroup === 'GROUP_B_TRANSFORMATION' && (
                                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Nhóm B — Luyện Biến đổi
                                </span>
                              )}
                              {snap?.suggestedGroup === 'GROUP_C_APPLICATION' && (
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Nhóm C — Tăng cường Vận dụng
                                </span>
                              )}
                              {snap?.suggestedGroup === 'GROUP_D_ADVANCED' && (
                                <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  Nhóm D — Nâng cao
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700">
                              {primaryErr ? ERROR_LABELS[primaryErr] : 'Không có lỗi'}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {path?.status === PathStatus.WAITING_APPROVAL ? (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                                  Chờ GV duyệt
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
                                  Đang học ({path?.steps.filter((s) => s.status === 'COMPLETED').length || 0}/5)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setSelectedStudentId(st.userId);
                                  setActiveNav('heatmap');
                                }}
                                className="px-2.5 py-1 rounded border border-slate-300 text-xs font-semibold hover:bg-slate-100"
                              >
                                Skill Profile
                              </button>
                              {path && (
                                <button
                                  onClick={() => {
                                    setSelectedPathId(path.pathId);
                                    setActiveNav('paths');
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                                >
                                  Lộ trình
                                </button>
                              )}
                              <button
                                onClick={() => openEditStudentModal(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold"
                                title="Chỉnh sửa thông tin học sinh"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Sửa</span>
                              </button>
                              <button
                                onClick={() => setDeletingStudent(st)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. ASSESSMENTS & QUESTION BANK TAB */}
          {activeNav === 'assessments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'list', label: `Bài đánh giá (${data.assessments.length})` },
                    { id: 'create_assessment', label: '+ Tạo Bài đánh giá mới' },
                    { id: 'question_bank', label: `Ngân hàng Câu hỏi (${data.questions.length})` },
                    { id: 'ai_generator', label: 'Gemini AI Tạo & Duyệt Câu hỏi' },
                    {
                      id: 'topic_knowledge',
                      label: `Tải lên Kiến thức Chủ đề (${data.topics.reduce(
                        (sum, tp) => sum + (tp.knowledgeItems?.length || 0),
                        0
                      )})`,
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setAssessSubTab(t.id as typeof assessSubTab)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        assessSubTab === t.id
                          ? 'bg-[#2563EB] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowManualQuestionModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo câu hỏi thủ công</span>
                </button>
              </div>

              {assessSubTab === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.assessments.map((assess) => (
                    <div
                      key={assess.assessmentId}
                      className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {assess.assessmentType}
                          </span>
                          <span className="text-xs font-mono-tabular text-slate-500">
                            {assess.durationMinutes} phút • {assess.questionIds.length} câu
                          </span>
                        </div>
                        <h3 className="mt-2 font-bold text-base text-[#0F172A]">
                          {assess.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Đánh giá 5 năng lực Phân tích đa thức thành nhân tử • Tổng điểm:{' '}
                          <strong className="font-mono-tabular">{assess.totalPoints}</strong>
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-emerald-700 font-semibold">
                          ● Đã phát hành cho Lớp{' '}
                          {classes.find((c) => c.classId === assess.classId)?.name ||
                            activeClass?.name ||
                            ''}
                        </span>
                        <button
                          onClick={() => setAssessSubTab('question_bank')}
                          className="text-[#2563EB] font-semibold hover:underline"
                        >
                          Xem câu hỏi →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {assessSubTab === 'create_assessment' && (
                <form
                  onSubmit={handleCreateAssessment}
                  className="bg-white p-6 rounded-xl border border-slate-200 space-y-5"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Thiết lập Bài Đánh giá (Diagnostic / Pre-test / Post-test / Checkpoint)
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Chọn loại bài đánh giá và cấu hình ma trận câu hỏi theo 5 năng lực
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tên bài đánh giá
                      </label>
                      <input
                        type="text"
                        required
                        value={newAssessTitle}
                        onChange={(e) => setNewAssessTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Loại bài đánh giá
                      </label>
                      <select
                        value={newAssessType}
                        onChange={(e) => setNewAssessType(e.target.value as PrimaryUse)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      >
                        <option value={PrimaryUse.DIAGNOSTIC}>DIAGNOSTIC (Chẩn đoán đầu vào)</option>
                        <option value={PrimaryUse.PRE_TEST}>PRE_TEST (Kiểm tra Trước thực nghiệm)</option>
                        <option value={PrimaryUse.POST_TEST}>POST_TEST (Kiểm tra Sau thực nghiệm)</option>
                        <option value={PrimaryUse.CHECKPOINT}>CHECKPOINT (Kiểm tra Chặng)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Thời gian làm bài (phút)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={90}
                        value={newAssessDuration}
                        onChange={(e) => setNewAssessDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Chọn câu hỏi từ Ngân hàng ({selectedQuestionIds.length} câu đã chọn)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQuestionIds(
                            data.questions
                              .filter((q) => q.primaryUse === newAssessType)
                              .map((q) => q.questionId)
                          )
                        }
                        className="text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        Tự động chọn tất cả câu thuộc nhóm {newAssessType}
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {data.questions
                        .filter((q) => q.teacherApproved)
                        .map((q) => {
                          const checked = selectedQuestionIds.includes(q.questionId);
                          return (
                            <label
                              key={q.questionId}
                              className="p-3 flex items-start gap-3 hover:bg-slate-50 cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQuestionIds([...selectedQuestionIds, q.questionId]);
                                  } else {
                                    setSelectedQuestionIds(
                                      selectedQuestionIds.filter((id) => id !== q.questionId)
                                    );
                                  }
                                }}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono-tabular font-bold text-slate-700">
                                    [{q.questionId}]
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                    {COMPETENCY_LABELS[q.competency]}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                                    Độ khó {q.difficulty}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">
                                    {q.primaryUse}
                                  </span>
                                </div>
                                <p className="mt-1 text-slate-800 font-medium">{q.questionText}</p>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="submit"
                      disabled={creatingAssessment}
                      className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingAssessment ? 'Đang phát hành...' : 'Phát hành Bài Đánh giá'}
                    </button>
                  </div>
                </form>
              )}

              {assessSubTab === 'question_bank' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
                    <select
                      value={questionFilterComp}
                      onChange={(e) => setQuestionFilterComp(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ALL">Tất cả 5 Năng lực</option>
                      {Object.entries(COMPETENCY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v} ({k})
                        </option>
                      ))}
                    </select>

                    <select
                      value={questionFilterUse}
                      onChange={(e) => setQuestionFilterUse(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="ALL">Tất cả Mục đích sử dụng</option>
                      <option value="PRE_TEST">PRE_TEST (10 câu chuẩn)</option>
                      <option value="POST_TEST">POST_TEST (10 câu tương đương)</option>
                      <option value="DIAGNOSTIC">DIAGNOSTIC (8 câu chẩn đoán)</option>
                      <option value="PRACTICE">PRACTICE (8 câu luyện tập)</option>
                      <option value="ERROR_CORRECTION">ERROR_CORRECTION (6 câu sửa lỗi)</option>
                      <option value="CHECKPOINT">CHECKPOINT (6 câu kiểm tra chặng)</option>
                    </select>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
                    {data.questions
                      .filter(
                        (q) =>
                          (questionFilterComp === 'ALL' || q.competency === questionFilterComp) &&
                          (questionFilterUse === 'ALL' || q.primaryUse === questionFilterUse)
                      )
                      .map((q) => (
                        <div key={q.questionId} className="p-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono-tabular font-bold text-slate-600">
                                #{q.questionId}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                                {COMPETENCY_LABELS[q.competency]}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                Độ khó: {q.difficulty}/5
                              </span>
                              {q.errorTags[0] && (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                                  Bẫy lỗi: {ERROR_LABELS[q.errorTags[0]]}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold">
                                {q.primaryUse}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                q.teacherApproved
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {q.teacherApproved ? 'Đã duyệt chuẩn' : 'Chờ GV duyệt'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#0F172A]">{q.questionText}</p>
                          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                            <div>
                              <strong>Đáp án đúng:</strong>{' '}
                              <span className="font-mono-tabular text-emerald-700 font-semibold">
                                {q.correctAnswer}
                              </span>
                            </div>
                            <div>
                              <strong>Lời giải sư phạm:</strong> {q.solution}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {assessSubTab === 'ai_generator' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                      <div>
                        <h2 className="text-base font-bold text-[#0F172A]">
                          Gemini AI Question Generator (Hỗ trợ tạo câu hỏi kèm Gợi ý 3 tầng)
                        </h2>
                        <p className="text-xs text-[#475569]">
                          Câu hỏi do AI sinh ra luôn ở trạng thái Nháp và kiểm tra cú pháp toán học trước khi Giáo viên duyệt.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Năng lực mục tiêu
                        </label>
                        <select
                          value={aiComp}
                          onChange={(e) => setAiComp(e.target.value as CompetencyCode)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                        >
                          {Object.entries(COMPETENCY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Độ khó (1 - 4)
                        </label>
                        <select
                          value={aiDiff}
                          onChange={(e) => setAiDiff(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                        >
                          <option value={1}>Mức 1 - Cơ bản</option>
                          <option value={2}>Mức 2 - Chuẩn</option>
                          <option value={3}>Mức 3 - Khá</option>
                          <option value={4}>Mức 4 - Vận dụng cao</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lỗi sai cần khắc phục
                        </label>
                        <select
                          value={aiErrorTag}
                          onChange={(e) => setAiErrorTag(e.target.value as ErrorTagCode)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                        >
                          {Object.entries(ERROR_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mục đích sử dụng
                        </label>
                        <select
                          value={aiPrimaryUse}
                          onChange={(e) => setAiPrimaryUse(e.target.value as PrimaryUse)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                        >
                          <option value={PrimaryUse.ERROR_CORRECTION}>ERROR_CORRECTION</option>
                          <option value={PrimaryUse.PRACTICE}>PRACTICE</option>
                          <option value={PrimaryUse.CHECKPOINT}>CHECKPOINT</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={handleGenerateAiQuestions}
                          disabled={generatingAiQ}
                          className="w-full py-2 px-4 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{generatingAiQ ? 'Đang sinh câu hỏi...' : 'Gọi AI Tạo câu hỏi'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Hàng đợi Câu hỏi AI chờ Giáo viên Duyệt (
                      {data.questions.filter((q) => !q.teacherApproved).length})
                    </h3>
                    {data.questions.filter((q) => !q.teacherApproved).length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Chưa có câu hỏi nháp nào chờ duyệt. Hãy nhấn "Gọi AI Tạo câu hỏi" ở trên để tạo mới.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.questions
                          .filter((q) => !q.teacherApproved)
                          .map((q) => (
                            <div
                              key={q.questionId}
                              className="p-4 rounded-lg border border-purple-200 bg-purple-50/30 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-900">
                                  {COMPETENCY_LABELS[q.competency]} • Độ khó {q.difficulty} •{' '}
                                  {q.errorTags[0] ? ERROR_LABELS[q.errorTags[0]] : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleApproveQuestion(q.questionId, 'APPROVE')}
                                    className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                                  >
                                    Duyệt câu hỏi
                                  </button>
                                  <button
                                    onClick={() => handleApproveQuestion(q.questionId, 'REJECT')}
                                    className="px-3 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {q.questionText}
                              </p>
                              <div className="text-xs text-slate-700">
                                <strong>Đáp án:</strong> {q.correctAnswer} |{' '}
                                <strong>Lời giải:</strong> {q.solution}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {assessSubTab === 'topic_knowledge' && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#2563EB]" />
                        <h2 className="text-base font-bold text-[#0F172A]">
                          Tải lên & Quản lý Kiến thức của Chủ đề Môn học
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Giáo viên tải lên Lý thuyết cốt lõi, Công thức & Quy tắc, Ví dụ giải mẫu hoặc File tài liệu (.txt, .md, .pdf, .docx) để phục vụ học sinh ôn tập và AI sinh câu hỏi bám sát chương trình.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        Chọn Chủ đề Môn học:
                      </label>
                      <select
                        value={selectedKnowledgeTopicId}
                        onChange={(e) => {
                          setSelectedKnowledgeTopicId(e.target.value);
                          setEditingTeacherKnowledgeId(null);
                        }}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-[#0F172A]"
                      >
                        {data.topics.map((tp) => (
                          <option key={tp.topicId} value={tp.topicId}>
                            {tp.name} ({tp.code} • Khối {tp.grade})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selectedTopic =
                      data.topics.find((t) => t.topicId === selectedKnowledgeTopicId) ||
                      data.topics[0];
                    if (!selectedTopic) return null;
                    const items = selectedTopic.knowledgeItems || [];

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <form
                          onSubmit={handleSaveTeacherTopicKnowledge}
                          className="lg:col-span-5 p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3.5 text-xs self-start"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#1E3A8A] flex items-center gap-1.5">
                              <Upload className="w-4 h-4 text-[#2563EB]" />
                              <span>
                                {editingTeacherKnowledgeId
                                  ? 'Chỉnh sửa Đơn vị Kiến thức'
                                  : `Tải lên Kiến thức: ${selectedTopic.name}`}
                              </span>
                            </span>
                            {editingTeacherKnowledgeId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTeacherKnowledgeId(null);
                                  setTeacherKnowledgeForm({
                                    title: '',
                                    knowledgeType: 'CORE_THEORY',
                                    contentText: '',
                                  });
                                }}
                                className="text-slate-500 underline font-semibold"
                              >
                                Hủy sửa
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Tiêu đề Đơn vị Kiến thức / Tài liệu *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="VD: Chuyên đề Tách & Nhóm hạng tử nâng cao"
                              value={teacherKnowledgeForm.title}
                              onChange={(e) =>
                                setTeacherKnowledgeForm({
                                  ...teacherKnowledgeForm,
                                  title: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-[#0F172A]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Phân loại Kiến thức *
                            </label>
                            <select
                              value={teacherKnowledgeForm.knowledgeType}
                              onChange={(e) =>
                                setTeacherKnowledgeForm({
                                  ...teacherKnowledgeForm,
                                  knowledgeType: e.target.value as
                                    | 'CORE_THEORY'
                                    | 'FORMULA_RULES'
                                    | 'SOLVED_EXAMPLES'
                                    | 'FILE_DOCUMENT',
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                            >
                              <option value="CORE_THEORY">
                                CORE_THEORY — Lý thuyết cốt lõi & Khái niệm
                              </option>
                              <option value="FORMULA_RULES">
                                FORMULA_RULES — Công thức, Hằng đẳng thức & Quy tắc
                              </option>
                              <option value="SOLVED_EXAMPLES">
                                SOLVED_EXAMPLES — Phương pháp giải & Ví dụ minh họa
                              </option>
                              <option value="FILE_DOCUMENT">
                                FILE_DOCUMENT — Tài liệu / Đề cương đính kèm (File)
                              </option>
                            </select>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-dashed border-blue-300 space-y-2">
                            <label className="block font-semibold text-slate-700">
                              Tải lên File Kiến thức (.txt, .md, .pdf, .docx, .xlsx)
                            </label>
                            <input
                              type="file"
                              accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              onChange={handleTeacherKnowledgeFileChange}
                              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {teacherKnowledgeForm.fileName && (
                              <div className="flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded border border-emerald-200">
                                <span>
                                  Đã đính kèm: <strong>{teacherKnowledgeForm.fileName}</strong>{' '}
                                  {teacherKnowledgeForm.fileSize
                                    ? `(${Math.max(1, Math.round(teacherKnowledgeForm.fileSize / 1024))} KB)`
                                    : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTeacherKnowledgeForm({
                                      ...teacherKnowledgeForm,
                                      fileName: undefined,
                                      fileSize: undefined,
                                      mimeType: undefined,
                                      fileDataUrl: undefined,
                                    })
                                  }
                                  className="text-red-600 font-semibold hover:underline"
                                >
                                  Gỡ file
                                </button>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Nội dung chi tiết Kiến thức Chủ đề *
                            </label>
                            <textarea
                              rows={6}
                              required={!teacherKnowledgeForm.fileDataUrl}
                              placeholder="Nhập nội dung lý thuyết, công thức, phương pháp biến đổi hoặc bài tập mẫu..."
                              value={teacherKnowledgeForm.contentText}
                              onChange={(e) =>
                                setTeacherKnowledgeForm({
                                  ...teacherKnowledgeForm,
                                  contentText: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white leading-relaxed"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingTeacherKnowledge}
                            className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-4 h-4" />
                            <span>
                              {savingTeacherKnowledge
                                ? 'Đang lưu kiến thức...'
                                : editingTeacherKnowledgeId
                                ? 'Lưu Cập nhật Đơn vị Kiến thức'
                                : 'Tải lên Kiến thức vào Chủ đề'}
                            </span>
                          </button>
                        </form>

                        <div className="lg:col-span-7 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#0F172A]">
                              Danh mục Kiến thức Chủ đề "{selectedTopic.name}" ({items.length})
                            </h3>
                            <span className="text-xs text-slate-500">
                              Môn: <strong>{selectedTopic.subjectCode}</strong> • Khối{' '}
                              <strong>{selectedTopic.grade}</strong>
                            </span>
                          </div>

                          {selectedTopic.knowledgeSummary && (
                            <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-950">
                              <strong>Trọng tâm kiến thức chủ đề:</strong>{' '}
                              {selectedTopic.knowledgeSummary}
                            </div>
                          )}

                          {items.length === 0 ? (
                            <div className="p-8 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                              Chưa có đơn vị kiến thức nào được tải lên cho chủ đề này.
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                              {items.map((item) => (
                                <div
                                  key={item.knowledgeId}
                                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-sm text-[#0F172A]">
                                          {item.title}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                            item.knowledgeType === 'CORE_THEORY'
                                              ? 'bg-blue-100 text-blue-800'
                                              : item.knowledgeType === 'FORMULA_RULES'
                                              ? 'bg-purple-100 text-purple-800'
                                              : item.knowledgeType === 'SOLVED_EXAMPLES'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {item.knowledgeType === 'CORE_THEORY'
                                            ? 'Lý thuyết cốt lõi'
                                            : item.knowledgeType === 'FORMULA_RULES'
                                            ? 'Công thức & Quy tắc'
                                            : item.knowledgeType === 'SOLVED_EXAMPLES'
                                            ? 'Ví dụ giải mẫu'
                                            : 'Tài liệu File'}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        Người tải lên: <strong>{item.uploadedByName}</strong> •{' '}
                                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {item.fileDataUrl && item.fileName && (
                                        <a
                                          href={item.fileDataUrl}
                                          download={item.fileName}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold hover:bg-emerald-100"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>Tải file ({item.fileName})</span>
                                        </a>
                                      )}
                                      <button
                                        onClick={() =>
                                          openEditTeacherKnowledgeItem(selectedTopic.topicId, item)
                                        }
                                        className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold hover:bg-slate-100"
                                      >
                                        Sửa
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteTeacherKnowledgeItem(
                                            selectedTopic.topicId,
                                            item
                                          )
                                        }
                                        className="px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-white border border-slate-200/90 text-slate-800 whitespace-pre-line leading-relaxed">
                                    {item.contentText}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* 4. HEATMAP TAB */}
          {activeNav === 'heatmap' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={selectedStudent ? 'lg:col-span-8' : 'lg:col-span-12'}>
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Ma trận Năng lực Học sinh × 5 Năng lực Toán 8
                      </h2>
                      <p className="text-xs text-[#475569]">
                        Nhấn vào bất kỳ học sinh nào để mở Hồ sơ Năng lực (Skill Profile), Điểm tin cậy (Confidence) và Lỗi lặp lại
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
                        0–49%: Cần hỗ trợ
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                        50–69%: Đang hình thành
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                        70–84%: Đã đạt
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD]">
                        85–100%: Thành thạo
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                          <th className="py-3 px-3">Học sinh</th>
                          <th className="py-3 px-2 text-center">Nền tảng</th>
                          <th className="py-3 px-2 text-center">Nhận dạng</th>
                          <th className="py-3 px-2 text-center">Biến đổi</th>
                          <th className="py-3 px-2 text-center">Tính toán</th>
                          <th className="py-3 px-2 text-center">Vận dụng</th>
                          <th className="py-3 px-3 text-center">Tổng</th>
                          <th className="py-3 px-3">Độ tin cậy</th>
                          <th className="py-3 px-3">Lỗi chính</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {students.map((st) => {
                          const snap = snapshots.find((s) => s.studentId === st.userId);
                          if (!snap) return null;
                          const isSelected = selectedStudentId === st.userId;
                          const primaryErr = snap.recurringErrors[0];
                          return (
                            <tr
                              key={st.userId}
                              onClick={() => setSelectedStudentId(st.userId)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-semibold text-[#0F172A]">
                                <div>{st.fullName}</div>
                                <div className="text-[11px] text-slate-400 font-mono-tabular">
                                  {st.code}
                                </div>
                              </td>
                              {[
                                CompetencyCode.FOUNDATION,
                                CompetencyCode.RECOGNITION,
                                CompetencyCode.TRANSFORMATION,
                                CompetencyCode.CALC_ACCURACY,
                                CompetencyCode.APPLICATION,
                              ].map((code) => {
                                const cell = snap.competencies[code];
                                return (
                                  <td key={code} className="py-2 px-1.5 text-center">
                                    <div
                                      className={`py-1.5 px-2 rounded border font-mono-tabular font-bold ${getMasteryCellColor(
                                        cell?.score ?? 0,
                                        cell?.level
                                      )}`}
                                    >
                                      {cell?.score ?? 0}%
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 text-center font-mono-tabular font-bold text-slate-900">
                                {snap.overallMastery}%
                              </td>
                              <td className="py-2 px-3 font-mono-tabular">
                                <span className="font-semibold text-slate-700">
                                  {Math.round(snap.overallConfidence * 100)}%
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {primaryErr ? ERROR_LABELS[primaryErr] : 'Không có lỗi'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {selectedStudent && selectedSnapshot && (
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 self-start">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs font-mono-tabular text-slate-500">
                        {selectedStudent.code}
                      </span>
                      <h3 className="text-base font-bold text-[#0F172A]">
                        {selectedStudent.fullName}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Mastery tổng: <strong>{selectedSnapshot.overallMastery}%</strong> • Độ tin
                        cậy: <strong>{Math.round(selectedSnapshot.overallConfidence * 100)}%</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedStudentId(null)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">
                      Điểm Mastery 5 Năng lực (Mastery Engine V1)
                    </div>
                    {[
                      CompetencyCode.FOUNDATION,
                      CompetencyCode.RECOGNITION,
                      CompetencyCode.TRANSFORMATION,
                      CompetencyCode.CALC_ACCURACY,
                      CompetencyCode.APPLICATION,
                    ].map((code) => {
                      const detail = selectedSnapshot.competencies[code];
                      return (
                        <div
                          key={code}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">
                              {COMPETENCY_LABELS[code]}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono-tabular">
                              Ban đầu: {detail?.initialScore ?? '-'}% → Hiện tại: {detail?.score ?? 0}%
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded font-mono-tabular font-bold border ${getMasteryCellColor(
                              detail?.score ?? 0,
                              detail?.level
                            )}`}
                          >
                            {detail?.score ?? 0}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">
                      Lỗi sai đã ghi nhận ({selectedStudentErrors.length})
                    </div>
                    {selectedStudentErrors.length === 0 ? (
                      <p className="text-xs text-slate-500">Không phát hiện lỗi lặp lại.</p>
                    ) : (
                      selectedStudentErrors.map((err) => (
                        <div
                          key={err.errorId}
                          className="p-2.5 rounded-lg bg-red-50/70 border border-red-200 text-xs space-y-1"
                        >
                          <div className="font-bold text-red-900">
                            {ERROR_LABELS[err.errorTag]} (Lặp {err.occurrencesInLast10} lần/10 câu)
                          </div>
                          {err.sampleStudentAnswer && (
                            <div className="text-slate-700">
                              Bài làm mẫu: <code className="font-mono">{err.sampleStudentAnswer}</code>
                            </div>
                          )}
                          <div className="text-slate-600">Trạng thái: {err.status}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedStudentPath && (
                    <button
                      onClick={() => {
                        setSelectedPathId(selectedStudentPath.pathId);
                        setActiveNav('paths');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      Mở Lộ trình AI-PATH5 của {selectedStudent.fullName} →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. LEARNING PATHS TAB */}
          {activeNav === 'paths' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    Danh sách Lộ trình Học sinh ({learningPaths.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Chọn học sinh để kiểm duyệt hoặc điều chỉnh 5 bước học thích ứng
                  </p>
                </div>
                <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                  {learningPaths.map((p) => {
                    const st = students.find((u) => u.userId === p.studentId);
                    const isSelected = activePathForReview?.pathId === p.pathId;
                    return (
                      <button
                        key={p.pathId}
                        onClick={() => {
                          setSelectedPathId(p.pathId);
                          setEditingSteps(null);
                        }}
                        className={`w-full text-left p-3.5 flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-blue-50/90 border-l-4 border-[#2563EB]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm text-[#0F172A]">
                            {st?.fullName || p.studentName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-tabular">
                            Chu kỳ #{p.cycleNumber} • 5 bước chuẩn
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            p.status === PathStatus.WAITING_APPROVAL
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : p.status === PathStatus.REJECTED
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {p.status === PathStatus.WAITING_APPROVAL
                            ? 'Chờ duyệt'
                            : p.status === PathStatus.MODIFIED
                            ? 'GV đã sửa'
                            : p.status === PathStatus.REJECTED
                            ? 'Từ chối'
                            : 'Đã duyệt'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-8 space-y-4">
                {activePathForReview && activePathStudent ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-[#0F172A]">
                            Lộ trình Cá nhân hóa 5 Bước — {activePathStudent.fullName}
                          </h2>
                          <span className="text-xs font-mono-tabular text-slate-500">
                            ({activePathStudent.code})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Mastery tổng:{' '}
                          <strong className="font-mono-tabular">
                            {activePathSnapshot?.overallMastery ?? 0}%
                          </strong>{' '}
                          • Lỗi lặp lại:{' '}
                          <strong>
                            {activePathSnapshot?.recurringErrors
                              .map((e) => ERROR_LABELS[e])
                              .join(', ') || 'Không có'}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!editingSteps ? (
                          <button
                            onClick={() =>
                              setEditingSteps(
                                activePathForReview.steps.map((s) => ({ ...s }))
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Chế độ Chỉnh sửa 5 bước</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingSteps(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600"
                          >
                            Hủy chỉnh sửa
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#7C3AED] uppercase">
                        <Sparkles className="w-4 h-4" />
                        <span>Giải thích Sư phạm từ PATH5 Rule Engine & Gemini</span>
                      </div>
                      <p className="text-sm text-slate-800">
                        {activePathForReview.aiExplanation.teacherReason}
                      </p>
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {activePathForReview.triggerReasons.weakCompetencies.map((wc, idx) => (
                          <span
                            key={`wc_${idx}`}
                            className="px-2 py-0.5 rounded bg-white border border-purple-200 text-[11px] text-purple-900 font-medium"
                          >
                            Năng lực yếu: {COMPETENCY_LABELS[wc.competency]} ({wc.score}%)
                          </span>
                        ))}
                        {activePathForReview.triggerReasons.recurringErrors.map((re, idx) => (
                          <span
                            key={`re_${idx}`}
                            className="px-2 py-0.5 rounded bg-white border border-amber-200 text-[11px] text-amber-900 font-medium"
                          >
                            Lỗi lặp lại: {ERROR_LABELS[re.errorTag]} ({re.count} lần)
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(editingSteps || activePathForReview.steps).map((step, idx) => (
                        <div
                          key={step.stepId}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white font-mono-tabular font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              B{step.stepOrder}
                            </div>
                            <div className="space-y-1 flex-1">
                              {editingSteps ? (
                                <input
                                  type="text"
                                  value={step.title}
                                  onChange={(e) => {
                                    const copy = [...editingSteps];
                                    copy[idx] = { ...copy[idx], title: e.target.value };
                                    setEditingSteps(copy);
                                  }}
                                  className="w-full px-2.5 py-1 rounded border border-slate-300 text-sm font-bold bg-white"
                                />
                              ) : (
                                <div className="font-bold text-sm text-[#0F172A]">{step.title}</div>
                              )}
                              <div className="text-xs text-slate-600">{step.description}</div>
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                                  Năng lực: {COMPETENCY_LABELS[step.targetCompetency]}
                                </span>
                                {step.targetErrorTag && (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                                    Sửa lỗi: {ERROR_LABELS[step.targetErrorTag]}
                                  </span>
                                )}
                                {editingSteps ? (
                                  <select
                                    value={step.targetDifficulty}
                                    onChange={(e) => {
                                      const copy = [...editingSteps];
                                      copy[idx] = {
                                        ...copy[idx],
                                        targetDifficulty: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                                      };
                                      setEditingSteps(copy);
                                    }}
                                    className="px-2 py-0.5 rounded border border-slate-300 bg-white font-semibold"
                                  >
                                    <option value={1}>Độ khó 1</option>
                                    <option value={2}>Độ khó 2</option>
                                    <option value={3}>Độ khó 3</option>
                                    <option value={4}>Độ khó 4</option>
                                  </select>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono-tabular font-semibold">
                                    Độ khó: {step.targetDifficulty}/5
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded text-xs font-bold bg-white border border-slate-200 font-mono-tabular">
                            {step.status === 'COMPLETED'
                              ? `Hoàn thành (${step.scorePercent ?? 100}%)`
                              : step.status === 'AVAILABLE' || step.status === 'IN_PROGRESS'
                              ? 'Đang mở'
                              : 'Đang khóa'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-slate-200 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Nhận xét / Lý do quyết định chuyên môn của Giáo viên (Lưu vào Teacher Overrides)
                      </label>
                      <textarea
                        rows={2}
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder="Nhập lý do duyệt, điều chỉnh độ khó hoặc từ chối lộ trình..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          onClick={() => handleTeacherPathDecision('REJECT')}
                          disabled={submittingPathDecision}
                          className="px-4 py-2 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs font-semibold hover:bg-red-100"
                        >
                          Từ chối Lộ trình
                        </button>
                        {editingSteps && (
                          <button
                            onClick={() => handleTeacherPathDecision('MODIFY')}
                            disabled={submittingPathDecision}
                            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                          >
                            Lưu Chỉnh sửa & Duyệt (Override)
                          </button>
                        )}
                        <button
                          onClick={() => handleTeacherPathDecision('APPROVE')}
                          disabled={submittingPathDecision}
                          className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-emerald-700"
                        >
                          Phê duyệt Lộ trình Chuẩn
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* 6. GROUPING & INTERVENTION TAB */}
          {activeNav === 'grouping' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Gemini AI Class Insight — Phân tích Sư phạm Toàn lớp
                      </h2>
                      <p className="text-xs text-[#475569]">
                        Tổng hợp từ Điểm làm chủ 5 năng lực và Tần suất lỗi sai của học sinh lớp{' '}
                        {activeClass?.name || ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRequestClassInsight}
                    disabled={loadingInsight}
                    className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loadingInsight ? 'Đang phân tích dữ liệu lớp...' : 'Phân tích Lớp học bằng Gemini AI'}
                  </button>
                </div>

                {classInsight && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-lg bg-purple-50/70 border border-purple-200">
                      <div className="text-xs font-bold text-purple-900 uppercase mb-1">
                        1. Phát hiện chính
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {classInsight.finding}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200">
                      <div className="text-xs font-bold text-blue-900 uppercase mb-1">
                        2. Dẫn chứng dữ liệu
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {classInsight.evidence}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200">
                      <div className="text-xs font-bold text-emerald-900 uppercase mb-1">
                        3. Gợi ý hành động cho Giáo viên
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {classInsight.suggestion}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    code: 'GROUP_A_FOUNDATION' as const,
                    title: 'Nhóm A — Củng cố Nền tảng',
                    desc: 'Tập trung đặt nhân tử chung, sửa lỗi dấu và nhận dạng hằng đẳng thức cơ bản',
                    headerClass: 'bg-red-50 border-red-200 text-red-900',
                  },
                  {
                    code: 'GROUP_B_TRANSFORMATION' as const,
                    title: 'Nhóm B — Luyện Biến đổi',
                    desc: 'Rèn luyện phối hợp tách/nhóm hạng tử và kiểm soát dấu',
                    headerClass: 'bg-amber-50 border-amber-200 text-amber-900',
                  },
                  {
                    code: 'GROUP_C_APPLICATION' as const,
                    title: 'Nhóm C — Tăng cường Vận dụng',
                    desc: 'Đã vững cơ bản, tập trung lập biểu thức hình học và bài toán thực tế',
                    headerClass: 'bg-blue-50 border-blue-200 text-blue-900',
                  },
                  {
                    code: 'GROUP_D_ADVANCED' as const,
                    title: 'Nhóm D — Nâng cao',
                    desc: 'Thử thách bài toán chứng minh chia hết và tìm cực trị đa thức',
                    headerClass: 'bg-purple-50 border-purple-200 text-purple-900',
                  },
                ].map((groupCol) => {
                  const groupSnaps = snapshots.filter((s) => s.suggestedGroup === groupCol.code);
                  return (
                    <div
                      key={groupCol.code}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col"
                    >
                      <div className={`p-4 border-b rounded-t-xl ${groupCol.headerClass}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm">{groupCol.title}</h3>
                          <span className="px-2 py-0.5 rounded bg-white/80 text-xs font-mono-tabular font-bold">
                            {groupSnaps.length} HS
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-90">{groupCol.desc}</p>
                      </div>

                      <div className="p-4 space-y-3 flex-1">
                        {groupSnaps.map((snap) => {
                          const st = students.find((u) => u.userId === snap.studentId);
                          if (!st) return null;
                          const primaryErr = snap.recurringErrors[0];
                          return (
                            <div
                              key={snap.studentId}
                              className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-[#0F172A]">
                                  {st.fullName}
                                </span>
                                <span className="font-mono-tabular text-xs font-bold text-slate-700">
                                  {snap.overallMastery}%
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600">
                                Lỗi chính:{' '}
                                <strong>
                                  {primaryErr ? ERROR_LABELS[primaryErr] : 'Không có lỗi'}
                                </strong>
                              </div>
                              <div className="pt-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-500">Đổi nhóm:</span>
                                <select
                                  value={snap.suggestedGroup}
                                  onChange={(e) =>
                                    handleGroupChange(
                                      st.userId,
                                      e.target.value as CompetencySnapshot['suggestedGroup']
                                    )
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                                >
                                  <option value="GROUP_A_FOUNDATION">Nhóm A — Nền tảng</option>
                                  <option value="GROUP_B_TRANSFORMATION">Nhóm B — Biến đổi</option>
                                  <option value="GROUP_C_APPLICATION">Nhóm C — Vận dụng</option>
                                  <option value="GROUP_D_ADVANCED">Nhóm D — Nâng cao</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. EXPERIMENTS MODULE TAB */}
          {activeNav === 'experiments' && (
            <ExperimentModule user={user} data={data} onRefresh={onRefresh} />
          )}

          {/* 8. REPORTS & EXPORT TAB */}
          {activeNav === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Xuất Báo cáo Thực nghiệm Sư phạm & Hồ sơ Năng lực Lớp {activeClass?.name || '8A2'}
                  </h2>
                  <p className="text-xs text-[#475569] mt-1">
                    Báo cáo Excel chuẩn 10 Sheets (Overview, Students, PreTest, PostTest, Competencies, PATH5, Errors, Feedback...) & Báo cáo PDF Sư phạm
                  </p>
                </div>
                {data.experiments[0] && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const exp = data.experiments[0];
                        const metrics = (data.experimentStudentMetrics || []).filter(
                          (m) =>
                            m.experimentId === exp.experimentId &&
                            m.dataSource === exp.dataSource
                        );
                        const feedbacks = (data.feedbackResponses || []).filter(
                          (f) =>
                            f.experimentId === exp.experimentId &&
                            f.dataSource === exp.dataSource
                        );
                        const cases = (data.experimentCaseStudies || []).filter(
                          (c) =>
                            c.experimentId === exp.experimentId &&
                            c.dataSource === exp.dataSource
                        );
                        const expStudentIds = new Set(metrics.map((m) => m.studentId));
                        const overrides = (data.teacherOverrides || []).filter((o) =>
                          o.studentId ? expStudentIds.has(o.studentId) : true
                        );
                        const paths = (data.learningPaths || []).filter((p) =>
                          expStudentIds.has(p.studentId)
                        );
                        const approvedCount =
                          overrides.length > 0
                            ? overrides.filter((o) => o.action === 'APPROVE').length
                            : paths.filter((p) => p.status === PathStatus.APPROVED).length;
                        const modifiedCount =
                          overrides.length > 0
                            ? overrides.filter((o) => o.action === 'MODIFY').length
                            : paths.filter((p) => p.status === PathStatus.MODIFIED).length;
                        const rejectedCount =
                          overrides.length > 0
                            ? overrides.filter((o) => o.action === 'REJECT').length
                            : paths.filter((p) => p.status === PathStatus.REJECTED).length;
                        const totalDecisions = approvedCount + modifiedCount + rejectedCount;

                        exportExperimentToExcel({
                          experiment: exp,
                          metrics,
                          feedbacks,
                          caseStudies: cases,
                          teacherApprovalStats: {
                            approvedPct:
                              totalDecisions > 0
                                ? Math.round((approvedCount / totalDecisions) * 100)
                                : 0,
                            modifiedPct:
                              totalDecisions > 0
                                ? Math.round((modifiedCount / totalDecisions) * 100)
                                : 0,
                            rejectedPct:
                              totalDecisions > 0
                                ? Math.round((rejectedCount / totalDecisions) * 100)
                                : 0,
                          },
                        });
                        apiClient.logReportExport('EXCEL', exp.experimentId);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Tải Báo cáo Excel (10 Sheets)</span>
                    </button>
                    <button
                      onClick={() => {
                        const exp = data.experiments[0];
                        const metrics = (data.experimentStudentMetrics || []).filter(
                          (m) => m.experimentId === exp.experimentId
                        );
                        const feedbacks = (data.feedbackResponses || []).filter(
                          (f) => f.experimentId === exp.experimentId
                        );
                        const cases = (data.experimentCaseStudies || []).filter(
                          (c) => c.experimentId === exp.experimentId
                        );
                        exportExperimentToPdf({
                          experiment: exp,
                          metrics,
                          feedbacks,
                          caseStudies: cases,
                        });
                        apiClient.logReportExport('PDF', exp.experimentId);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-blue-900"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Tải Báo cáo Nghiên cứu PDF</span>
                    </button>
                  </div>
                )}
              </div>

              <ExperimentModule user={user} data={data} onRefresh={onRefresh} />
            </div>
          )}
        </main>
      </div>

      {showManualQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-[#0F172A]">
                Thêm Câu hỏi Mới vào Ngân hàng Chuẩn hóa
              </h3>
              <button
                onClick={() => setShowManualQuestionModal(false)}
                className="text-xs font-semibold text-slate-500"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleCreateManualQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung câu hỏi</label>
                <textarea
                  required
                  rows={2}
                  value={manualQText}
                  onChange={(e) => setManualQText(e.target.value)}
                  placeholder="Ví dụ: Phân tích đa thức 3x^2 - 6x thành nhân tử..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại câu hỏi</label>
                  <select
                    value={manualQType}
                    onChange={(e) => setManualQType(e.target.value as QuestionType)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300"
                  >
                    <option value={QuestionType.MULTIPLE_CHOICE}>Trắc nghiệm 4 lựa chọn</option>
                    <option value={QuestionType.SHORT_ANSWER}>Điền đáp án ngắn</option>
                    <option value={QuestionType.ERROR_ANALYSIS}>Phát hiện & Sửa lỗi</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năng lực</label>
                  <select
                    value={manualQComp}
                    onChange={(e) => setManualQComp(e.target.value as CompetencyCode)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300"
                  >
                    {Object.entries(COMPETENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Độ khó</label>
                  <select
                    value={manualQDiff}
                    onChange={(e) => setManualQDiff(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300"
                  >
                    <option value={1}>Mức 1</option>
                    <option value={2}>Mức 2</option>
                    <option value={3}>Mức 3</option>
                    <option value={4}>Mức 4</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mục đích</label>
                  <select
                    value={manualQUse}
                    onChange={(e) => setManualQUse(e.target.value as PrimaryUse)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300"
                  >
                    <option value={PrimaryUse.PRACTICE}>PRACTICE</option>
                    <option value={PrimaryUse.DIAGNOSTIC}>DIAGNOSTIC</option>
                    <option value={PrimaryUse.ERROR_CORRECTION}>ERROR_CORRECTION</option>
                    <option value={PrimaryUse.CHECKPOINT}>CHECKPOINT</option>
                  </select>
                </div>
              </div>

              {manualQType === QuestionType.MULTIPLE_CHOICE && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Phương án A"
                    value={manualQOptA}
                    onChange={(e) => setManualQOptA(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phương án B"
                    value={manualQOptB}
                    onChange={(e) => setManualQOptB(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phương án C"
                    value={manualQOptC}
                    onChange={(e) => setManualQOptC(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phương án D"
                    value={manualQOptD}
                    onChange={(e) => setManualQOptD(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đáp án đúng</label>
                  <input
                    type="text"
                    required
                    value={manualQAnswer}
                    onChange={(e) => setManualQAnswer(e.target.value)}
                    placeholder="Ví dụ: 3x(x - 2)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhãn lỗi sai</label>
                  <select
                    value={manualQErrorTag}
                    onChange={(e) => setManualQErrorTag(e.target.value as ErrorTagCode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {Object.entries(ERROR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lời giải chi tiết</label>
                <input
                  type="text"
                  required
                  value={manualQSolution}
                  onChange={(e) => setManualQSolution(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Gợi ý tầng 1 (Định hướng)"
                  value={manualQHint1}
                  onChange={(e) => setManualQHint1(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Gợi ý tầng 2 (Phương pháp)"
                  value={manualQHint2}
                  onChange={(e) => setManualQHint2(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Gợi ý tầng 3 (Bước đầu)"
                  value={manualQHint3}
                  onChange={(e) => setManualQHint3(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualQuestionModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white font-semibold"
                >
                  Lưu Câu hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa Học sinh (Giáo viên) */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Chỉnh sửa thông tin Học sinh
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật hồ sơ học sinh hoặc đặt lại mật khẩu đăng nhập
                </p>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã Học sinh *</label>
                  <input
                    type="text"
                    required
                    value={studentEditForm.code}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, code: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên đăng nhập (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentEditForm.username}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, username: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={studentEditForm.fullName}
                  onChange={(e) =>
                    setStudentEditForm({ ...studentEditForm, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp học</label>
                  <select
                    value={studentEditForm.className}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, className: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {classes.map((c) => (
                      <option key={c.classId} value={c.name}>
                        Lớp {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="text"
                    value={studentEditForm.dob}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, dob: e.target.value })
                    }
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={studentEditForm.gender}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={studentEditForm.email}
                  onChange={(e) =>
                    setStudentEditForm({ ...studentEditForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trạng thái tài khoản
                  </label>
                  <select
                    value={studentEditForm.status}
                    onChange={(e) =>
                      setStudentEditForm({
                        ...studentEditForm,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                    <option value="INACTIVE">INACTIVE (Đã khóa)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đặt mật khẩu mới (Để trống nếu giữ nguyên)
                  </label>
                  <input
                    type="text"
                    value={studentEditForm.newPassword}
                    onChange={(e) =>
                      setStudentEditForm({ ...studentEditForm, newPassword: e.target.value })
                    }
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingStudentEdit}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingStudentEdit ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa Học sinh (Giáo viên) */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-red-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Xác nhận xóa Học sinh</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-slate-800 space-y-1">
              <div>
                Họ và tên: <strong className="text-[#0F172A]">{deletingStudent.fullName}</strong>
              </div>
              <div>
                Mã định danh: <strong className="font-mono-tabular">{deletingStudent.code}</strong> •
                Username: <strong className="font-mono-tabular">{deletingStudent.username}</strong>
              </div>
              <div className="text-red-800 pt-1">
                Lưu ý: Toàn bộ hồ sơ năng lực, lộ trình và lịch sử làm bài của học sinh này cũng sẽ
                được xóa khỏi lớp.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={deletingStudentLoading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={deletingStudentLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deletingStudentLoading ? 'Đang xóa...' : 'Xác nhận Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa Thông tin Giáo viên */}
      {showEditTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Chỉnh sửa thông tin Giáo viên
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật thông tin cá nhân, môn giảng dạy, liên hệ hoặc đổi mật khẩu
                </p>
              </div>
              <button
                onClick={() => setShowEditTeacherModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveTeacherProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã Giáo viên *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherProfileForm.code}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, code: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên đăng nhập (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherProfileForm.username}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, username: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Họ và tên Giáo viên *
                </label>
                <input
                  type="text"
                  required
                  value={teacherProfileForm.fullName}
                  onChange={(e) =>
                    setTeacherProfileForm({ ...teacherProfileForm, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn giảng dạy</label>
                  <select
                    value={teacherProfileForm.subjectCode}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, subjectCode: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {data.subjects.map((subj) => (
                      <option key={subj.subjectId} value={subj.name}>
                        {subj.name} (Khối {subj.grade})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lớp đang phụ trách
                  </label>
                  <input
                    type="text"
                    disabled
                    value={activeClass ? `Lớp ${activeClass.name} (Khối ${activeClass.grade})` : 'Lớp 8A2'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email liên hệ</label>
                  <input
                    type="email"
                    value={teacherProfileForm.email}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, email: e.target.value })
                    }
                    placeholder="VD: lan.nt@thcsaipath.edu.vn"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={teacherProfileForm.phone}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, phone: e.target.value })
                    }
                    placeholder="VD: 0912345678"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="text"
                    value={teacherProfileForm.dob}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, dob: e.target.value })
                    }
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={teacherProfileForm.gender}
                    onChange={(e) =>
                      setTeacherProfileForm({ ...teacherProfileForm, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Đổi mật khẩu mới (Để trống nếu giữ nguyên mật khẩu hiện tại)
                </label>
                <input
                  type="text"
                  value={teacherProfileForm.newPassword}
                  onChange={(e) =>
                    setTeacherProfileForm({ ...teacherProfileForm, newPassword: e.target.value })
                  }
                  placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditTeacherModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingTeacherProfile}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTeacherProfile ? 'Đang lưu...' : 'Lưu Thông tin Giáo viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
