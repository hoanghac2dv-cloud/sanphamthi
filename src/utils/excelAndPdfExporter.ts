import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CompetencyCode,
  Experiment,
  ExperimentCaseStudy,
  ExperimentStudentMetric,
  FeedbackResponseRecord,
} from '../types';

/**
 * 21. TẢI FILE MẪU GIÁO VIÊN: AI_PATH_Mau_Import_Giao_Vien.xlsx
 * Columns: STT, Ma_Giao_Vien, Ho_Va_Ten, Ten_Dang_Nhap, Email, So_Dien_Thoai, Mon_Giang_Day, Lop_Phu_Trach, Trang_Thai
 */
export function downloadTeacherExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Huong_Dan
  const guideRows = [
    { Muc: '1. Quy định chung', Noi_Dung: 'Chỉ sử dụng định dạng chuẩn .xlsx. Không đổi tên cột ở sheet Nhap_Giao_Vien.' },
    { Muc: '2. Cột bắt buộc', Noi_Dung: 'Ma_Giao_Vien, Ho_Va_Ten, Ten_Dang_Nhap là bắt buộc và không được trùng lặp.' },
    { Muc: '3. Phân công chuyên môn', Noi_Dung: 'Mon_Giang_Day và Lop_Phu_Trach có thể điền ngay hoặc để trống (Hệ thống sẽ gắn nhãn CẢNH BÁO: Cần kiểm tra phân công để Admin gán sau).' },
    { Muc: '4. Mật khẩu tạm', Noi_Dung: 'Hệ thống tự động sinh mật khẩu tạm băm PBKDF2-SHA256 và chỉ hiển thị 1 lần sau khi xác nhận Import.' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'Huong_Dan');

  // Sheet 2: Nhap_Giao_Vien
  const sampleRows = [
    {
      STT: 1,
      Ma_Giao_Vien: 'GV101',
      Ho_Va_Ten: 'Lê Thị Mai Hương',
      Ten_Dang_Nhap: 'huongltm',
      Email: 'huong.ltm@thcsaipath.edu.vn',
      So_Dien_Thoai: '0912345101',
      Mon_Giang_Day: 'Toán 8',
      Lop_Phu_Trach: '8A2',
      Trang_Thai: 'ACTIVE',
    },
    {
      STT: 2,
      Ma_Giao_Vien: 'GV102',
      Ho_Va_Ten: 'Phạm Minh Tuấn',
      Ten_Dang_Nhap: 'tuanpm',
      Email: 'tuan.pm@thcsaipath.edu.vn',
      So_Dien_Thoai: '0912345102',
      Mon_Giang_Day: 'Toán 8',
      Lop_Phu_Trach: '8A1',
      Trang_Thai: 'ACTIVE',
    },
    {
      STT: 3,
      Ma_Giao_Vien: 'GV103',
      Ho_Va_Ten: 'Đỗ Hoàng Yến',
      Ten_Dang_Nhap: 'yendh',
      Email: 'yen.dh@thcsaipath.edu.vn',
      So_Dien_Thoai: '0912345103',
      Mon_Giang_Day: 'Toán 8',
      Lop_Phu_Trach: '',
      Trang_Thai: 'ACTIVE',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Nhap_Giao_Vien');

  // Sheet 3: Danh_Muc_Chuan
  const catalogRows = [
    { Loai_Danh_Muc: 'Môn giảng dạy', Ma_Chuan: 'Toán 8', Mo_Ta: 'Môn Toán khối 8 - Chủ đề Phân tích đa thức thành nhân tử' },
    { Loai_Danh_Muc: 'Lớp hiện có', Ma_Chuan: '8A1', Mo_Ta: 'Lớp 8A1 - Khối 8' },
    { Loai_Danh_Muc: 'Lớp hiện có', Ma_Chuan: '8A2', Mo_Ta: 'Lớp 8A2 - Lớp thực nghiệm AI PATH' },
    { Loai_Danh_Muc: 'Trạng thái', Ma_Chuan: 'ACTIVE', Mo_Ta: 'Tài khoản hoạt động' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalogRows), 'Danh_Muc_Chuan');

  // Sheet 4: Vi_Du
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Vi_Du');

  XLSX.writeFile(wb, 'AI_PATH_Mau_Import_Giao_Vien.xlsx');
}

/**
 * 25. TẢI FILE MẪU HỌC SINH: AI_PATH_Mau_Import_Hoc_Sinh.xlsx (4 Sheets)
 * Columns: STT, Ma_Hoc_Sinh, Ho_Va_Ten, Ten_Dang_Nhap, Ngay_Sinh, Gioi_Tinh, Lop, Khoi, Nam_Hoc, Email, Trang_Thai
 */
export function downloadStudentExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Huong_Dan
  const guideRows = [
    { Muc: '1. Quy định chung', Noi_Dung: 'Chỉ sử dụng định dạng chuẩn .xlsx. Điền danh sách học sinh vào sheet Nhap_Hoc_Sinh.' },
    { Muc: '2. Điều kiện Lớp học', Noi_Dung: 'Cột Lop (ví dụ: 8A2) phải tồn tại trong hệ thống trước khi import để hệ thống tự động gán vào class_members.' },
    { Muc: '3. Cột bắt buộc', Noi_Dung: 'Ma_Hoc_Sinh, Ho_Va_Ten, Ten_Dang_Nhap, Lop là bắt buộc.' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'Huong_Dan');

  // Sheet 2: Nhap_Hoc_Sinh
  const sampleRows = [
    {
      STT: 1,
      Ma_Hoc_Sinh: 'HS8A2_37',
      Ho_Va_Ten: 'Nguyễn Gia Huy',
      Ten_Dang_Nhap: 'huyng8a2',
      Ngay_Sinh: '2012-05-14',
      Gioi_Tinh: 'Nam',
      Lop: '8A2',
      Khoi: '8',
      Nam_Hoc: '2025-2026',
      Email: 'huy.ng@hs.aipath.edu.vn',
      Trang_Thai: 'ACTIVE',
    },
    {
      STT: 2,
      Ma_Hoc_Sinh: 'HS8A2_38',
      Ho_Va_Ten: 'Trần Khánh Ngọc',
      Ten_Dang_Nhap: 'ngoctk8a2',
      Ngay_Sinh: '2012-08-22',
      Gioi_Tinh: 'Nữ',
      Lop: '8A2',
      Khoi: '8',
      Nam_Hoc: '2025-2026',
      Email: 'ngoc.tk@hs.aipath.edu.vn',
      Trang_Thai: 'ACTIVE',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Nhap_Hoc_Sinh');

  // Sheet 3: Danh_Muc_Chuan
  const catalogRows = [
    { Loai_Danh_Muc: 'Lớp học', Ma_Chuan: '8A2', Mo_Ta: 'Lớp 8A2 (Khối 8)' },
    { Loai_Danh_Muc: 'Lớp học', Ma_Chuan: '8A1', Mo_Ta: 'Lớp 8A1 (Khối 8)' },
    { Loai_Danh_Muc: 'Giới tính', Ma_Chuan: 'Nam / Nữ', Mo_Ta: 'Giới tính học sinh' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalogRows), 'Danh_Muc_Chuan');

  // Sheet 4: Vi_Du
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Vi_Du');

  XLSX.writeFile(wb, 'AI_PATH_Mau_Import_Hoc_Sinh.xlsx');
}

/**
 * 27. PARSE .XLSX FILE
 */
export async function parseExcelFileToJson(
  file: File,
  preferredSheet?: string
): Promise<Record<string, unknown>[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Hệ thống chỉ hỗ trợ định dạng chuẩn .xlsx');
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const targetSheetName =
    (preferredSheet && wb.SheetNames.includes(preferredSheet) ? preferredSheet : undefined) ||
    wb.SheetNames.find((n) => n === 'Nhap_Giao_Vien' || n === 'Nhap_Hoc_Sinh' || n === 'Mau_Giao_Vien' || n === 'Mau_Hoc_Sinh') ||
    wb.SheetNames[0];
  if (!targetSheetName) {
    throw new Error('File Excel không có sheet dữ liệu.');
  }
  const sheet = wb.Sheets[targetSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

export const downloadTeacherImportTemplate = downloadTeacherExcelTemplate;
export const downloadStudentImportTemplate = downloadStudentExcelTemplate;
export const parseExcelUpload = parseExcelFileToJson;

export function downloadErrorRowsExcel(
  rows: { rowNumber: number; rawData: Record<string, string>; status: string; messages: string[] }[],
  fileName: string
): void {
  const errorRows = rows
    .filter((r) => r.status === 'ERROR')
    .map((r) => ({
      Dong_So: r.rowNumber,
      ...r.rawData,
      Trang_Thai: r.status,
      Chi_Tiet_Loi: r.messages.join('; '),
    }));
  const ws = XLSX.utils.json_to_sheet(errorRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Dong_Loi');
  XLSX.writeFile(wb, fileName);
}

/**
 * 75. REPORT EXPORT - XUẤT EXCEL (10 Sheets)
 * Overview, Students, PreTest, PostTest, Competencies, PATH5, Errors, Feedback_Students, Feedback_Teachers, CaseStudies
 */
export function exportExperimentToExcel(params: {
  experiment: Experiment;
  metrics: ExperimentStudentMetric[];
  feedbacks: FeedbackResponseRecord[];
  caseStudies: ExperimentCaseStudy[];
  teacherApprovalStats: { approvedPct: number; modifiedPct: number; rejectedPct: number };
}): void {
  const { experiment, teacherApprovalStats } = params;
  const metrics = params.metrics.filter(
    (m) => m.experimentId === experiment.experimentId && m.dataSource === experiment.dataSource
  );
  const feedbacks = params.feedbacks.filter(
    (f) => f.experimentId === experiment.experimentId && f.dataSource === experiment.dataSource
  );
  const caseStudies = params.caseStudies.filter(
    (c) => c.experimentId === experiment.experimentId && c.dataSource === experiment.dataSource
  );
  const preSubmittedMetrics = metrics.filter((m) => m.preScore !== null);
  const completedMetrics = metrics.filter(
    (m) => m.status === 'COMPLETED' && m.preScore !== null && m.postScore !== null
  );
  const preMean =
    preSubmittedMetrics.length > 0
      ? Math.round(
          (preSubmittedMetrics.reduce((s, m) => s + (m.preScore || 0), 0) /
            preSubmittedMetrics.length) *
            10
        ) / 10
      : null;
  const pairedPreMean =
    completedMetrics.length > 0
      ? Math.round(
          (completedMetrics.reduce((s, m) => s + (m.preScore || 0), 0) /
            completedMetrics.length) *
            10
        ) / 10
      : null;
  const postMean =
    completedMetrics.length > 0
      ? Math.round(
          (completedMetrics.reduce((s, m) => s + (m.postScore || 0), 0) /
            completedMetrics.length) *
            10
        ) / 10
      : null;
  const absGain =
    pairedPreMean !== null && postMean !== null
      ? Math.round((postMean - pairedPreMean) * 10) / 10
      : 'N/A';

  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overviewRows = [
    { Chi_Tieu: 'Mã đợt thực nghiệm (experimentId)', Gia_Tri: experiment.experimentId },
    { Chi_Tieu: 'Tên đợt thực nghiệm', Gia_Tri: experiment.title },
    { Chi_Tieu: 'Nguồn dữ liệu (dataSource)', Gia_Tri: experiment.dataSource },
    { Chi_Tieu: 'Trạng thái thực nghiệm', Gia_Tri: experiment.state },
    { Chi_Tieu: 'Lớp thực nghiệm', Gia_Tri: experiment.className },
    { Chi_Tieu: 'Chủ đề', Gia_Tri: 'Phân tích đa thức thành nhân tử (FACTORING_POLYNOMIAL)' },
    { Chi_Tieu: 'Độ tương đương Pre/Post', Gia_Tri: `${experiment.equivalenceScore}%` },
    { Chi_Tieu: 'Số học sinh bắt đầu (Pre-test)', Gia_Tri: preSubmittedMetrics.length },
    { Chi_Tieu: 'Số học sinh hoàn thành đầy đủ (Pre & Post)', Gia_Tri: completedMetrics.length },
    {
      Chi_Tieu: 'Số học sinh không hoàn thành (INCOMPLETE)',
      Gia_Tri: metrics.filter((m) => m.status === 'INCOMPLETE').length,
    },
    { Chi_Tieu: 'Điểm trung bình Pre-test (Pre Mean)', Gia_Tri: preMean ?? 'N/A' },
    { Chi_Tieu: 'Điểm trung bình Post-test (Post Mean)', Gia_Tri: postMean ?? 'N/A' },
    { Chi_Tieu: 'Mức tăng tuyệt đối (Absolute Gain)', Gia_Tri: absGain },
    { Chi_Tieu: 'Tỷ lệ GV Duyệt nguyên bản (Approved unchanged)', Gia_Tri: `${teacherApprovalStats.approvedPct}%` },
    { Chi_Tieu: 'Tỷ lệ GV Chỉnh sửa (Modified)', Gia_Tri: `${teacherApprovalStats.modifiedPct}%` },
    { Chi_Tieu: 'Tỷ lệ GV Từ chối (Rejected)', Gia_Tri: `${teacherApprovalStats.rejectedPct}%` },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overviewRows), 'Overview');

  // Sheet 2: Students
  const studentsRows = metrics.map((m, idx) => ({
    STT: idx + 1,
    Ma_HS: m.studentCode,
    Ho_Va_Ten: m.studentName,
    Trang_Thai_Du_Lieu: m.status,
    Diem_Pre: m.preScore ?? 'N/A',
    Diem_Post: m.postScore ?? 'INCOMPLETE',
    Absolute_Gain: m.absoluteGain ?? 'N/A',
    Normalized_Gain: m.normalizedGain ?? 'N/A',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsRows), 'Students');

  // Sheet 3: PreTest (Baseline from Attempts)
  const preRows = metrics.map((m) => ({
    Ma_HS: m.studentCode,
    Ho_Va_Ten: m.studentName,
    Baseline_Attempt_ID: m.baseline?.attemptId || m.preAttemptId || 'N/A',
    Baseline_Submitted_At: m.baseline?.submittedAt || m.preSubmittedAt || 'N/A',
    Tong_Pre: m.preScore ?? 'N/A',
    So_Loi_Pre: m.preErrorCount,
    FOUNDATION_Pre: m.competencyPre?.[CompetencyCode.FOUNDATION] ?? 'N/A',
    RECOGNITION_Pre: m.competencyPre?.[CompetencyCode.RECOGNITION] ?? 'N/A',
    TRANSFORMATION_Pre: m.competencyPre?.[CompetencyCode.TRANSFORMATION] ?? 'N/A',
    CALC_ACCURACY_Pre: m.competencyPre?.[CompetencyCode.CALC_ACCURACY] ?? 'N/A',
    APPLICATION_Pre: m.competencyPre?.[CompetencyCode.APPLICATION] ?? 'N/A',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(preRows), 'PreTest');

  // Sheet 4: PostTest (Outcome from Attempts)
  const postRows = metrics.map((m) => ({
    Ma_HS: m.studentCode,
    Ho_Va_Ten: m.studentName,
    Trang_Thai: m.status,
    Outcome_Attempt_ID: m.outcome?.attemptId || m.postAttemptId || 'INCOMPLETE',
    Outcome_Submitted_At: m.outcome?.submittedAt || m.postSubmittedAt || 'INCOMPLETE',
    Tong_Post: m.postScore ?? 'INCOMPLETE',
    So_Loi_Post: m.status === 'INCOMPLETE' ? 'INCOMPLETE' : m.postErrorCount,
    FOUNDATION_Post: m.competencyPost?.[CompetencyCode.FOUNDATION] ?? 'INCOMPLETE',
    RECOGNITION_Post: m.competencyPost?.[CompetencyCode.RECOGNITION] ?? 'INCOMPLETE',
    TRANSFORMATION_Post: m.competencyPost?.[CompetencyCode.TRANSFORMATION] ?? 'INCOMPLETE',
    CALC_ACCURACY_Post: m.competencyPost?.[CompetencyCode.CALC_ACCURACY] ?? 'INCOMPLETE',
    APPLICATION_Post: m.competencyPost?.[CompetencyCode.APPLICATION] ?? 'INCOMPLETE',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(postRows), 'PostTest');

  // Sheet 5: Competencies
  const compList = [
    { code: CompetencyCode.FOUNDATION, name: 'Kiến thức nền' },
    { code: CompetencyCode.RECOGNITION, name: 'Nhận dạng' },
    { code: CompetencyCode.TRANSFORMATION, name: 'Biến đổi' },
    { code: CompetencyCode.CALC_ACCURACY, name: 'Chính xác tính toán' },
    { code: CompetencyCode.APPLICATION, name: 'Vận dụng' },
  ];
  const compRows = compList.map((c) => {
    const preAvg =
      completedMetrics.length > 0
        ? Math.round(
            completedMetrics.reduce((s, m) => s + (m.competencyPre?.[c.code] || 0), 0) / completedMetrics.length
          )
        : null;
    const postAvg =
      completedMetrics.length > 0
        ? Math.round(
            completedMetrics.reduce((s, m) => s + (m.competencyPost?.[c.code] || 0), 0) / completedMetrics.length
          )
        : null;
    return {
      Ma_Nang_Luc: c.code,
      Ten_Nang_Luc: c.name,
      Trung_Binh_Pre: preAvg ?? 'N/A',
      Trung_Binh_Post: postAvg ?? 'N/A',
      Tang_Truong_Gain: preAvg !== null && postAvg !== null ? postAvg - preAvg : 'N/A',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compRows), 'Competencies');

  // Sheet 6: PATH5
  const path5Rows = metrics.map((m) => ({
    Ma_HS: m.studentCode,
    Ho_Va_Ten: m.studentName,
    Buoc_Duoc_Giao: m.assignedSteps,
    Buoc_Hoan_Thanh: m.completedSteps,
    Ty_Le_Hoan_Thanh_Pct: m.pathCompletionPercent,
    So_Hint_Su_Dung: m.hintsUsed,
    Diem_Checkpoint: m.checkpointScore ?? 'INCOMPLETE',
    Can_Thiep_GV: m.teacherInterventions,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(path5Rows), 'PATH5');

  // Sheet 7: Errors
  const errRows = metrics.map((m) => ({
    Ma_HS: m.studentCode,
    Ho_Va_Ten: m.studentName,
    So_Loi_Pre: m.preErrorCount,
    So_Loi_Post: m.status === 'INCOMPLETE' ? 'INCOMPLETE' : m.postErrorCount,
    Ty_Le_Giam_Loi_Pct: m.errorReductionPercent,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(errRows), 'Errors');

  // Sheet 8: Feedback_Students
  const stuFb = feedbacks
    .filter((f) => f.respondentRole === 'STUDENT')
    .map((f) => ({
      Hoc_Sinh: f.respondentName,
      Cau1_LoTrinhPhuHop: f.likertScores[0],
      Cau2_GoiYGiupTuSuaLoi: f.likertScores[1],
      Cau3_HieuRoPhanCanCaiThien: f.likertScores[2],
      Cau4_DeSuDung: f.likertScores[3],
      Cau5_MuonTiepTucSuDung: f.likertScores[4],
      Dieu_Thich_Nhat: f.openAnswer1,
      Dieu_Can_Cai_Thien: f.openAnswer2,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stuFb), 'Feedback_Students');

  // Sheet 9: Feedback_Teachers
  const teaFb = feedbacks
    .filter((f) => f.respondentRole === 'TEACHER')
    .map((f) => ({
      Giao_Vien: f.respondentName,
      Cau1_HeatmapHuuIch: f.likertScores[0],
      Cau2_LearningPathPhuHop: f.likertScores[1],
      Cau3_GiamThoiGianPhanTich: f.likertScores[2],
      Cau4_CoCheDuyetKiemSoatAI: f.likertScores[3],
      Cau5_SanSangTiepTucSuDung: f.likertScores[4],
      Gia_Tri_Lon_Nhat: f.openAnswer1,
      Kho_Khan_Lon_Nhat: f.openAnswer2,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teaFb), 'Feedback_Teachers');

  // Sheet 10: CaseStudies
  const csRows = caseStudies.map((c) => ({
    Ma_An_Danh: c.pseudonymId,
    Hoc_Sinh: c.studentName,
    Nhom_Dien_Hinh: c.categoryLabelVi,
    Da_Duyet_GV: c.teacherApproved ? 'Đã duyệt' : 'Chờ duyệt',
    Pre_Tong: c.beforeSummary.overallPre,
    Post_Tong: c.afterSummary.overallPost,
    Application_Pre: c.beforeSummary.applicationPre,
    Application_Post: c.afterSummary.applicationPost,
    SignError_Pre: c.beforeSummary.signErrorPre,
    SignError_Post: c.afterSummary.signErrorPost,
    Checkpoint: c.path5ProcessSummary.checkpointScore,
    Mo_Ta_Dien_Bien: c.narrativeSummary,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(csRows), 'CaseStudies');

  XLSX.writeFile(wb, `AI_PATH_Bao_Cao_Thuc_Nghiem_${experiment.className}_${experiment.experimentId}.xlsx`);
}

/**
 * 75. REPORT EXPORT - XUẤT PDF (Dữ liệu thật theo đúng đợt thực nghiệm đang chọn)
 */
export function exportExperimentToPdf(params: {
  experiment: Experiment;
  metrics: ExperimentStudentMetric[];
  feedbacks: FeedbackResponseRecord[];
  caseStudies: ExperimentCaseStudy[];
}): void {
  const { experiment } = params;
  const metrics = params.metrics.filter(
    (m) => m.experimentId === experiment.experimentId && m.dataSource === experiment.dataSource
  );
  const feedbacks = params.feedbacks.filter(
    (f) => f.experimentId === experiment.experimentId && f.dataSource === experiment.dataSource
  );
  const caseStudies = params.caseStudies.filter(
    (c) => c.experimentId === experiment.experimentId && c.dataSource === experiment.dataSource
  );
  const preSubmittedMetrics = metrics.filter((m) => m.preScore !== null);
  const completedMetrics = metrics.filter(
    (m) => m.status === 'COMPLETED' && m.preScore !== null && m.postScore !== null
  );
  const incompleteCount = metrics.filter((m) => m.status === 'INCOMPLETE').length;
  const preMean =
    completedMetrics.length > 0
      ? Math.round(
          (completedMetrics.reduce((s, m) => s + (m.preScore || 0), 0) / completedMetrics.length) *
            10
        ) / 10
      : null;
  const postMean =
    completedMetrics.length > 0
      ? Math.round(
          (completedMetrics.reduce((s, m) => s + (m.postScore || 0), 0) / completedMetrics.length) *
            10
        ) / 10
      : null;

  // Helper to strip Vietnamese diacritics for standard Helvetica PDF rendering so no garbled glyphs appear
  const toAsciiVi = (str: string): string =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');

  const doc = new jsPDF();
  doc.setFontSize(15);
  doc.text('BAO CAO KHOA HOC THUC NGHIEM SU PHAM - AI PATH V1.0', 14, 18);

  doc.setFontSize(10);
  doc.text(`Ten dot: ${toAsciiVi(experiment.title)} (${experiment.experimentId})`, 14, 26);
  doc.text(
    `Lop: ${experiment.className} | Nguon du lieu: ${experiment.dataSource} | Do tuong duong Pre/Post: ${experiment.equivalenceScore}%`,
    14,
    32
  );
  doc.text(
    `Doi tuong: ${preSubmittedMetrics.length} nop Pre | ${completedMetrics.length} hoan thanh Pre & Post | ${incompleteCount} khong hoan thanh (INCOMPLETE)`,
    14,
    38
  );
  doc.text(
    preMean !== null && postMean !== null
      ? `Ket qua Pre/Post (N=${completedMetrics.length}): Pre Mean = ${preMean}% -> Post Mean = ${postMean}% (Absolute Gain: ${
          postMean - preMean >= 0 ? '+' : ''
        }${Math.round((postMean - preMean) * 10) / 10}%)`
      : 'Ket qua Pre/Post: Chua du du lieu Pre & Post de tinh Gain',
    14,
    44
  );

  // Table 1: 5 Competencies computed dynamically from completedMetrics (never hardcoded)
  const compDefs = [
    { code: CompetencyCode.FOUNDATION, label: 'FOUNDATION (Kien thuc nen)' },
    { code: CompetencyCode.RECOGNITION, label: 'RECOGNITION (Nhan dang)' },
    { code: CompetencyCode.TRANSFORMATION, label: 'TRANSFORMATION (Bien doi)' },
    { code: CompetencyCode.CALC_ACCURACY, label: 'CALC_ACCURACY (Chinh xac tinh toan)' },
    { code: CompetencyCode.APPLICATION, label: 'APPLICATION (Van dung)' },
  ];

  const compTable = compDefs.map((cd) => {
    if (completedMetrics.length === 0) {
      return [cd.label, 'N/A', 'N/A', 'N/A'];
    }
    const cPre = Math.round(
      completedMetrics.reduce((s, m) => s + (m.competencyPre?.[cd.code] || 0), 0) /
        completedMetrics.length
    );
    const cPost = Math.round(
      completedMetrics.reduce((s, m) => s + (m.competencyPost?.[cd.code] || 0), 0) /
        completedMetrics.length
    );
    const diff = cPost - cPre;
    return [cd.label, `${cPre}%`, `${cPost}%`, `${diff >= 0 ? '+' : ''}${diff}%`];
  });

  autoTable(doc, {
    startY: 50,
    head: [['Nang luc thanh phan', 'Pre Mean', 'Post Mean', 'Absolute Gain']],
    body: compTable,
  });

  // Table 2: Case Studies
  const finalY1 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 95;
  doc.text('Ho so Case Study dien hinh (Da duyet boi Giao vien):', 14, finalY1 + 10);

  const csBody = caseStudies
    .filter((c) => c.teacherApproved)
    .map((c) => [
      c.pseudonymId,
      toAsciiVi(c.categoryLabelVi),
      `${c.beforeSummary.applicationPre}% -> ${c.afterSummary.applicationPost}%`,
      `${c.beforeSummary.signErrorPre} -> ${c.afterSummary.signErrorPost}`,
      `${c.path5ProcessSummary.checkpointScore}%`,
    ]);

  autoTable(doc, {
    startY: finalY1 + 14,
    head: [['Ma HS', 'Phan loai', 'Application (Pre->Post)', 'SIGN_ERROR (Pre->Post)', 'Checkpoint']],
    body: csBody.length > 0 ? csBody : [['N/A', 'Chua co Case Study da duyet', 'N/A', 'N/A', 'N/A']],
  });

  const finalY2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
  doc.setFontSize(9);
  doc.text(
    `Tong so phan hoi thu thap: ${feedbacks.length} phieu. So hoc sinh hoan thanh Pre & Post: ${completedMetrics.length}. Bao cao mo ta xu huong du lieu thuc nghiem cua dot ${experiment.experimentId}, khong tu khang dinh quan he nhan qua tuyet doi khi thiet ke khong co nhom doi chung doc lap.`,
    14,
    finalY2 + 10,
    { maxWidth: 180 }
  );

  doc.save(`AI_PATH_Bao_Cao_Thuc_Nghiem_${experiment.className}_${experiment.experimentId}.pdf`);
}
