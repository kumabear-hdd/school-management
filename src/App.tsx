import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  CheckCheck,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { SimsProvider, useSims } from './context/SimsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DashboardModule, type NavSection } from './components/DashboardModule';
import { AcademicModule } from './components/AcademicModule';
import { AssignmentModule } from './components/AssignmentModule';
import { PortalServicesModule } from './components/PortalServicesModule';
import { AttendanceModule } from './components/AttendanceModule';
import { AdminGovernanceModule } from './components/AdminGovernanceModule';
import { UserManagementModule } from './components/UserManagementModule';
import { AuthPortalScreen } from './components/AuthPortalScreen';
import { ForcePasswordChangeScreen } from './components/ForcePasswordChangeScreen';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { canAccessNavSection, ROLE_LABELS } from './utils/authLogic';

const NAV_ITEMS: {
  key: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'akademik', label: 'Akademik & Nilai', icon: BookOpen },
  { key: 'e_tugas', label: 'Tugas Online (E-Tugas)', icon: Camera },
  { key: 'portal', label: 'Portal, PPDB & OSIS', icon: Globe },
  { key: 'absensi', label: 'Absensi Lanjutan', icon: MapPin },
  { key: 'manajemen_pengguna', label: 'Manajemen Pengguna', icon: Users },
  { key: 'administrasi', label: 'Administrasi & Audit', icon: Shield },
];

const SimsShell: React.FC = () => {
  const {
    data,
    currentUser,
    authStatus,
    isOffline,
    offlineQueue,
    statusMessage,
    clearStatusMessage,
    logoutSession,
    syncOfflineQueueNow,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSims();

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (!canAccessNavSection(currentUser.role, activeSection)) {
      setActiveSection('dashboard');
    }
  }, [currentUser.role, activeSection]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-700">
          Memuat sesi autentikasi & konfigurasi sekolah SIMS...
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <AuthPortalScreen />;
  }

  if (authStatus === 'must_change_password') {
    return <ForcePasswordChangeScreen />;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    canAccessNavSection(currentUser.role, item.key)
  );

  const userNotifications = data.notifications.filter(
    (n) => n.recipientId === currentUser.uid
  );
  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const activeNavTitle =
    visibleNavItems.find((item) => item.key === activeSection)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
          <div className="flex h-16 items-center px-6 border-b border-slate-200">
            <span className="text-base font-bold tracking-tight text-[#0F4C81] whitespace-nowrap">
              SIMS Terpadu
            </span>
          </div>

          <nav aria-label="Menu Utama" className="flex-1 space-y-1 px-3 py-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-50 text-[#0F4C81]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0F4C81]">
              {ROLE_LABELS[currentUser.role]}
            </p>
            <div className="text-xs">
              <p className="truncate font-semibold text-slate-800">{currentUser.name}</p>
              <p className="truncate font-mono text-[11px] text-slate-500">
                @{currentUser.username}
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative z-10 flex w-72 max-w-[80vw] flex-col bg-white border-r border-slate-200">
              <div className="flex h-14 items-center justify-between px-4 border-b border-slate-200">
                <span className="text-base font-bold text-[#0F4C81]">SIMS Terpadu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav aria-label="Menu Mobile" className="flex-1 space-y-1 p-3">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        active
                          ? 'bg-sky-50 text-[#0F4C81]'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-slate-200 p-4 space-y-1">
                <p className="text-xs font-semibold text-[#0F4C81]">
                  {ROLE_LABELS[currentUser.role]}
                </p>
                <p className="truncate text-xs font-medium text-slate-800">
                  {currentUser.name}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500">
                  @{currentUser.username}
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          {/* Clean 1-row Top Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu navigasi"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="truncate text-sm font-semibold text-slate-900">
                {data.school.name} / {activeNavTitle}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton />

              {/* Notification Popover Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
                  className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Notifikasi</span>
                  {unreadCount > 0 && (
                    <span className="font-mono font-semibold text-[#0F4C81] tabular-nums">
                      ({unreadCount})
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="text-sm font-semibold text-slate-900">
                        Notifikasi E-Tugas
                      </span>
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81] hover:underline"
                      >
                        <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Tandai dibaca
                      </button>
                    </div>
                    <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {userNotifications.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-500">
                          Belum ada notifikasi untuk akun ini.
                        </p>
                      ) : (
                        userNotifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            className={`w-full py-2.5 text-left transition-colors ${
                              n.read ? 'opacity-65' : 'bg-sky-50/40'
                            }`}
                          >
                            <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Akun & Password</span>
              </button>

              <button
                type="button"
                onClick={() => void logoutSession()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </div>
          </header>

          {/* Global Action Status Toast */}
          {statusMessage && (
            <div className="mx-4 mt-4 sm:mx-6 flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-950">
              <span>{statusMessage}</span>
              <button
                type="button"
                onClick={clearStatusMessage}
                aria-label="Tutup pesan status"
                className="text-sky-800 hover:text-sky-950"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Main Viewport */}
          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
            {activeSection === 'dashboard' && (
              <DashboardModule onNavigate={setActiveSection} />
            )}
            {activeSection === 'akademik' && <AcademicModule />}
            {activeSection === 'e_tugas' && <AssignmentModule />}
            {activeSection === 'portal' && <PortalServicesModule />}
            {activeSection === 'absensi' && <AttendanceModule />}
            {activeSection === 'manajemen_pengguna' && <UserManagementModule />}
            {activeSection === 'administrasi' && (
              <AdminGovernanceModule onNavigate={setActiveSection} />
            )}
          </main>

          <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data.school.name} · Sistem Informasi Manajemen Sekolah Multi-Tenant
            </span>
            <span>
              Tenant ID: <span className="font-mono">{data.school.schoolId}</span>
            </span>
          </footer>
        </div>

        <OfflineIndicator
          isOffline={isOffline}
          pendingCount={offlineQueue.length}
          onSyncNow={syncOfflineQueueNow}
        />
      </div>

      <AccountSettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SimsProvider>
        <SimsShell />
      </SimsProvider>
    </ErrorBoundary>
  );
}
