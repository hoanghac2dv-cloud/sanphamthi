import React from 'react';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
  showEnglishSub?: boolean;
  subtitleText?: string;
  className?: string;
}

/**
 * Logo vector chính thức của AI PATH:
 * - Cuốn sách đang mở ở phần đế (nền tảng tri thức giáo dục)
 * - Con đường / lộ trình đi lên mềm mại
 * - 4 điểm nút tượng trưng cho các chặng phát triển năng lực
 * - Ngôi sao 4 cánh ở đỉnh tượng trưng cho đích đến làm chủ kiến thức & AI dẫn đường
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'light',
  showSubtitle = false,
  showEnglishSub = false,
  subtitleText = 'Học tập thích ứng & cá nhân hóa bằng trí tuệ nhân tạo',
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14 sm:w-16 sm:h-16',
  }[size];

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const subtitleSizes = {
    sm: 'text-xs',
    md: 'text-xs sm:text-sm',
    lg: 'text-xs sm:text-base lg:text-[17px] font-bold whitespace-nowrap',
  }[size];

  const englishSubSizes = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-[11px] sm:text-xs whitespace-nowrap',
  }[size];

  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {/* Biểu tượng Vector SVG: Sách mở + Lộ trình đi lên + Các điểm nút + Ngôi sao đích */}
      <div
        className={`${iconDimensions} relative rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
          isDark
            ? 'bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#7C3AED] ring-1 ring-white/20'
            : 'bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#7C3AED] ring-1 ring-blue-600/20'
        }`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5"
        >
          <defs>
            <linearGradient id="aipathBookGrad" x1="6" y1="30" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#93C5FD" />
              <stop offset="50%" stopColor="#E0F2FE" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>
            <linearGradient id="aipathRouteGrad" x1="12" y1="36" x2="36" y2="10" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
          </defs>

          {/* Cuốn sách mở ở phần đế */}
          <path
            d="M8 34.5C12.5 32.5 18.5 33 24 36C29.5 33 35.5 32.5 40 34.5V40.5C35.5 38.8 29.5 39.2 24 42C18.5 39.2 12.5 38.8 8 40.5V34.5Z"
            fill="url(#aipathBookGrad)"
            fillOpacity="0.92"
          />
          <path
            d="M24 36V42"
            stroke="#1E3A8A"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Con đường học tập đi lên từ trang sách */}
          <path
            d="M13 33C14.5 26.5 19.5 25.5 23 22C26.5 18.5 29.5 15.5 34.5 11.5"
            stroke="url(#aipathRouteGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* 3 Điểm nút chặng học tập trên lộ trình */}
          <circle cx="13" cy="33" r="2.6" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.2" />
          <circle cx="20.5" cy="24.2" r="2.6" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.2" />
          <circle cx="27.5" cy="17.5" r="2.8" fill="#DDD6FE" stroke="#7C3AED" strokeWidth="1.2" />

          {/* Ngôi sao điểm đích phía trên */}
          <path
            d="M35.5 6.5L37.1 10.1L40.7 11.7L37.1 13.3L35.5 16.9L33.9 13.3L30.3 11.7L33.9 10.1L35.5 6.5Z"
            fill="#FDE047"
          />
        </svg>
      </div>

      {/* Phần chữ thương hiệu AI PATH */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`${titleSizes} font-extrabold tracking-tight leading-none whitespace-nowrap ${
              isDark ? 'text-white' : 'text-[#1E3A8A]'
            }`}
          >
            AI PATH
          </span>
        </div>

        {showSubtitle && (
          <span
            className={`${subtitleSizes} mt-1 leading-snug ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {subtitleText}
          </span>
        )}

        {showEnglishSub && (
          <span
            className={`${englishSubSizes} mt-0.5 leading-none ${
              isDark ? 'text-slate-400' : 'text-slate-400'
            }`}
          >
            Adaptive &amp; Personalized Learning Platform
          </span>
        )}
      </div>
    </div>
  );
};
