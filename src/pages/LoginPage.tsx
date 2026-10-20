import React, { useRef, useState } from 'react';
import { apiClient, setStoredToken } from '../services/apiClient';
import { signInWithGooglePopup } from '../services/firebase';
import { UserAccount } from '../types';
import { HeaderNav } from '../components/landing/HeaderNav';
import { HeroSection } from '../components/landing/HeroSection';
import { LoginCard } from '../components/landing/LoginCard';
import { StatsSection } from '../components/landing/StatsSection';
import { AudienceSection } from '../components/landing/AudienceSection';
import { Path5Overview } from '../components/landing/Path5Overview';
import { FooterSection } from '../components/landing/FooterSection';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('teacher8a2');
  const [password, setPassword] = useState('Demo@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.loginWithUsername(username, password);
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const fbUser = await signInWithGooglePopup();
      const idToken = await fbUser.getIdToken(true);
      const res = await apiClient.syncGoogleUser(idToken);
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (u: string) => {
    setUsername(u);
    setPassword('Demo@2026');
    setError(null);
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFocusLogin = () => {
    scrollToSection('login-card');
    window.setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 250);
  };

  const handleSelectRoleAndFocusLogin = (demoUsername: string) => {
    fillDemoAccount(demoUsername);
    handleFocusLogin();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* 1. Header cố định trên toàn trang */}
      <HeaderNav onNavigate={scrollToSection} onFocusLogin={handleFocusLogin} />

      {/* 2. Khu vực Hero + Khối Đăng nhập */}
      <main className="flex-1">
        <section
          id="hero"
          className="relative overflow-hidden bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF]/70 to-[#EEF2FF]/90 py-10 sm:py-14 lg:py-16"
        >
          {/* Điểm nhấn sáng mềm mại phía sau */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/3 right-0 w-96 h-96 rounded-full bg-violet-400/10 blur-3xl"
          />

          <div className="relative max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              {/* Cột trái: Thông điệp giáo dục, Minh họa lộ trình & 4 Giá trị cốt lõi */}
              <div className="lg:col-span-7">
                <HeroSection
                  onExploreFeatures={() => scrollToSection('features')}
                  onHowItWorks={() => scrollToSection('guide')}
                />
              </div>

              {/* Cột phải: Khối Đăng nhập & Chọn nhanh vai trò mẫu */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <LoginCard
                  username={username}
                  password={password}
                  loading={loading}
                  error={error}
                  usernameInputRef={usernameInputRef}
                  onUsernameChange={setUsername}
                  onPasswordChange={setPassword}
                  onSubmit={handleSubmit}
                  onGoogleLogin={handleGoogleLogin}
                  onSelectDemoAccount={fillDemoAccount}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Thống kê / Điểm nổi bật */}
        <StatsSection />

        {/* 4. AI PATH dành cho ai? (Học sinh | Giáo viên | Nhà trường) */}
        <AudienceSection onSelectRoleAndScrollLogin={handleSelectRoleAndFocusLogin} />

        {/* 5. Giới thiệu ngắn về Chu trình 5 bước & Hướng dẫn trải nghiệm */}
        <Path5Overview onStartDemoLogin={handleSelectRoleAndFocusLogin} />
      </main>

      {/* 6. Footer */}
      <FooterSection onNavigate={scrollToSection} />
    </div>
  );
};
