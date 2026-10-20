import React from 'react';
import { Compass, Route, Sparkles, UserCheck } from 'lucide-react';

const CORE_VALUES = [
  {
    title: 'Chẩn đoán chính xác',
    description: 'Biết học sinh đang ở đâu.',
    icon: Compass,
    iconBg: 'bg-blue-50 text-[#2563EB]',
  },
  {
    title: 'Cá nhân hóa lộ trình',
    description: 'Học đúng phần đang cần.',
    icon: Route,
    iconBg: 'bg-indigo-50 text-[#4F46E5]',
  },
  {
    title: 'Hỗ trợ AI có trách nhiệm',
    description: 'AI gợi ý từng bước, không làm thay.',
    icon: Sparkles,
    iconBg: 'bg-violet-50 text-[#7C3AED]',
  },
  {
    title: 'Giáo viên kiểm soát',
    description: 'Giáo viên duyệt, chỉnh sửa và theo dõi tiến bộ.',
    icon: UserCheck,
    iconBg: 'bg-emerald-50 text-[#16A34A]',
  },
];

export const CoreValues: React.FC = () => {
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {CORE_VALUES.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm hover:border-blue-300/80 transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#0F172A] leading-snug">{item.title}</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
