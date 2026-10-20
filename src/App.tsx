import React, { useEffect, useState, useCallback } from 'react';
import {
  BootstrapPayload,
  apiClient,
  getStoredToken,
  setStoredToken,
} from './services/apiClient';
import { Role, UserAccount } from './types';
import { LoginPage } from './pages/LoginPage';
import { TeacherPortal } from './pages/TeacherPortal';
import { StudentPortal } from './pages/StudentPortal';
import { AdminPortal } from './pages/AdminPortal';
import { BrandLogo } from './components/brand/BrandLogo';

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [bootstrapData, setBootstrapData] = useState<BootstrapPayload | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [me, payload] = await Promise.all([
        apiClient.getMe(),
        apiClient.getBootstrap(),
      ]);
      setUser(me.user);
      setBootstrapData(payload);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tải dữ liệu từ hệ thống.'
      );
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const token = getStoredToken();
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const me = await apiClient.getMe();
        setUser(me.user);
        const payload = await apiClient.getBootstrap();
        setBootstrapData(payload);
      } catch {
        setStoredToken(null);
        setUser(null);
        setBootstrapData(null);
      } finally {
        setInitializing(false);
      }
    }
    restoreSession();
  }, []);

  const handleLoginSuccess = async (loggedInUser: UserAccount) => {
    setUser(loggedInUser);
    setInitializing(true);
    try {
      const payload = await apiClient.getBootstrap();
      setBootstrapData(payload);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Lỗi khi khởi tạo không gian làm việc.'
      );
    } finally {
      setInitializing(false);
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setBootstrapData(null);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col items-center justify-center p-6">
        <BrandLogo size="lg" />
        <div className="mt-4 font-bold text-base text-[#1E3A8A]">
          Hệ thống học tập thích ứng và cá nhân hóa bằng trí tuệ nhân tạo
        </div>
        <div className="mt-1.5 text-xs text-slate-500">
          Đang chuẩn bị không gian học tập và dữ liệu cá nhân hóa...
        </div>
      </div>
    );
  }

  if (!user || !bootstrapData) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white p-6 rounded-xl border border-red-200 max-w-md w-full space-y-4 text-center">
          <div className="text-red-700 font-bold text-base">Lỗi đồng bộ dữ liệu</div>
          <p className="text-xs text-slate-600">{errorMessage}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={loadWorkspaceData}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold"
            >
              Thử lại
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === Role.ADMIN) {
    return (
      <AdminPortal
        user={user}
        data={bootstrapData}
        onRefresh={loadWorkspaceData}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === Role.TEACHER) {
    return (
      <TeacherPortal
        user={user}
        data={bootstrapData}
        onRefresh={loadWorkspaceData}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <StudentPortal
      user={user}
      data={bootstrapData}
      onRefresh={loadWorkspaceData}
      onLogout={handleLogout}
    />
  );
}
