import React from 'react';
import { GraduationCap, BookOpenCheck, ShieldCheck } from 'lucide-react';

export interface DemoRoleSelectorProps {
  selectedUsername: string;
  onSelectDemoAccount: (username: string) => void;
}

const DEMO_ROLES = [
  {
    roleLabel: 'Học sinh',
    username: 'minhanh8a2',
    contextLabel: 'Lớp 8A2',
    icon: GraduationCap,
    accentText: 'text-[#2563EB]',
    activeBg: 'border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB]/30',
  },
  {
    roleLabel: 'Giáo viên',
    username: 'teacher8a2',
    contextLabel: 'Toán 8',
    icon: BookOpenCheck,
    accentText: 'text-[#4F46E5]',
    activeBg: 'border-[#4F46E5] bg-indigo-50/70 ring-1 ring-[#4F46E5]/30',
  },
  {
    roleLabel: 'Quản trị',
    username: 'admin',
    contextLabel: 'Quản lý trường',
    icon: ShieldCheck,
    accentText: 'text-[#7C3AED]',
    activeBg: 'border-[#7C3AED] bg-violet-50/70 ring-1 ring-[#7C3AED]/30',
  },
];

export const DemoRoleSelector: React.FC<DemoRoleSelectorProps> = ({
  selectedUsername,
  onSelectDemoAccount,
}) => {
  return (
    <div className="mt-7 pt-6 border-t border-slate-200/80">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-[#0F172A]">Trải nghiệm nhanh</h3>
        <span className="text-[11px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/70">
          Chế độ trải nghiệm
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {DEMO_ROLES.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedUsername === item.username;
          return (
            <button
              key={item.username}
              type="button"
              onClick={() => onSelectDemoAccount(item.username)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? item.activeBg
                  : 'border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-[#0F172A] whitespace-nowrap">
                  {item.roleLabel}
                </span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${item.accentText}`} />
              </div>
              <div
                className={`text-[11px] font-mono-tabular font-semibold mt-1 truncate ${item.accentText}`}
              >
                {item.username}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                {item.contextLabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
