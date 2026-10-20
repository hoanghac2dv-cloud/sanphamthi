import React from 'react';
import { Layers, GitBranch, Lightbulb, TrendingUp } from 'lucide-react';

const HIGHLIGHT_CARDS = [
  {
    title: '5 năng lực cốt lõi',
    description: 'Theo dõi theo từng thành phần năng lực.',
    icon: Layers,
    iconStyle: 'bg-blue-50 text-[#2563EB]',
  },
  {
    title: '48 câu hỏi mẫu',
    description: 'Ngân hàng Toán 8 cho phiên bản thử nghiệm.',
    icon: GitBranch,
    iconStyle: 'bg-indigo-50 text-[#4F46E5]',
  },
  {
    title: 'Giáo viên kiểm soát AI',
    description: 'Duyệt – Chỉnh sửa – Từ chối đề xuất.',
    icon: Lightbulb,
    iconStyle: 'bg-violet-50 text-[#7C3AED]',
  },
  {
    title: 'Pre / Post',
    description: 'Theo dõi sự thay đổi trước và sau quá trình học.',
    icon: TrendingUp,
    iconStyle: 'bg-emerald-50 text-[#16A34A]',
  },
];

export const StatsSection: React.FC = () => {
  return (
    <section id="about" className="py-10 sm:py-12 border-y border-slate-200/80 bg-white">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HIGHLIGHT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] p-5 flex items-start gap-4 hover:bg-white hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.iconStyle}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#0F172A] leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
