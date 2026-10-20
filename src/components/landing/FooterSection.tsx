import React from 'react';

export interface FooterSectionProps {
  onNavigate?: (sectionId: string) => void;
}

export const FooterSection: React.FC<FooterSectionProps> = () => {
  return (
    <footer className="bg-white border-t border-slate-200/90 py-6">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} AI PATH — Hệ thống học tập thích ứng &amp; cá nhân hóa.</span>
          <span>Phát triển phục vụ đổi mới phương pháp dạy học và kiểm tra đánh giá theo định hướng phát triển năng lực.</span>
        </div>
      </div>
    </footer>
  );
};
