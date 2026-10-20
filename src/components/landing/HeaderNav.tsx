import React, { useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';

export interface HeaderNavProps {
  onNavigate: (sectionId: string) => void;
  onFocusLogin: () => void;
}

const NAV_ITEMS = [
  { id: 'hero', label: 'Trang chủ' },
  { id: 'about', label: 'Về AI PATH' },
  { id: 'features', label: 'Tính năng' },
  { id: 'audience', label: 'Đối tượng' },
  { id: 'guide', label: 'Hướng dẫn' },
];

export const HeaderNav: React.FC<HeaderNavProps> = ({ onNavigate, onFocusLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigate(sectionId);
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    onFocusLogin();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Lockup */}
        <button
          type="button"
          onClick={() => handleNavClick('hero')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg cursor-pointer shrink-0"
          aria-label="AI PATH - Về đầu trang"
        >
          <BrandLogo size="sm" />
        </button>

        {/* Zone 2: Desktop Horizontal Navigation */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className="hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#2563EB] cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Mobile Hamburger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLoginClick}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label="Mở menu điều hướng"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLoginClick}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập hệ thống</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
