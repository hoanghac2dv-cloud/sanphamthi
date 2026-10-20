import React, { useState } from 'react';
import { Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';
import { DemoRoleSelector } from './DemoRoleSelector';

export interface LoginCardProps {
  username: string;
  password: string;
  loading: boolean;
  error: string | null;
  usernameInputRef?: React.RefObject<HTMLInputElement | null>;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleLogin: () => void;
  onSelectDemoAccount: (username: string) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  username,
  password,
  loading,
  error,
  usernameInputRef,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onGoogleLogin,
  onSelectDemoAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      id="login-card"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-blue-950/5 p-6 sm:p-8 lg:p-9 w-full"
    >
      {/* Header của khối đăng nhập */}
      <div className="mb-6">
        <div className="mb-3">
          <BrandLogo
            size="sm"
            showSubtitle
            subtitleText="Học tập thích ứng & cá nhân hóa bằng trí tuệ nhân tạo"
          />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
          Đăng nhập AI PATH
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
          Chào mừng bạn quay trở lại. Hãy đăng nhập để tiếp tục hành trình học tập cùng AI PATH.
        </p>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-red-50 border border-[#DC2626]/30 text-xs sm:text-sm text-[#DC2626] font-medium"
        >
          {error}
        </div>
      )}

      {/* Biểu mẫu đăng nhập */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="username-input"
            className="block text-xs sm:text-sm font-semibold text-[#0F172A] mb-1.5"
          >
            Tên đăng nhập
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={usernameInputRef}
              id="username-input"
              type="text"
              required
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              className="w-full pl-10 pr-4 py-3 min-h-[46px] rounded-xl border border-slate-300 bg-slate-50/40 focus:bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password-input"
            className="block text-xs sm:text-sm font-semibold text-[#0F172A] mb-1.5"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full pl-10 pr-11 py-3 min-h-[46px] rounded-xl border border-slate-300 bg-slate-50/40 focus:bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1E3A8A] hover:to-[#4338CA] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/15 transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Nút phụ: Tiếp tục với Google */}
      <div className="mt-3.5">
        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loading}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#2563EB"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.72 0-.8-.08-1.57-.23-2.32Z"
            />
            <path
              fill="#16A34A"
              d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.26 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.59H-.1v3.73C2.54 18.41 7.01 22 12.18 22Z"
            />
            <path
              fill="#F59E0B"
              d="M3.22 9.44A9.58 9.58 0 0 1 2.7 6.3c0-1.09.19-2.15.52-3.14V-.57H-.1A11.97 11.97 0 0 0-1.4 6.3c0 1.93.46 3.75 1.3 5.37l3.32-2.23Z"
            />
            <path
              fill="#DC2626"
              d="M12.18 2.58c2.35 0 4.46.81 6.12 2.4l4.59-4.59C20.12-2.18 16.5-3.6 12.18-3.6 7.01-3.6 2.54-.01-.1 5.23l3.32 2.57c1.26-3.78 4.79-5.22 8.96-5.22Z"
            />
          </svg>
          <span>Tiếp tục với Google</span>
        </button>
      </div>

      {/* Bộ chọn nhanh tài khoản mẫu */}
      <DemoRoleSelector
        selectedUsername={username}
        onSelectDemoAccount={onSelectDemoAccount}
      />
    </div>
  );
};
