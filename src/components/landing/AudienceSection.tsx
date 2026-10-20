import React from 'react';
import { GraduationCap, BookOpenCheck, Building2, CheckCircle2, ArrowUpRight } from 'lucide-react';

export interface AudienceSectionProps {
  onSelectRoleAndScrollLogin: (username: string) => void;
}

const AUDIENCES = [
  {
    roleTitle: 'Học sinh',
    subtitle: 'Biết mình đang ở đâu, học đúng phần cần thiết và nhìn thấy sự tiến bộ của bản thân.',
    demoUsername: 'minhanh8a2',
    actionLabel: 'Khám phá trải nghiệm học sinh',
    icon: GraduationCap,
    iconWrap: 'bg-blue-50 text-[#2563EB] border-blue-200/80',
    benefits: [
      'Biết mình đang mạnh ở đâu và cần cải thiện phần nào',
      'Học theo lộ trình phù hợp với năng lực',
      'Nhận gợi ý từng bước khi gặp bài khó',
      'Theo dõi sự tiến bộ của bản thân',
    ],
  },
  {
    roleTitle: 'Giáo viên',
    subtitle: 'Nhìn rõ bức tranh lớp học, phát hiện nhu cầu hỗ trợ và cá nhân hóa hoạt động học hiệu quả hơn.',
    demoUsername: 'teacher8a2',
    actionLabel: 'Khám phá công cụ giáo viên',
    icon: BookOpenCheck,
    iconWrap: 'bg-indigo-50 text-[#4F46E5] border-indigo-200/80',
    benefits: [
      'Nắm nhanh tình hình lớp học và từng học sinh',
      'Phát hiện lỗi sai phổ biến để kịp thời hỗ trợ',
      'Duyệt hoặc điều chỉnh lộ trình học tập do AI đề xuất',
      'Theo dõi kết quả trước và sau tác động',
    ],
  },
  {
    roleTitle: 'Nhà trường / Quản trị',
    subtitle: 'Quản lý dữ liệu học tập, theo dõi triển khai và hỗ trợ ứng dụng AI an toàn, có kiểm soát.',
    demoUsername: 'admin',
    actionLabel: 'Tìm hiểu quản trị',
    icon: Building2,
    iconWrap: 'bg-violet-50 text-[#7C3AED] border-violet-200/80',
    benefits: [
      'Quản lý trường học, năm học, khối lớp, giáo viên và học sinh',
      'Tổ chức danh mục môn học, chủ đề và tài liệu kiến thức',
      'Nhập danh sách giáo viên, học sinh nhanh từ biểu mẫu Excel',
      'Tổng hợp báo cáo kết quả và minh chứng triển khai thực tế',
    ],
  },
];

export const AudienceSection: React.FC<AudienceSectionProps> = ({
  onSelectRoleAndScrollLogin,
}) => {
  return (
    <section id="audience" className="py-14 sm:py-18 bg-[#F8FAFC]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs font-bold text-[#2563EB]">ĐỐI TƯỢNG SỬ DỤNG</div>
          <h2
            className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            AI PATH dành cho ai?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Thiết kế chuyên biệt cho từng vai trò trong môi trường giáo dục phổ thông,
            đảm bảo tính trực quan, dễ sử dụng và sát thực tế lớp học.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {AUDIENCES.map((group) => {
            const Icon = group.icon;
            return (
              <div
                key={group.roleTitle}
                className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all"
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${group.iconWrap}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-[#0F172A]">
                        {group.roleTitle}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{group.subtitle}</p>
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {group.benefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onSelectRoleAndScrollLogin(group.demoUsername)}
                    className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-[#1E3A8A] hover:text-[#2563EB] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>{group.actionLabel}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
