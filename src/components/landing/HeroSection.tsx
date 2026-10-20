import React, { useState } from 'react';
import { ArrowRight, Compass, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';
import { CoreValues } from './CoreValues';

export interface HeroSectionProps {
  onExploreFeatures: () => void;
  onHowItWorks: () => void;
}

interface JourneyStage {
  id: number;
  label: string;
  shortDesc: string;
  detail: string;
  x: number;
  y: number;
  color: string;
}

const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 1,
    label: 'Điểm xuất phát',
    shortDesc: 'Xác định vị trí hiện tại',
    detail: 'Đánh giá nhanh năng lực đầu vào để biết phần kiến thức đã vững và phần còn hổng.',
    x: 56,
    y: 122,
    color: '#0284C7',
  },
  {
    id: 2,
    label: 'Nhận biết',
    shortDesc: 'Nắm vững khái niệm',
    detail: 'Nhận diện đúng dạng toán, quy tắc dấu và nhân tử chung cơ bản.',
    x: 170,
    y: 98,
    color: '#2563EB',
  },
  {
    id: 3,
    label: 'Biến đổi',
    shortDesc: 'Rèn kỹ năng giải toán',
    detail: 'Thực hành từng bước biến đổi có gợi ý thông minh khi gặp vướng mắc.',
    x: 288,
    y: 74,
    color: '#4F46E5',
  },
  {
    id: 4,
    label: 'Vận dụng',
    shortDesc: 'Giải quyết bài toán mới',
    detail: 'Phối hợp nhiều phương pháp để giải quyết các bài toán đa dạng.',
    x: 406,
    y: 48,
    color: '#7C3AED',
  },
  {
    id: 5,
    label: 'Thành thạo',
    shortDesc: 'Tự tin làm chủ kiến thức',
    detail: 'Hoàn thành bài kiểm tra độc lập và sẵn sàng tiến lên chủ đề tiếp theo.',
    x: 520,
    y: 26,
    color: '#16A34A',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreFeatures,
  onHowItWorks,
}) => {
  const [selectedStageId, setSelectedStageId] = useState<number>(3);
  const activeStage =
    JOURNEY_STAGES.find((s) => s.id === selectedStageId) || JOURNEY_STAGES[2];

  return (
    <div className="flex flex-col justify-between">
      <div>
        {/* Cụm nhận diện AI PATH đưa lên trên cùng, ngay phía trên tiêu đề chính */}
        <div className="mb-4">
          <BrandLogo
            size="lg"
            showSubtitle
            showEnglishSub
            subtitleText="Hệ thống học tập thích ứng và cá nhân hóa bằng trí tuệ nhân tạo"
          />
        </div>

        {/* Badge nhỏ định vị giáo dục */}
        <div className="mb-3 inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-md bg-blue-50/80 border border-blue-100 text-xs font-semibold text-[#2563EB]">
          <span>AI trong giáo dục</span>
          <span aria-hidden="true" className="text-slate-300">•</span>
          <span>Học tập thích ứng</span>
          <span aria-hidden="true" className="text-slate-300">•</span>
          <span className="text-[#7C3AED]">Giáo viên kiểm soát</span>
        </div>

        {/* Tagline / Tiêu đề chính */}
        <h1
          className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#0F172A] leading-[1.18]"
          style={{ textWrap: 'balance' }}
        >
          Mỗi học sinh – Một điểm xuất phát –{' '}
          <span className="bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">
            Một lộ trình phù hợp.
          </span>
        </h1>

        {/* Thông điệp giới thiệu thân thiện */}
        <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
          AI PATH giúp giáo viên hiểu rõ từng học sinh, phát hiện phần kiến thức cần hỗ trợ,
          đề xuất lộ trình học tập cá nhân hóa và theo dõi sự tiến bộ dựa trên dữ liệu thực.
        </p>

        {/* Nhóm nút hành động (CTA) */}
        <div className="mt-6 flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={onExploreFeatures}
            className="min-h-[46px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1E3A8A] hover:to-[#4338CA] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-600/15 transition-all cursor-pointer whitespace-nowrap"
          >
            <span>KHÁM PHÁ AI PATH</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onHowItWorks}
            className="min-h-[46px] px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#1E3A8A] border border-slate-200/90 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-4 h-4 text-[#2563EB]" />
            <span>TÌM HIỂU CÁCH HOẠT ĐỘNG</span>
          </button>
        </div>

        {/* Minh họa Vector Lộ trình học tập tương tác (Điểm xuất phát -> Thành thạo) */}
        <div className="mt-8 bg-white/95 border border-slate-200/90 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-bold text-[#1E3A8A]">
              Hành trình phát triển năng lực cá nhân hóa
            </div>
            <div className="text-[11px] text-slate-500">
              Nhấn vào từng chặng để xem cách AI PATH đồng hành
            </div>
          </div>

          {/* SVG Con đường học tập đi lên */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 580 155"
              className="w-full min-w-[460px] h-auto select-none"
              role="img"
              aria-label="Sơ đồ lộ trình học tập từ Điểm xuất phát qua Nhận biết, Biến đổi, Vận dụng đến Thành thạo"
            >
              <defs>
                <linearGradient id="heroPathGradient" x1="56" y1="122" x2="520" y2="26" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0284C7" />
                  <stop offset="35%" stopColor="#2563EB" />
                  <stop offset="70%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#16A34A" />
                </linearGradient>
                <linearGradient id="heroAreaGradient" x1="288" y1="20" x2="288" y2="150" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Lưới nền nhẹ */}
              <line x1="30" y1="138" x2="550" y2="138" stroke="#E2E8F0" strokeDasharray="4 4" />
              <line x1="30" y1="90" x2="550" y2="90" stroke="#F1F5F9" />
              <line x1="30" y1="42" x2="550" y2="42" stroke="#F1F5F9" />

              {/* Vùng bóng mờ dưới đường cong */}
              <path
                d="M56 122 C 115 118, 130 104, 170 98 C 225 90, 245 82, 288 74 C 340 64, 365 56, 406 48 C 455 38, 480 32, 520 26 L 520 138 L 56 138 Z"
                fill="url(#heroAreaGradient)"
              />

              {/* Đường lộ trình chính */}
              <path
                d="M56 122 C 115 118, 130 104, 170 98 C 225 90, 245 82, 288 74 C 340 64, 365 56, 406 48 C 455 38, 480 32, 520 26"
                fill="none"
                stroke="url(#heroPathGradient)"
                strokeWidth="4.5"
                strokeLinecap="round"
              />

              {/* Các điểm nút chặng học tập */}
              {JOURNEY_STAGES.map((stage) => {
                const isSelected = stage.id === selectedStageId;
                return (
                  <g
                    key={stage.id}
                    onClick={() => setSelectedStageId(stage.id)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={stage.x}
                        cy={stage.y}
                        r="16"
                        fill={stage.color}
                        fillOpacity="0.16"
                      />
                    )}
                    <circle
                      cx={stage.x}
                      cy={stage.y}
                      r={isSelected ? '10' : '8'}
                      fill="#FFFFFF"
                      stroke={stage.color}
                      strokeWidth={isSelected ? '4' : '3'}
                    />
                    <circle
                      cx={stage.x}
                      cy={stage.y}
                      r="3.5"
                      fill={stage.color}
                    />
                    <text
                      x={stage.x}
                      y={stage.y + 24}
                      textAnchor="middle"
                      fill={isSelected ? '#0F172A' : '#475569'}
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '600'}
                    >
                      {stage.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Chú thích chặng đang chọn */}
          <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#1E3A8A]">
              <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span>
                Chặng {activeStage.id}/5: {activeStage.label} — {activeStage.shortDesc}
              </span>
            </div>
            <p className="text-slate-600">{activeStage.detail}</p>
          </div>
        </div>

        {/* 4 Giá trị cốt lõi */}
        <CoreValues />
      </div>
    </div>
  );
};
