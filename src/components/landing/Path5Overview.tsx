import React from 'react';
import {
  ClipboardCheck,
  SearchCheck,
  Route,
  Lightbulb,
  Award,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';

export interface Path5OverviewProps {
  onStartDemoLogin: (username: string) => void;
}

const PATH_STEPS = [
  {
    stepNumber: '1',
    title: 'Chẩn đoán',
    englishSub: 'Profile',
    description: 'Xác định điểm xuất phát của học sinh.',
    icon: ClipboardCheck,
    color: 'text-[#0284C7] bg-sky-50 border-sky-200',
  },
  {
    stepNumber: '2',
    title: 'Phân tích',
    englishSub: 'Analyze',
    description: 'Nhận diện năng lực và lỗi thường gặp.',
    icon: SearchCheck,
    color: 'text-[#2563EB] bg-blue-50 border-blue-200',
  },
  {
    stepNumber: '3',
    title: 'Cá nhân hóa',
    englishSub: 'Tailor',
    description: 'Đề xuất lộ trình học tập phù hợp.',
    icon: Route,
    color: 'text-[#4F46E5] bg-indigo-50 border-indigo-200',
  },
  {
    stepNumber: '4',
    title: 'Học thích ứng',
    englishSub: 'Help & Adapt',
    description: 'Hỗ trợ từng bước trong quá trình học.',
    icon: Lightbulb,
    color: 'text-[#7C3AED] bg-violet-50 border-violet-200',
  },
  {
    stepNumber: '5',
    title: 'Tái định tuyến',
    englishSub: 'Re-route',
    description: 'Cập nhật lộ trình khi học sinh tiến bộ.',
    icon: Award,
    color: 'text-[#16A34A] bg-emerald-50 border-emerald-200',
  },
];

const QUICK_GUIDE_STEPS = [
  {
    order: 'Bước 1',
    role: 'Quản trị / Giáo viên',
    title: 'Chuẩn bị lớp học & học liệu',
    detail:
      'Quản lý danh sách lớp, môn học, chủ đề, tải lên tài liệu kiến thức và tạo bài đánh giá đầu vào.',
    demoUser: 'teacher8a2',
    btnText: 'Vào vai Giáo viên',
  },
  {
    order: 'Bước 2',
    role: 'Học sinh',
    title: 'Làm bài đánh giá & học theo lộ trình',
    detail:
      'Học sinh làm bài chẩn đoán, xem hồ sơ năng lực cá nhân và rèn luyện theo lộ trình 5 chặng có gợi ý từng bước.',
    demoUser: 'minhanh8a2',
    btnText: 'Vào vai Học sinh',
  },
  {
    order: 'Bước 3',
    role: 'Giáo viên & Nhà trường',
    title: 'Duyệt lộ trình & theo dõi sự tiến bộ',
    detail:
      'Giáo viên kiểm duyệt lộ trình do AI đề xuất, theo dõi kết quả trước - sau tác động và xuất báo cáo tổng hợp.',
    demoUser: 'admin',
    btnText: 'Vào vai Quản trị',
  },
];

export const Path5Overview: React.FC<Path5OverviewProps> = ({ onStartDemoLogin }) => {
  return (
    <>
      {/* Chu trình 5 bước hoạt động */}
      <section id="features" className="py-14 sm:py-18 bg-white border-t border-slate-200/80">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-xs font-bold text-[#2563EB]">QUY TRÌNH HỌC TẬP THÍCH ỨNG</div>
            <h2
              className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              AI PATH hoạt động như thế nào?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Quy trình khép kín 5 bước giúp cá nhân hóa việc học cho từng học sinh dưới sự đồng hành
              và định hướng của giáo viên.
            </p>
          </div>

          {/* Sơ đồ 5 bước: Ngang trên Desktop, Dọc trên Mobile */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-5 gap-4">
            {PATH_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.stepNumber}
                  className="relative bg-[#F8FAFC] rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:bg-white hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${step.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold font-mono-tabular text-slate-400">
                        {step.stepNumber}. {step.englishSub}
                      </span>
                    </div>

                    <h3 className="mt-4 text-base font-bold text-[#0F172A] leading-snug">
                      {step.stepNumber}. {step.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {index < PATH_STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="hidden md:flex items-center justify-end mt-4 text-slate-300"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Hướng dẫn trải nghiệm nhanh */}
      <section
        id="guide"
        className="py-14 sm:py-16 bg-gradient-to-b from-[#F8FAFC] to-blue-50/40 border-t border-slate-200/80"
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-xs font-bold text-[#2563EB]">HƯỚNG DẪN TRẢI NGHIỆM</div>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Khám phá nhanh AI PATH trong 3 bước
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Chọn bất kỳ vai trò nào bên dưới để tự động điền tài khoản mẫu và bắt đầu trải nghiệm ngay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {QUICK_GUIDE_STEPS.map((item) => (
              <div
                key={item.order}
                className="bg-white rounded-2xl border border-slate-200/90 p-6 flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#2563EB]">
                    <span>{item.order}</span>
                    <span className="text-slate-500">{item.role}</span>
                  </div>
                  <h3 className="mt-2.5 text-base font-bold text-[#0F172A]">{item.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.detail}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onStartDemoLogin(item.demoUser)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#2563EB] hover:text-[#1E3A8A] transition-colors cursor-pointer"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{item.btnText}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
