import React, { useState } from 'react';
import {
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  LogOut,
  Download,
  Upload,
  KeyRound,
  Filter,
  Activity,
  Edit3,
  Trash2,
  FileText,
} from 'lucide-react';
import { BootstrapPayload, apiClient } from '../services/apiClient';
import { BrandLogo } from '../components/brand/BrandLogo';
import {
  ClassRoom,
  ImportValidationResult,
  Role,
  School,
  Subject,
  Topic,
  TopicKnowledgeItem,
  UserAccount,
} from '../types';
import {
  downloadErrorRowsExcel,
  downloadStudentImportTemplate,
  downloadTeacherImportTemplate,
  parseExcelUpload,
} from '../utils/excelAndPdfExporter';

interface AdminPortalProps {
  user: UserAccount;
  data: BootstrapPayload;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

type AdminTab = 'school' | 'teachers' | 'students' | 'curriculum' | 'logs';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  data,
  onRefresh,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teachers');
  const [banner, setBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [oneTimeCredentials, setOneTimeCredentials] = useState<
    { fullName: string; username: string; tempPassword: string; note?: string }[] | null
  >(null);

  const [filterNeedsAssignment, setFilterNeedsAssignment] = useState(false);
  const [teacherManualForm, setTeacherManualForm] = useState({
    code: 'GV005',
    fullName: '',
    username: '',
    email: '',
    phone: '',
    subjectCode: 'Toán 8',
    className: '8A2',
  });
  const [teacherImportPreview, setTeacherImportPreview] = useState<{
    fileName: string;
    rawRows: Record<string, unknown>[];
    validation: ImportValidationResult;
  } | null>(null);
  const [importSummaryBanner, setImportSummaryBanner] = useState<{
    totalCreated: number;
    assignedCount: number;
    needsCheckCount: number;
  } | null>(null);

  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(8);
  const [newClassTeacherId, setNewClassTeacherId] = useState('');
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [editClassForm, setEditClassForm] = useState({
    name: '',
    grade: 8,
    teacherId: '',
  });

  // Subject & Topic states
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    grade: 8,
    description: '',
  });
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState({
    code: '',
    name: '',
    subjectCode: 'TOAN_8',
    grade: 8,
    description: '',
    knowledgeSummary: '',
  });

  // Topic Knowledge Upload & Management states
  const [activeKnowledgeTopicId, setActiveKnowledgeTopicId] = useState<string>(
    data.topics[0]?.topicId || 'topic_factoring'
  );
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState<{
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

  const [studentManualForm, setStudentManualForm] = useState({
    code: 'HS8A2_15',
    fullName: '',
    username: '',
    dob: '2012-05-15',
    gender: 'Nữ',
    className: '8A2',
    grade: 8,
    email: '',
  });
  const [studentImportPreview, setStudentImportPreview] = useState<{
    fileName: string;
    rawRows: Record<string, unknown>[];
    validation: ImportValidationResult;
  } | null>(null);

  const [newYearName, setNewYearName] = useState('2026 - 2027');

  // Edit & Delete user states
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editForm, setEditForm] = useState({
    code: '',
    fullName: '',
    username: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nữ',
    subjectCode: 'Toán 8',
    className: '8A2',
    status: 'ACTIVE' as UserAccount['status'],
    newPassword: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const primarySchool = data.schools[0] || null;
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    name: primarySchool?.name || 'Trường THCS Demo AI PATH',
    code: primarySchool?.code || 'THCS_AIPATH',
    address: primarySchool?.address || 'Quận Cầu Giấy, Hà Nội',
    provinceCity: primarySchool?.provinceCity || 'Hà Nội',
    principalName: primarySchool?.principalName || '',
    phone: primarySchool?.phone || '',
    email: primarySchool?.email || '',
    status: (primarySchool?.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
  });
  const [savingSchool, setSavingSchool] = useState(false);

  const allUsers = data.users || [];
  const teachers = allUsers.filter((u) => u.role === Role.TEACHER);
  const students = allUsers.filter((u) => u.role === Role.STUDENT);
  const classes = data.classes || [];

  const handleCreateTeacherManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await apiClient.createTeacherManual(teacherManualForm);
      await onRefresh();
      setOneTimeCredentials([
        {
          fullName: res.user.fullName,
          username: res.user.username,
          tempPassword: res.oneTimeTempPassword,
          note:
            res.user.status === 'NEEDS_ASSIGNMENT_CHECK'
              ? 'Cần kiểm tra phân công'
              : 'Đã phân công đầy đủ',
        },
      ]);
      setTeacherManualForm({
        ...teacherManualForm,
        code: `GV00${teachers.length + 2}`,
        fullName: '',
        username: '',
      });
      setBanner({
        type: 'success',
        text: `Đã tạo tài khoản giáo viên ${res.user.fullName}. Vui lòng lưu lại mật khẩu tạm hiển thị một lần bên dưới.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo giáo viên.',
      });
    }
  };

  const handleTeacherExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBanner(null);
    try {
      const rows = await parseExcelUpload(file);
      const validation = await apiClient.validateTeacherImport(rows, file.name);
      setTeacherImportPreview({
        fileName: file.name,
        rawRows: rows,
        validation,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đọc file Excel giáo viên.',
      });
    }
  };

  const handleCommitTeacherImport = async () => {
    if (!teacherImportPreview) return;
    try {
      const res = await apiClient.commitTeacherImport(
        teacherImportPreview.rawRows,
        teacherImportPreview.fileName
      );
      await onRefresh();
      setImportSummaryBanner({
        totalCreated: res.totalCreated,
        assignedCount: res.assignedCount,
        needsCheckCount: res.needsCheckCount,
      });
      setOneTimeCredentials(
        res.createdTeachers.map((item) => ({
          fullName: item.user.fullName,
          username: item.user.username,
          tempPassword: item.tempPassword,
          note: item.needsAssignmentCheck
            ? 'Cảnh báo: Chưa gán lớp / cần kiểm tra phân công'
            : 'Hợp lệ: Đã phân công đầy đủ',
        }))
      );
      setTeacherImportPreview(null);
      setBanner({
        type: 'success',
        text: `Đã import thành công ${res.totalCreated} giáo viên từ Excel.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi lưu danh sách giáo viên.',
      });
    }
  };

  const handleCreateStudentManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await apiClient.createStudentManual(studentManualForm);
      await onRefresh();
      setOneTimeCredentials([
        {
          fullName: res.user.fullName,
          username: res.user.username,
          tempPassword: res.oneTimeTempPassword,
          note: `Lớp ${studentManualForm.className}`,
        },
      ]);
      setStudentManualForm({
        ...studentManualForm,
        code: `HS8A2_${students.length + 2}`,
        fullName: '',
        username: '',
      });
      setBanner({
        type: 'success',
        text: `Đã tạo tài khoản học sinh ${res.user.fullName} và gán vào lớp ${studentManualForm.className}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo học sinh.',
      });
    }
  };

  const handleStudentExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBanner(null);
    try {
      const rows = await parseExcelUpload(file);
      const validation = await apiClient.validateStudentImport(rows, file.name);
      setStudentImportPreview({
        fileName: file.name,
        rawRows: rows,
        validation,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đọc file Excel học sinh.',
      });
    }
  };

  const handleCommitStudentImport = async () => {
    if (!studentImportPreview) return;
    try {
      const res = await apiClient.commitStudentImport(
        studentImportPreview.rawRows,
        studentImportPreview.fileName
      );
      await onRefresh();
      setOneTimeCredentials(
        res.createdStudents.map((item) => ({
          fullName: item.user.fullName,
          username: item.user.username,
          tempPassword: item.tempPassword,
          note: 'Đã tự động gán vào lớp học',
        }))
      );
      setStudentImportPreview(null);
      setBanner({
        type: 'success',
        text: `Đã import thành công ${res.totalCreated} học sinh và gán lớp tự động.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi import học sinh.',
      });
    }
  };

  const handleUpdateTeacherAssignment = async (
    userId: string,
    action: 'CONFIRM' | 'UPDATE' | 'UNASSIGN',
    subjectCode?: string,
    className?: string
  ) => {
    try {
      await apiClient.updateTeacherAssignment(userId, { action, subjectCode, className });
      await onRefresh();
      setBanner({
        type: 'success',
        text: 'Đã cập nhật phân công chuyên môn cho giáo viên.',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể cập nhật phân công.',
      });
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await apiClient.createClass({
        name: newClassName.trim(),
        grade: newClassGrade,
        teacherId: newClassTeacherId || undefined,
      });
      await onRefresh();
      setNewClassName('');
      setBanner({
        type: 'success',
        text: `Đã tạo lớp ${newClassName} (Khối ${newClassGrade}) thành công.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tạo lớp học.',
      });
    }
  };

  const openEditClassModal = (cls: ClassRoom) => {
    setEditingClass(cls);
    setEditClassForm({
      name: cls.name,
      grade: cls.grade || 8,
      teacherId: cls.teacherId || '',
    });
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    try {
      await apiClient.updateClass(editingClass.classId, {
        name: editClassForm.name,
        grade: editClassForm.grade,
        teacherId: editClassForm.teacherId || undefined,
      });
      await onRefresh();
      setEditingClass(null);
      setBanner({
        type: 'success',
        text: `Đã cập nhật lớp ${editClassForm.name} (Khối ${editClassForm.grade}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể cập nhật lớp học.',
      });
    }
  };

  const handleDeleteClass = async (cls: ClassRoom) => {
    try {
      await apiClient.deleteClass(cls.classId);
      await onRefresh();
      setBanner({
        type: 'success',
        text: `Đã xóa lớp ${cls.name} (Khối ${cls.grade}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa lớp học.',
      });
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.code.trim() || !subjectForm.name.trim()) return;
    try {
      if (editingSubjectId) {
        await apiClient.updateSubject(editingSubjectId, subjectForm);
        setBanner({
          type: 'success',
          text: `Đã cập nhật môn học ${subjectForm.name} (Khối ${subjectForm.grade}).`,
        });
      } else {
        await apiClient.createSubject(subjectForm);
        setBanner({
          type: 'success',
          text: `Đã thêm môn học mới: ${subjectForm.name} (Khối ${subjectForm.grade}).`,
        });
      }
      await onRefresh();
      setEditingSubjectId(null);
      setSubjectForm({ code: '', name: '', grade: 8, description: '' });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu môn học.',
      });
    }
  };

  const openEditSubject = (subj: Subject) => {
    setEditingSubjectId(subj.subjectId);
    setSubjectForm({
      code: subj.code,
      name: subj.name,
      grade: subj.grade || 8,
      description: subj.description || '',
    });
  };

  const handleDeleteSubject = async (subj: Subject) => {
    try {
      await apiClient.deleteSubject(subj.subjectId);
      await onRefresh();
      setBanner({
        type: 'success',
        text: `Đã xóa môn học ${subj.name} (${subj.code}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa môn học.',
      });
    }
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.code.trim() || !topicForm.name.trim()) return;
    try {
      if (editingTopicId) {
        await apiClient.updateTopic(editingTopicId, topicForm);
        setBanner({
          type: 'success',
          text: `Đã cập nhật chủ đề môn học: ${topicForm.name} (Khối ${topicForm.grade}).`,
        });
      } else {
        await apiClient.createTopic(topicForm);
        setBanner({
          type: 'success',
          text: `Đã thêm chủ đề môn học mới: ${topicForm.name} (Khối ${topicForm.grade}).`,
        });
      }
      await onRefresh();
      setEditingTopicId(null);
      setTopicForm({
        code: '',
        name: '',
        subjectCode: data.subjects[0]?.code || 'TOAN_8',
        grade: 8,
        description: '',
        knowledgeSummary: '',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu chủ đề môn học.',
      });
    }
  };

  const openEditTopic = (tp: Topic) => {
    setEditingTopicId(tp.topicId);
    setTopicForm({
      code: tp.code,
      name: tp.name,
      subjectCode: tp.subjectCode || 'TOAN_8',
      grade: tp.grade || 8,
      description: tp.description || '',
      knowledgeSummary: tp.knowledgeSummary || '',
    });
  };

  const handleDeleteTopic = async (tp: Topic) => {
    try {
      await apiClient.deleteTopic(tp.topicId);
      await onRefresh();
      setBanner({
        type: 'success',
        text: `Đã xóa chủ đề môn học ${tp.name} (${tp.code}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa chủ đề môn học.',
      });
    }
  };

  const handleKnowledgeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setKnowledgeForm((prev) => ({
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
        setKnowledgeForm((prev) => ({
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

  const handleSaveTopicKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTopicId = activeKnowledgeTopicId || data.topics[0]?.topicId;
    if (!targetTopicId) {
      setBanner({ type: 'error', text: 'Vui lòng chọn chủ đề môn học cần tải lên kiến thức.' });
      return;
    }
    if (!knowledgeForm.title.trim() || (!knowledgeForm.contentText.trim() && !knowledgeForm.fileDataUrl)) {
      setBanner({
        type: 'error',
        text: 'Vui lòng nhập tiêu đề kiến thức và nội dung hoặc chọn file tài liệu tải lên.',
      });
      return;
    }

    setSavingKnowledge(true);
    setBanner(null);
    try {
      if (editingKnowledgeId) {
        await apiClient.updateTopicKnowledge(targetTopicId, editingKnowledgeId, knowledgeForm);
        setBanner({
          type: 'success',
          text: `Đã cập nhật đơn vị kiến thức "${knowledgeForm.title}".`,
        });
      } else {
        await apiClient.uploadTopicKnowledge(targetTopicId, knowledgeForm);
        setBanner({
          type: 'success',
          text: `Đã tải lên kiến thức "${knowledgeForm.title}" cho chủ đề thành công.`,
        });
      }
      await onRefresh();
      setEditingKnowledgeId(null);
      setKnowledgeForm({
        title: '',
        knowledgeType: 'CORE_THEORY',
        contentText: '',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi tải lên kiến thức chủ đề.',
      });
    } finally {
      setSavingKnowledge(false);
    }
  };

  const openEditKnowledgeItem = (topicId: string, item: TopicKnowledgeItem) => {
    setActiveKnowledgeTopicId(topicId);
    setEditingKnowledgeId(item.knowledgeId);
    setKnowledgeForm({
      title: item.title,
      knowledgeType: item.knowledgeType,
      contentText: item.contentText,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      fileDataUrl: item.fileDataUrl,
    });
  };

  const handleDeleteKnowledgeItem = async (topicId: string, item: TopicKnowledgeItem) => {
    try {
      await apiClient.deleteTopicKnowledge(topicId, item.knowledgeId);
      await onRefresh();
      setBanner({
        type: 'success',
        text: `Đã xóa đơn vị kiến thức "${item.title}".`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa đơn vị kiến thức.',
      });
    }
  };

  const handleToggleStatus = async (u: UserAccount) => {
    const nextStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.toggleUserStatus(u.userId, nextStatus);
      await onRefresh();
      setBanner({
        type: 'info',
        text: `Đã chuyển trạng thái tài khoản ${u.username} sang ${nextStatus}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đổi trạng thái tài khoản.',
      });
    }
  };

  const openEditUserModal = (u: UserAccount) => {
    setEditingUser(u);
    setEditForm({
      code: u.code || '',
      fullName: u.fullName || '',
      username: u.username || '',
      email: u.email || '',
      phone: u.phone || '',
      dob: u.dob || '',
      gender: u.gender || 'Nữ',
      subjectCode: u.subjectCode || 'Toán 8',
      className: u.className || u.assignedClassNames?.[0] || '8A2',
      status: u.status,
      newPassword: '',
    });
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setBanner(null);
    try {
      const res = await apiClient.updateUser(editingUser.userId, {
        code: editForm.code,
        fullName: editForm.fullName,
        username: editForm.username,
        email: editForm.email,
        phone: editForm.phone,
        dob: editForm.dob,
        gender: editForm.gender,
        subjectCode: editingUser.role === Role.TEACHER ? editForm.subjectCode : undefined,
        className: editForm.className,
        status: editForm.status,
        newPassword: editForm.newPassword.trim() ? editForm.newPassword.trim() : undefined,
      });
      await onRefresh();
      setEditingUser(null);
      setBanner({
        type: 'success',
        text: `Đã cập nhật thông tin ${res.user.role === Role.TEACHER ? 'giáo viên' : 'học sinh'} ${res.user.fullName} (${res.user.code}).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu chỉnh sửa tài khoản.',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeletingLoading(true);
    setBanner(null);
    try {
      await apiClient.deleteUser(deletingUser.userId);
      await onRefresh();
      const deletedName = deletingUser.fullName;
      const deletedRole = deletingUser.role === Role.TEACHER ? 'giáo viên' : 'học sinh';
      setDeletingUser(null);
      setBanner({
        type: 'success',
        text: `Đã xóa vĩnh viễn tài khoản ${deletedRole} ${deletedName}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể xóa tài khoản.',
      });
    } finally {
      setDeletingLoading(false);
    }
  };

  const openEditSchool = (sch: School) => {
    setEditingSchoolId(sch.schoolId);
    setSchoolForm({
      name: sch.name || '',
      code: sch.code || '',
      address: sch.address || '',
      provinceCity: sch.provinceCity || '',
      principalName: sch.principalName || '',
      phone: sch.phone || '',
      email: sch.email || '',
      status: sch.status || 'ACTIVE',
    });
  };

  const handleSaveSchool = async (e: React.FormEvent, targetSchoolId?: string) => {
    e.preventDefault();
    const sid = targetSchoolId || editingSchoolId || primarySchool?.schoolId;
    if (!sid) return;
    setSavingSchool(true);
    setBanner(null);
    try {
      const res = await apiClient.updateSchool(sid, schoolForm);
      await onRefresh();
      setEditingSchoolId(null);
      setBanner({
        type: 'success',
        text: `Đã cập nhật thông tin trường "${res.school.name}" và địa chỉ "${res.school.address || 'Chưa cập nhật'}".`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu thông tin trường học.',
      });
    } finally {
      setSavingSchool(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#0F172A]">
      <aside className="w-[260px] bg-[#0F172A] text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <BrandLogo
            size="sm"
            variant="dark"
            showSubtitle
            subtitleText="Quản trị Hệ thống & Dữ liệu"
          />
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>{user.fullName}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 text-[10px] font-bold">
              ADMIN
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'teachers', label: 'Quản lý Giáo viên & Import', icon: Users },
            { id: 'students', label: 'Lớp học & Import Học sinh', icon: GraduationCap },
            { id: 'school', label: 'Trường & Năm học', icon: Building2 },
            { id: 'curriculum', label: 'Môn, Chủ đề & Ngân hàng', icon: BookOpen },
            { id: 'logs', label: 'AI Logs & Audit Logs', icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950 text-xs font-semibold text-slate-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">
              {activeTab === 'teachers' && 'Quản lý Giáo viên, Phân công Chuyên môn & Import Excel'}
              {activeTab === 'students' && 'Quản lý Lớp học, Tài khoản Học sinh & Import Excel'}
              {activeTab === 'school' && 'Cấu hình Trường học, Địa chỉ & Năm học'}
              {activeTab === 'curriculum' && 'Danh mục Môn học, Chủ đề, 5 Năng lực & Ngân hàng Câu hỏi'}
              {activeTab === 'logs' && 'Nhật ký Vận hành AI (AI Runs) & Nhật ký Kiểm toán (Audit Logs)'}
            </h1>
            <p className="text-xs text-[#475569]">
              {primarySchool ? `${primarySchool.name} (${primarySchool.code})` : 'Trường THCS AI PATH'}
              {primarySchool?.address ? ` • Địa chỉ: ${primarySchool.address}` : ''} • Cô lập dữ liệu theo trường (schoolId)
            </p>
          </div>
          {primarySchool && (
            <button
              onClick={() => {
                openEditSchool(primarySchool);
                setActiveTab('school');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Sửa Thông tin Trường & Địa chỉ</span>
            </button>
          )}
        </header>

        {banner && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-lg border flex items-center justify-between text-sm ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : banner.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="text-xs font-bold underline">
              Đóng
            </button>
          </div>
        )}

        {oneTimeCredentials && oneTimeCredentials.length > 0 && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <KeyRound className="w-4 h-4 text-amber-700" />
                <span>
                  MẬT KHẨU TẠM THỜI (CHỈ HIỂN THỊ MỘT LẦN DUY NHẤT SAU KHI TẠO)
                </span>
              </div>
              <button
                onClick={() => setOneTimeCredentials(null)}
                className="px-3 py-1 rounded bg-amber-900 text-white text-xs font-semibold"
              >
                Đã sao chép & Đóng vĩnh viễn
              </button>
            </div>
            <p className="text-xs text-amber-900">
              Hệ thống chỉ lưu bản băm mật khẩu (PBKDF2-SHA256), không lưu plaintext. Hãy cấp mật khẩu tạm dưới đây cho giáo viên/học sinh:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {oneTimeCredentials.map((cred, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-white border border-amber-300 text-xs font-mono-tabular"
                >
                  <div className="font-bold text-slate-900">{cred.fullName}</div>
                  <div>
                    Username: <strong className="text-blue-700">{cred.username}</strong>
                  </div>
                  <div>
                    Mật khẩu tạm: <strong className="text-red-700">{cred.tempPassword}</strong>
                  </div>
                  {cred.note && <div className="text-[11px] text-slate-500 mt-0.5">{cred.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              {/* Dual Action Bar: Manual Add vs Excel Import */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    Phương thức Khởi tạo Tài khoản Giáo viên
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ 2 chế độ độc lập: Thêm giáo viên thủ công hoặc Import hàng loạt từ file Excel (.xlsx)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href="#teacher-manual-form"
                    className="px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    + Thêm Giáo viên Thủ công
                  </a>
                  <label className="px-3.5 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold cursor-pointer hover:bg-emerald-700 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Giáo viên từ Excel (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleTeacherExcelFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  id="teacher-manual-form"
                  onSubmit={handleCreateTeacherManual}
                  className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 space-y-4"
                >
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    1. Thêm Giáo viên Thủ công
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Mã GV *</label>
                      <input
                        type="text"
                        required
                        value={teacherManualForm.code}
                        onChange={(e) =>
                          setTeacherManualForm({ ...teacherManualForm, code: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: gv.lan.toan8"
                        value={teacherManualForm.username}
                        onChange={(e) =>
                          setTeacherManualForm({ ...teacherManualForm, username: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nguyễn Thị Hương"
                        value={teacherManualForm.fullName}
                        onChange={(e) =>
                          setTeacherManualForm({ ...teacherManualForm, fullName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="VD: lan.nt@thcsaipath.edu.vn"
                        value={teacherManualForm.email}
                        onChange={(e) =>
                          setTeacherManualForm({ ...teacherManualForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        placeholder="VD: 0912345678"
                        value={teacherManualForm.phone}
                        onChange={(e) =>
                          setTeacherManualForm({ ...teacherManualForm, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Môn dạy</label>
                      <select
                        value={teacherManualForm.subjectCode}
                        onChange={(e) =>
                          setTeacherManualForm({
                            ...teacherManualForm,
                            subjectCode: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        {data.subjects.map((subj) => (
                          <option key={subj.subjectId} value={subj.name}>
                            {subj.name} (Khối {subj.grade})
                          </option>
                        ))}
                        <option value="">-- Để trống (Gán sau) --</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lớp phụ trách</label>
                      <select
                        value={teacherManualForm.className}
                        onChange={(e) =>
                          setTeacherManualForm({
                            ...teacherManualForm,
                            className: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        {classes.map((c) => (
                          <option key={c.classId} value={c.name}>
                            Lớp {c.name}
                          </option>
                        ))}
                        <option value="">-- Chưa gán lớp --</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    + Tạo Tài khoản Giáo viên & Sinh mật khẩu tạm
                  </button>
                </form>

                <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-[#0F172A]">
                        2. Import Giáo viên từ Excel (.xlsx) — Quy tắc 3 trạng thái
                      </h2>
                      <p className="text-xs text-slate-500">
                        Hỗ trợ kiểm tra Hợp lệ (Xanh), Cảnh báo thiếu môn/lớp (Vàng), Lỗi (Đỏ)
                      </p>
                    </div>
                    <button
                      onClick={downloadTeacherImportTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold hover:bg-emerald-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải AI_PATH_Mau_Import_Giao_Vien.xlsx</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      Chọn file Excel (<code className="font-mono">.xlsx</code>) để kiểm tra trước khi lưu (Preview Validation):
                    </div>
                    <label className="px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold cursor-pointer hover:bg-blue-900 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải lên File Excel Giáo viên</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleTeacherExcelFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {importSummaryBanner && (
                    <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 grid grid-cols-3 gap-3 text-center text-xs">
                      <div>
                        <div className="text-slate-600">Tổng giáo viên đã tạo</div>
                        <div className="text-lg font-bold text-blue-900 font-mono-tabular">
                          {importSummaryBanner.totalCreated}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Đã phân công đầy đủ</div>
                        <div className="text-lg font-bold text-emerald-700 font-mono-tabular">
                          {importSummaryBanner.assignedCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-600">Chưa gán lớp / cần kiểm tra</div>
                        <div className="text-lg font-bold text-amber-700 font-mono-tabular">
                          {importSummaryBanner.needsCheckCount}
                        </div>
                      </div>
                    </div>
                  )}

                  {teacherImportPreview && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 font-semibold">
                          <span>Tổng: {teacherImportPreview.validation.totalRows} dòng</span>
                          <span className="text-emerald-700">
                            Hợp lệ: {teacherImportPreview.validation.validCount}
                          </span>
                          <span className="text-amber-700">
                            Cảnh báo: {teacherImportPreview.validation.warningCount}
                          </span>
                          <span className="text-red-700">
                            Lỗi: {teacherImportPreview.validation.errorCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {teacherImportPreview.validation.errorCount > 0 && (
                            <button
                              onClick={() =>
                                downloadErrorRowsExcel(
                                  teacherImportPreview.validation.rows,
                                  'AI_PATH_Danh_Sach_Dong_Loi_Giao_Vien.xlsx'
                                )
                              }
                              className="px-3 py-1 rounded border border-red-300 bg-red-50 text-red-800 text-xs font-semibold"
                            >
                              Xuất dòng lỗi (.xlsx)
                            </button>
                          )}
                          <button
                            onClick={handleCommitTeacherImport}
                            disabled={
                              teacherImportPreview.validation.validCount +
                                teacherImportPreview.validation.warningCount ===
                              0
                            }
                            className="px-3.5 py-1.5 rounded bg-[#16A34A] text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Xác nhận Import (Hợp lệ + Cảnh báo)
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="p-2">Dòng</th>
                              <th className="p-2">Mã GV</th>
                              <th className="p-2">Họ tên</th>
                              <th className="p-2">Username</th>
                              <th className="p-2">Trạng thái</th>
                              <th className="p-2">Chi tiết kiểm tra</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {teacherImportPreview.validation.rows.map((r) => (
                              <tr key={r.rowNumber}>
                                <td className="p-2 font-mono-tabular">{r.rowNumber}</td>
                                <td className="p-2 font-mono-tabular">
                                  {r.rawData['Ma_Giao_Vien'] || ''}
                                </td>
                                <td className="p-2 font-semibold">
                                  {r.rawData['Ho_Va_Ten'] || ''}
                                </td>
                                <td className="p-2 font-mono-tabular">
                                  {r.rawData['Ten_Dang_Nhap'] || ''}
                                </td>
                                <td className="p-2">
                                  {r.status === 'VALID' && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                                      HỢP LỆ
                                    </span>
                                  )}
                                  {r.status === 'WARNING' && (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                      CẢNH BÁO
                                    </span>
                                  )}
                                  {r.status === 'ERROR' && (
                                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 font-bold">
                                      LỖI
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 text-slate-600">{r.messages.join('; ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Danh sách Giáo viên ({teachers.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Quản lý phân công môn dạy, lớp phụ trách và trạng thái tài khoản
                    </p>
                  </div>
                  <button
                    onClick={() => setFilterNeedsAssignment(!filterNeedsAssignment)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      filterNeedsAssignment
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>
                      CHƯA GÁN LỚP / CẦN KIỂM TRA PHÂN CÔNG (
                      {teachers.filter((t) => t.status === 'NEEDS_ASSIGNMENT_CHECK').length})
                    </span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                    <tr>
                      <th className="py-3 px-4">Mã GV</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Username & Liên hệ</th>
                      <th className="py-3 px-4">Môn dạy</th>
                      <th className="py-3 px-4">Lớp phụ trách</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác & Phân công</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {teachers
                      .filter((t) =>
                        !filterNeedsAssignment ? true : t.status === 'NEEDS_ASSIGNMENT_CHECK'
                      )
                      .map((t) => (
                        <tr key={t.userId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono-tabular font-bold">{t.code}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-[#0F172A]">{t.fullName}</div>
                            {(t.dob || t.gender) && (
                              <div className="text-[11px] text-slate-500">
                                {[t.gender, t.dob].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono-tabular text-slate-700 font-semibold">
                              {t.username}
                            </div>
                            {(t.email || t.phone) && (
                              <div className="text-[11px] text-slate-500">
                                {[t.email, t.phone].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium">{t.subjectCode || 'Chưa gán môn'}</td>
                          <td className="py-3 px-4 font-semibold text-blue-700">
                            {t.assignedClassNames?.length
                              ? t.assignedClassNames.join(', ')
                              : t.className || 'Chưa gán lớp'}
                          </td>
                          <td className="py-3 px-4">
                            {t.status === 'INACTIVE' ? (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold border border-red-200">
                                INACTIVE (Đã khóa)
                              </span>
                            ) : t.status === 'NEEDS_ASSIGNMENT_CHECK' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                Cần kiểm tra phân công
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                Đã xác nhận phân công
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditUserModal(t)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100"
                                title="Chỉnh sửa thông tin giáo viên"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Sửa</span>
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateTeacherAssignment(t.userId, 'UPDATE', 'Toán 8', '8A2')
                                }
                                className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                              >
                                Gán Toán 8 - 8A2
                              </button>
                              <button
                                onClick={() => handleUpdateTeacherAssignment(t.userId, 'CONFIRM')}
                                className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                              >
                                Xác nhận
                              </button>
                              <button
                                onClick={() => handleUpdateTeacherAssignment(t.userId, 'UNASSIGN')}
                                className="px-2 py-1 rounded border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100"
                              >
                                Bỏ gán
                              </button>
                              <button
                                onClick={() => handleToggleStatus(t)}
                                className="px-2 py-1 rounded border border-slate-300 font-semibold hover:bg-slate-100"
                              >
                                {t.status === 'INACTIVE' ? 'Kích hoạt' : 'Khóa'}
                              </button>
                              <button
                                onClick={() => setDeletingUser(t)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                                title="Xóa tài khoản giáo viên"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6">
              {/* Dual Action Bar: Manual Add vs Excel Import */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">
                    Phương thức Khởi tạo Tài khoản Học sinh & Gán Lớp
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hỗ trợ 2 chế độ độc lập: Thêm học sinh thủ công hoặc Import học sinh từ file Excel (.xlsx)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href="#student-manual-form"
                    className="px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    + Thêm Học sinh Thủ công
                  </a>
                  <label className="px-3.5 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold cursor-pointer hover:bg-emerald-700 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Học sinh từ Excel (.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleStudentExcelFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4">
                  <form
                    onSubmit={handleCreateClass}
                    className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Quản lý Khối & Tạo Lớp học Mới
                      </h3>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Tổng: {classes.length} lớp
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Khối *</label>
                        <select
                          value={newClassGrade}
                          onChange={(e) => setNewClassGrade(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                            <option key={g} value={g}>
                              Khối {g}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Tên lớp *</label>
                        <input
                          type="text"
                          required
                          placeholder="VD: 8A3"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          GV Phụ trách
                        </label>
                        <select
                          value={newClassTeacherId}
                          onChange={(e) => setNewClassTeacherId(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300"
                        >
                          <option value="">-- Mặc định --</option>
                          {teachers.map((t) => (
                            <option key={t.userId} value={t.userId}>
                              {t.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
                    >
                      + Thêm Khối & Lớp học Mới
                    </button>

                    {/* Danh sách Khối & Lớp hiện có */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-44 overflow-y-auto">
                      {classes.map((cls) => (
                        <div
                          key={cls.classId}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-[#0F172A]">Lớp {cls.name}</span>{' '}
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                              Khối {cls.grade}
                            </span>
                            <div className="text-[11px] text-slate-500">
                              GV: {cls.teacherName} • Sĩ số: {cls.studentCount} HS
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditClassModal(cls)}
                              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(cls)}
                              className="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-[11px] font-semibold"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </form>

                  <form
                    id="student-manual-form"
                    onSubmit={handleCreateStudentManual}
                    className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      Thêm Học sinh Thủ công (Theo Khối & Lớp)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Mã HS *</label>
                        <input
                          type="text"
                          required
                          value={studentManualForm.code}
                          onChange={(e) =>
                            setStudentManualForm({ ...studentManualForm, code: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                        <input
                          type="text"
                          required
                          placeholder="VD: hs.nam.8a2"
                          value={studentManualForm.username}
                          onChange={(e) =>
                            setStudentManualForm({
                              ...studentManualForm,
                              username: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                        <input
                          type="text"
                          required
                          value={studentManualForm.fullName}
                          onChange={(e) =>
                            setStudentManualForm({
                              ...studentManualForm,
                              fullName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Khối *</label>
                        <select
                          value={studentManualForm.grade}
                          onChange={(e) =>
                            setStudentManualForm({
                              ...studentManualForm,
                              grade: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                            <option key={g} value={g}>
                              Khối {g}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Lớp *</label>
                        <select
                          value={studentManualForm.className}
                          onChange={(e) => {
                            const selectedCls = classes.find((c) => c.name === e.target.value);
                            setStudentManualForm({
                              ...studentManualForm,
                              className: e.target.value,
                              grade: selectedCls?.grade || studentManualForm.grade,
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        >
                          {classes.map((c) => (
                            <option key={c.classId} value={c.name}>
                              Lớp {c.name} (Khối {c.grade})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                        <input
                          type="text"
                          value={studentManualForm.dob}
                          onChange={(e) =>
                            setStudentManualForm({ ...studentManualForm, dob: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 px-4 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
                    >
                      + Tạo Tài khoản Học sinh & Gán lớp
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-[#0F172A]">
                        Import Học sinh từ Excel (.xlsx) & Tự động Gán Lớp
                      </h2>
                      <p className="text-xs text-slate-500">
                        Lớp phải tồn tại trước khi import. Tự động ghi nhận vào bảng class_members.
                      </p>
                    </div>
                    <button
                      onClick={downloadStudentImportTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold hover:bg-emerald-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải AI_PATH_Mau_Import_Hoc_Sinh.xlsx</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">
                      Chọn file Excel danh sách học sinh để kiểm tra dữ liệu:
                    </span>
                    <label className="px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold cursor-pointer hover:bg-blue-900 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải lên File Excel Học sinh</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleStudentExcelFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {studentImportPreview && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 font-semibold">
                          <span>Tổng: {studentImportPreview.validation.totalRows}</span>
                          <span className="text-emerald-700">
                            Hợp lệ: {studentImportPreview.validation.validCount}
                          </span>
                          <span className="text-amber-700">
                            Cảnh báo: {studentImportPreview.validation.warningCount}
                          </span>
                          <span className="text-red-700">
                            Lỗi: {studentImportPreview.validation.errorCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {studentImportPreview.validation.errorCount > 0 && (
                            <button
                              onClick={() =>
                                downloadErrorRowsExcel(
                                  studentImportPreview.validation.rows,
                                  'AI_PATH_Danh_Sach_Dong_Loi_Hoc_Sinh.xlsx'
                                )
                              }
                              className="px-3 py-1 rounded border border-red-300 bg-red-50 text-red-800 text-xs font-semibold"
                            >
                              Xuất dòng lỗi (.xlsx)
                            </button>
                          )}
                          <button
                            onClick={handleCommitStudentImport}
                            disabled={
                              studentImportPreview.validation.validCount +
                                studentImportPreview.validation.warningCount ===
                              0
                            }
                            className="px-3.5 py-1.5 rounded bg-[#16A34A] text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Xác nhận Import Học sinh
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="p-2">Dòng</th>
                              <th className="p-2">Mã HS</th>
                              <th className="p-2">Họ tên</th>
                              <th className="p-2">Lớp</th>
                              <th className="p-2">Trạng thái</th>
                              <th className="p-2">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {studentImportPreview.validation.rows.map((r) => (
                              <tr key={r.rowNumber}>
                                <td className="p-2 font-mono-tabular">{r.rowNumber}</td>
                                <td className="p-2 font-mono-tabular">
                                  {r.rawData['Ma_Hoc_Sinh'] || ''}
                                </td>
                                <td className="p-2 font-semibold">
                                  {r.rawData['Ho_Va_Ten'] || ''}
                                </td>
                                <td className="p-2">{r.rawData['Lop'] || ''}</td>
                                <td className="p-2 font-bold">{r.status}</td>
                                <td className="p-2 text-slate-600">{r.messages.join('; ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Danh sách Học sinh Toàn trường ({students.length})
                  </h3>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                    <tr>
                      <th className="py-3 px-4">Mã HS</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">Lớp</th>
                      <th className="py-3 px-4">Ngày sinh</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students.map((s) => (
                      <tr key={s.userId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono-tabular font-bold">{s.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-sm">{s.fullName}</td>
                        <td className="py-2.5 px-4 font-mono-tabular">{s.username}</td>
                        <td className="py-2.5 px-4 font-semibold text-blue-700">
                          {s.className || '8A2'}
                        </td>
                        <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                          {s.dob || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => openEditUserModal(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className="px-2.5 py-1 rounded border border-slate-300 font-semibold hover:bg-slate-100"
                          >
                            {s.status === 'ACTIVE' ? 'Khóa' : 'Kích hoạt'}
                          </button>
                          <button
                            onClick={() => setDeletingUser(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'school' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Thông tin Trường học & Địa chỉ Đơn vị
                    </h2>
                    <p className="text-xs text-slate-500">
                      Chỉnh sửa tên trường, mã đơn vị, địa chỉ chi tiết và thông tin liên hệ
                    </p>
                  </div>
                  {primarySchool && editingSchoolId !== primarySchool.schoolId && (
                    <button
                      onClick={() => openEditSchool(primarySchool)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa Thông tin Trường</span>
                    </button>
                  )}
                </div>

                {data.schools.map((sch) => {
                  const isEditingThis = editingSchoolId === sch.schoolId;
                  return (
                    <div key={sch.schoolId} className="space-y-4">
                      {/* Summary Card */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-base font-bold text-[#0F172A]">{sch.name}</div>
                            <div className="text-slate-500 mt-0.5">
                              Mã trường: <strong className="font-mono-tabular text-slate-800">{sch.code}</strong> • Tenant ID:{' '}
                              <code className="font-mono font-bold text-blue-700">{sch.schoolId}</code>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                              sch.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sch.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-slate-700">
                          <div>
                            <span className="text-slate-500">Địa chỉ:</span>{' '}
                            <strong className="text-[#0F172A]">{sch.address || 'Chưa cập nhật'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Tỉnh / Thành phố:</span>{' '}
                            <strong className="text-[#0F172A]">{sch.provinceCity || 'Hà Nội'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Hiệu trưởng / Phụ trách:</span>{' '}
                            <strong className="text-[#0F172A]">{sch.principalName || 'Chưa cập nhật'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Điện thoại / Email:</span>{' '}
                            <strong className="text-[#0F172A]">
                              {[sch.phone, sch.email].filter(Boolean).join(' • ') || 'Chưa cập nhật'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Edit Form (Always visible when editing or can be toggled) */}
                      <form
                        onSubmit={(e) => handleSaveSchool(e, sch.schoolId)}
                        className="p-5 rounded-xl border border-blue-200 bg-blue-50/30 space-y-4 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-[#1E3A8A] flex items-center gap-1.5">
                            <Edit3 className="w-4 h-4 text-[#2563EB]" />
                            <span>Biểu mẫu Chỉnh sửa Thông tin Trường học & Địa chỉ</span>
                          </div>
                          {!isEditingThis && (
                            <button
                              type="button"
                              onClick={() => openEditSchool(sch)}
                              className="text-xs font-semibold text-[#2563EB] underline"
                            >
                              Nạp dữ liệu hiện tại
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1">
                              Tên Trường học *
                            </label>
                            <input
                              type="text"
                              required
                              value={schoolForm.name}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, name: e.target.value })
                              }
                              placeholder="VD: Trường THCS Thực Nghiệm AI PATH"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-[#0F172A]"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Mã Trường *
                            </label>
                            <input
                              type="text"
                              required
                              value={schoolForm.code}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, code: e.target.value })
                              }
                              placeholder="VD: THCS_AIPATH"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1">
                              Địa chỉ Trường học (Số nhà, Đường, Phường/Xã, Quận/Huyện) *
                            </label>
                            <input
                              type="text"
                              value={schoolForm.address}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, address: e.target.value })
                              }
                              placeholder="VD: Số 128 Nguyễn Phong Sắc, Quận Cầu Giấy, Hà Nội"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Tỉnh / Thành phố
                            </label>
                            <input
                              type="text"
                              value={schoolForm.provinceCity}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, provinceCity: e.target.value })
                              }
                              placeholder="VD: Hà Nội"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Hiệu trưởng / Người đại diện
                            </label>
                            <input
                              type="text"
                              value={schoolForm.principalName}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, principalName: e.target.value })
                              }
                              placeholder="VD: TS. Nguyễn Văn Minh"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Số điện thoại liên hệ
                            </label>
                            <input
                              type="text"
                              value={schoolForm.phone}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, phone: e.target.value })
                              }
                              placeholder="VD: 024 3756 8899"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Email Nhà trường
                            </label>
                            <input
                              type="email"
                              value={schoolForm.email}
                              onChange={(e) =>
                                setSchoolForm({ ...schoolForm, email: e.target.value })
                              }
                              placeholder="VD: vanphong@thcsaipath.edu.vn"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">Trạng thái:</span>
                            <select
                              value={schoolForm.status}
                              onChange={(e) =>
                                setSchoolForm({
                                  ...schoolForm,
                                  status: e.target.value as 'ACTIVE' | 'INACTIVE',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                            >
                              <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                              <option value="INACTIVE">INACTIVE (Tạm ngưng)</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={savingSchool}
                            className="px-5 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingSchool ? 'Đang lưu...' : 'Lưu Thông tin Trường & Địa chỉ'}
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Quản lý Năm học</h2>
                  <p className="text-xs text-slate-500">
                    Thêm năm học mới hoặc chọn năm học hiện hành cho toàn trường
                  </p>
                </div>
                <div className="space-y-2">
                  {data.academicYears.map((ay) => (
                    <div
                      key={ay.academicYearId}
                      className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-[#0F172A]">{ay.name}</span>
                        <div className="text-[11px] text-slate-500 font-mono-tabular">
                          ID: {ay.academicYearId}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ay.isCurrent ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                            Năm học hiện hành
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              await apiClient.updateAcademicYear(ay.academicYearId, {
                                isCurrent: true,
                              });
                              await onRefresh();
                              setBanner({
                                type: 'success',
                                text: `Đã đặt năm học ${ay.name} làm năm học hiện hành.`,
                              });
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
                          >
                            Đặt làm hiện hành
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                    placeholder="VD: 2027 - 2028"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (!newYearName.trim()) return;
                      await apiClient.createAcademicYear(newYearName, false);
                      await onRefresh();
                      setBanner({
                        type: 'success',
                        text: `Đã thêm năm học ${newYearName}.`,
                      });
                    }}
                    className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    + Thêm Năm học
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'curriculum' && (
            <div className="space-y-6">
              {/* 1. QUẢN LÝ MÔN HỌC & CHỦ ĐỀ MÔN HỌC THEO KHỐI */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Quản lý Môn học */}
                <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Quản lý Môn học theo Khối ({data.subjects.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Thêm mới hoặc chỉnh sửa thông tin Môn học & Khối lớp
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveSubject}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E3A8A]">
                        {editingSubjectId ? 'Chỉnh sửa Môn học' : '+ Thêm Môn học Mới'}
                      </span>
                      {editingSubjectId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubjectId(null);
                            setSubjectForm({ code: '', name: '', grade: 8, description: '' });
                          }}
                          className="text-slate-500 underline"
                        >
                          Hủy sửa
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Mã môn *</label>
                        <input
                          type="text"
                          required
                          placeholder="VD: TOAN_9"
                          value={subjectForm.code}
                          onChange={(e) =>
                            setSubjectForm({ ...subjectForm, code: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Tên môn *</label>
                        <input
                          type="text"
                          required
                          placeholder="VD: Toán 9"
                          value={subjectForm.name}
                          onChange={(e) =>
                            setSubjectForm({ ...subjectForm, name: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Khối *</label>
                        <select
                          value={subjectForm.grade}
                          onChange={(e) =>
                            setSubjectForm({ ...subjectForm, grade: Number(e.target.value) })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                            <option key={g} value={g}>
                              Khối {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Mô tả chương trình môn học
                      </label>
                      <input
                        type="text"
                        placeholder="VD: Chương trình GDPT 2018 — Đại số & Hình học"
                        value={subjectForm.description}
                        onChange={(e) =>
                          setSubjectForm({ ...subjectForm, description: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 px-4 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
                    >
                      {editingSubjectId ? 'Lưu Cập nhật Môn học' : '+ Thêm Môn học'}
                    </button>
                  </form>

                  <div className="space-y-2">
                    {data.subjects.map((subj) => (
                      <div
                        key={subj.subjectId}
                        className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#0F172A]">{subj.name}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono-tabular font-bold">
                              {subj.code}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              Khối {subj.grade}
                            </span>
                          </div>
                          {subj.description && (
                            <div className="text-slate-500 mt-1">{subj.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditSubject(subj)}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold hover:bg-slate-100"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(subj)}
                            className="px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quản lý Chủ đề Môn học */}
                <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">
                        Quản lý Chủ đề Môn học ({data.topics.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Cấu hình các Chủ đề học tập theo từng Môn học và Khối lớp
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveTopic}
                    className="p-4 rounded-xl bg-blue-50/30 border border-blue-200 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E3A8A]">
                        {editingTopicId ? 'Chỉnh sửa Chủ đề Môn học' : '+ Thêm Chủ đề Môn học Mới'}
                      </span>
                      {editingTopicId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTopicId(null);
                            setTopicForm({
                              code: '',
                              name: '',
                              subjectCode: data.subjects[0]?.code || 'TOAN_8',
                              grade: 8,
                              description: '',
                              knowledgeSummary: '',
                            });
                          }}
                          className="text-slate-500 underline"
                        >
                          Hủy sửa
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Mã chủ đề *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: HANG_DANG_THUC"
                          value={topicForm.code}
                          onChange={(e) => setTopicForm({ ...topicForm, code: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono-tabular"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Tên chủ đề môn học *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: Bảy hằng đẳng thức đáng nhớ"
                          value={topicForm.name}
                          onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Khối *</label>
                        <select
                          value={topicForm.grade}
                          onChange={(e) =>
                            setTopicForm({ ...topicForm, grade: Number(e.target.value) })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                            <option key={g} value={g}>
                              Khối {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Thuộc Môn học *
                        </label>
                        <select
                          value={topicForm.subjectCode}
                          onChange={(e) => {
                            const matchedSubj = data.subjects.find(
                              (s) => s.code === e.target.value
                            );
                            setTopicForm({
                              ...topicForm,
                              subjectCode: e.target.value,
                              grade: matchedSubj?.grade || topicForm.grade,
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          {data.subjects.map((subj) => (
                            <option key={subj.subjectId} value={subj.code}>
                              {subj.name} ({subj.code} • Khối {subj.grade})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Mô tả chuẩn kiến thức kỹ năng của chủ đề
                        </label>
                        <input
                          type="text"
                          placeholder="VD: Nhận dạng, khai triển và vận dụng hằng đẳng thức..."
                          value={topicForm.description}
                          onChange={(e) =>
                            setTopicForm({ ...topicForm, description: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tóm tắt Trọng tâm Kiến thức của Chủ đề (Knowledge Summary)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="VD: Trọng tâm lý thuyết, công thức cốt lõi và các quy tắc biến đổi cần nhớ..."
                        value={topicForm.knowledgeSummary}
                        onChange={(e) =>
                          setTopicForm({ ...topicForm, knowledgeSummary: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
                    >
                      {editingTopicId ? 'Lưu Cập nhật Chủ đề' : '+ Thêm Chủ đề Môn học'}
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    {data.topics.map((tp) => {
                      const parentSubj = data.subjects.find((s) => s.code === tp.subjectCode);
                      const kCount = (tp.knowledgeItems || []).length;
                      return (
                        <div
                          key={tp.topicId}
                          className="p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-[#0F172A]">{tp.name}</span>
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono-tabular font-bold">
                                {tp.code}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
                                Môn: {parentSubj?.name || tp.subjectCode}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                Khối {tp.grade}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                                {kCount} đơn vị kiến thức
                              </span>
                            </div>
                            {tp.description && (
                              <div className="text-slate-600">{tp.description}</div>
                            )}
                            {tp.knowledgeSummary && (
                              <div className="text-[11px] text-blue-900 bg-blue-50/70 px-2.5 py-1 rounded border border-blue-100">
                                <strong>Trọng tâm kiến thức:</strong> {tp.knowledgeSummary}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setActiveKnowledgeTopicId(tp.topicId);
                                setEditingKnowledgeId(null);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Tải lên Kiến thức ({kCount})</span>
                            </button>
                            <button
                              onClick={() => openEditTopic(tp)}
                              className="px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold hover:bg-slate-100"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteTopic(tp)}
                              className="px-2.5 py-1.5 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1B. KHO KIẾN THỨC & TÀI LIỆU CỦA CHỦ ĐỀ MÔN HỌC (UPLOAD & QUẢN LÝ TRỰC TIẾP) */}
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
                      Bổ sung Lý thuyết cốt lõi, Công thức & Quy tắc, Ví dụ giải mẫu hoặc tải lên File tài liệu (.txt, .md, .pdf, .docx, .xlsx) cho từng Chủ đề môn học
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Chọn Chủ đề:
                    </label>
                    <select
                      value={activeKnowledgeTopicId}
                      onChange={(e) => {
                        setActiveKnowledgeTopicId(e.target.value);
                        setEditingKnowledgeId(null);
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
                    data.topics.find((t) => t.topicId === activeKnowledgeTopicId) || data.topics[0];
                  if (!selectedTopic) return null;
                  const items = selectedTopic.knowledgeItems || [];

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Form Tải lên Kiến thức Chủ đề */}
                      <form
                        onSubmit={handleSaveTopicKnowledge}
                        className="lg:col-span-5 p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3.5 text-xs self-start"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#1E3A8A] flex items-center gap-1.5">
                            <Upload className="w-4 h-4 text-[#2563EB]" />
                            <span>
                              {editingKnowledgeId
                                ? 'Chỉnh sửa Đơn vị Kiến thức'
                                : `Tải lên Kiến thức cho: ${selectedTopic.name}`}
                            </span>
                          </span>
                          {editingKnowledgeId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKnowledgeId(null);
                                setKnowledgeForm({
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
                            placeholder="VD: 1. Lý thuyết & Quy tắc Đặt nhân tử chung"
                            value={knowledgeForm.title}
                            onChange={(e) =>
                              setKnowledgeForm({ ...knowledgeForm, title: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-[#0F172A]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Phân loại Kiến thức *
                          </label>
                          <select
                            value={knowledgeForm.knowledgeType}
                            onChange={(e) =>
                              setKnowledgeForm({
                                ...knowledgeForm,
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
                            Tải lên File Kiến thức từ máy tính (Tùy chọn: .txt, .md, .pdf, .docx, .xlsx)
                          </label>
                          <input
                            type="file"
                            accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            onChange={handleKnowledgeFileChange}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {knowledgeForm.fileName && (
                            <div className="flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded border border-emerald-200">
                              <span>
                                Đã đính kèm: <strong>{knowledgeForm.fileName}</strong>{' '}
                                {knowledgeForm.fileSize
                                  ? `(${Math.max(1, Math.round(knowledgeForm.fileSize / 1024))} KB)`
                                  : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setKnowledgeForm({
                                    ...knowledgeForm,
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
                            required={!knowledgeForm.fileDataUrl}
                            placeholder="Nhập nội dung lý thuyết, các công thức toán học, quy tắc dấu, phương pháp phân tích đa thức hoặc nội dung trích xuất từ tài liệu..."
                            value={knowledgeForm.contentText}
                            onChange={(e) =>
                              setKnowledgeForm({ ...knowledgeForm, contentText: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white leading-relaxed"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingKnowledge}
                          className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Upload className="w-4 h-4" />
                          <span>
                            {savingKnowledge
                              ? 'Đang lưu kiến thức...'
                              : editingKnowledgeId
                              ? 'Lưu Cập nhật Đơn vị Kiến thức'
                              : 'Tải lên Kiến thức vào Chủ đề'}
                          </span>
                        </button>
                      </form>

                      {/* Danh sách Kiến thức đã tải lên của Chủ đề */}
                      <div className="lg:col-span-7 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#0F172A]">
                            Danh mục Kiến thức đã tải lên của "{selectedTopic.name}" ({items.length})
                          </h3>
                          <span className="text-xs text-slate-500">
                            Mã chủ đề: <strong className="font-mono-tabular">{selectedTopic.code}</strong>
                          </span>
                        </div>

                        {items.length === 0 ? (
                          <div className="p-8 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                            Chủ đề này chưa có đơn vị kiến thức nào. Hãy sử dụng biểu mẫu bên trái để tải lên Lý thuyết, Công thức hoặc Tài liệu đính kèm.
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
                                        openEditKnowledgeItem(selectedTopic.topicId, item)
                                      }
                                      className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold hover:bg-slate-100"
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteKnowledgeItem(selectedTopic.topicId, item)
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

              {/* 2. BẢNG TỔNG HỢP KHỐI & LỚP HỌC TOÀN TRƯỜNG */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Danh sách Khối & Lớp học trong Trường ({classes.length} lớp)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Quản lý thông tin Khối, Tên lớp, Giáo viên phụ trách và Sĩ số học sinh
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {classes.map((cls) => (
                    <div
                      key={cls.classId}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">Lớp {cls.name}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            Khối {cls.grade}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          GV phụ trách: <strong>{cls.teacherName}</strong>
                        </div>
                        <div className="text-slate-500 font-mono-tabular">
                          Sĩ số: {cls.studentCount} học sinh
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => openEditClassModal(cls)}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold hover:bg-slate-100"
                        >
                          Sửa Khối/Lớp
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls)}
                          className="px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100"
                        >
                          Xóa lớp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Khung 5 Năng lực Toán 8 — Chủ đề: Phân tích đa thức thành nhân tử
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {data.competencies.map((comp) => (
                    <div
                      key={comp.competencyId}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                    >
                      <span className="text-[11px] font-mono-tabular font-bold text-blue-700">
                        {comp.code}
                      </span>
                      <div className="font-bold text-sm text-[#0F172A]">{comp.name}</div>
                      <p className="text-xs text-slate-600">{comp.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Từ điển Nhãn Lỗi sai Chuẩn hóa (Error Taxonomy)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.errorTypes.map((et) => (
                    <div
                      key={et.errorTypeId}
                      className="p-3 rounded-lg bg-red-50/40 border border-red-200 text-xs space-y-1"
                    >
                      <div className="font-mono-tabular font-bold text-red-900">{et.code}</div>
                      <div className="font-semibold text-slate-900">{et.name}</div>
                      <div className="text-slate-600">{et.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Nhật ký Gọi Gemini AI (ai_runs: {(data.aiRuns || []).length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto text-xs">
                  {(data.aiRuns || []).map((run) => (
                    <div key={run.runId} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-900">{run.taskType}</span>
                        <span className="font-mono-tabular text-slate-500">
                          {run.model} • {run.latencyMs}ms
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Prompt version: {run.promptVersion} • Thành công: {run.success ? 'Có' : 'Fallback'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular">
                        {new Date(run.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Nhật ký Kiểm toán Bảo mật (audit_logs: {(data.auditLogs || []).length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto text-xs">
                  {(data.auditLogs || []).map((log) => (
                    <div key={log.logId} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-mono-tabular font-bold text-slate-800">
                          {log.action}
                        </span>
                        <span className="text-slate-500 font-mono-tabular">
                          {new Date(log.timestamp).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="text-slate-800 font-medium">{log.details}</div>
                      <div className="text-[11px] text-slate-500">
                        Actor: {log.actorName} ({log.actorRole})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Chỉnh sửa Giáo viên / Học sinh */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Chỉnh sửa {editingUser.role === Role.TEACHER ? 'Giáo viên' : 'Học sinh'}
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật thông tin hồ sơ, lớp học hoặc đặt lại mật khẩu
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingUser.role === Role.TEACHER ? 'Mã Giáo viên *' : 'Mã Học sinh *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
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
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium"
                />
              </div>

              {editingUser.role === Role.TEACHER ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Môn giảng dạy</label>
                      <select
                        value={editForm.subjectCode}
                        onChange={(e) => setEditForm({ ...editForm, subjectCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        {data.subjects.map((subj) => (
                          <option key={subj.subjectId} value={subj.name}>
                            {subj.name} (Khối {subj.grade})
                          </option>
                        ))}
                        <option value="">-- Chưa gán môn --</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lớp phụ trách</label>
                      <select
                        value={editForm.className}
                        onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        {classes.map((c) => (
                          <option key={c.classId} value={c.name}>
                            Lớp {c.name} (Khối {c.grade})
                          </option>
                        ))}
                        <option value="">-- Chưa gán lớp --</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="VD: lan.nt@thcsaipath.edu.vn"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
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
                        value={editForm.dob}
                        onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Nữ">Nữ</option>
                        <option value="Nam">Nam</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lớp & Khối *</label>
                      <select
                        value={editForm.className}
                        onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        {classes.map((c) => (
                          <option key={c.classId} value={c.name}>
                            Lớp {c.name} (Khối {c.grade})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                      <input
                        type="text"
                        value={editForm.dob}
                        onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
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
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trạng thái tài khoản</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'NEEDS_ASSIGNMENT_CHECK',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                    <option value="INACTIVE">INACTIVE (Đã khóa)</option>
                    {editingUser.role === Role.TEACHER && (
                      <option value="NEEDS_ASSIGNMENT_CHECK">
                        NEEDS_ASSIGNMENT_CHECK (Cần kiểm tra phân công)
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đặt mật khẩu mới (Để trống nếu giữ nguyên)
                  </label>
                  <input
                    type="text"
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Đang lưu...' : 'Lưu Thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa Giáo viên / Học sinh */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-red-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Xác nhận xóa {deletingUser.role === Role.TEACHER ? 'Giáo viên' : 'Học sinh'}
                </h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-slate-800 space-y-1">
              <div>
                Họ và tên: <strong className="text-[#0F172A]">{deletingUser.fullName}</strong>
              </div>
              <div>
                Mã định danh: <strong className="font-mono-tabular">{deletingUser.code}</strong> •
                Username: <strong className="font-mono-tabular">{deletingUser.username}</strong>
              </div>
              {deletingUser.role === Role.STUDENT && (
                <div className="text-red-800 pt-1">
                  Lưu ý: Toàn bộ hồ sơ năng lực, lộ trình và lịch sử làm bài của học sinh này cũng sẽ được xóa khỏi lớp.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={deletingLoading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={deletingLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deletingLoading ? 'Đang xóa...' : 'Xác nhận Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa Khối & Lớp học */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Chỉnh sửa Khối & Lớp học
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật Khối lớp, Tên lớp và Giáo viên phụ trách
                </p>
              </div>
              <button
                onClick={() => setEditingClass(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEditClass} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp *</label>
                  <select
                    value={editClassForm.grade}
                    onChange={(e) =>
                      setEditClassForm({ ...editClassForm, grade: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên lớp học *</label>
                  <input
                    type="text"
                    required
                    value={editClassForm.name}
                    onChange={(e) =>
                      setEditClassForm({ ...editClassForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Giáo viên phụ trách lớp
                </label>
                <select
                  value={editClassForm.teacherId}
                  onChange={(e) =>
                    setEditClassForm({ ...editClassForm, teacherId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  {teachers.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.fullName} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white font-semibold hover:bg-blue-700"
                >
                  Lưu Cập nhật Khối & Lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
