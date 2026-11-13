import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Calculator,
  Cloud,
  Download,
  FileText,
  Home,
  Lock,
  Moon,
  Plus,
  ReceiptIndianRupee,
  Settings,
  Sun,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOnlineStatus, usePWAInstall } from '../services/platform';
import type { ScreenName } from '../types';
import { formatDateDDMMYYYY, todayISODate } from '../utils/format';
import { Logo } from './Logo';

export const NavigationShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { route, navigate, goBack, settings, setTheme, reminders, t, toasts, lockApp } = useApp();
  const [quickOpen, setQuickOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  const pendingRemindersCount = reminders.filter((r) => r.status === 'pending').length;

  const isRootTab = (s: ScreenName) =>
    ['home', 'profiles', 'transactions', 'calculator', 'loan_calculator', 'settings'].includes(s);

  const activeTab = (() => {
    if (route.screen === 'home') return 'home';
    if (['profiles', 'add_profile', 'profile_details', 'edit_profile'].includes(route.screen)) return 'profiles';
    if (['transactions', 'transaction_details'].includes(route.screen)) return 'transactions';
    if (['calculator', 'loan_calculator'].includes(route.screen)) return 'calculator';
    if (
      [
        'settings',
        'security_settings',
        'language_settings',
        'theme_settings',
        'firebase_config',
        'sync_status',
        'json_export',
        'json_import',
        'about',
      ].includes(route.screen)
    )
      return 'settings';
    return 'home';
  })();

  const toggleQuickTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleQuickAction = (target: ScreenName) => {
    setQuickOpen(false);
    navigate(target);
  };

  return (
    <div className="min-h-screen flex bg-[#F5F6FC] dark:bg-[#0B0B18] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-[#15152B] border-r border-slate-200 dark:border-white/10 z-30 no-print">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-white/10">
          <Logo size={34} />
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              CREDIT LOGGER
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
              {formatDateDDMMYYYY(todayISODate())}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary Sidebar Navigation">
          {[
            { id: 'home' as const, label: t('home'), icon: Home },
            { id: 'profiles' as const, label: t('profiles'), icon: Users },
            { id: 'credit_list' as const, label: t('totalCreditRecords'), icon: Wallet },
            { id: 'transactions' as const, label: t('transactions'), icon: ArrowLeftRight },
            { id: 'calculator' as const, label: t('calculator'), icon: Calculator },
            { id: 'reports' as const, label: t('reportsAnalytics'), icon: BarChart3 },
            { id: 'reminders' as const, label: t('reminders'), icon: Bell, badge: pendingRemindersCount },
            { id: 'firebase_config' as const, label: t('firebaseConfig'), icon: Cloud },
            { id: 'settings' as const, label: t('settings'), icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const active = route.screen === item.id || (item.id === activeTab && isRootTab(route.screen));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge ? (
                  <span
                    className={`text-[11px] font-mono-num px-1.5 py-0.5 rounded-md ${
                      active ? 'bg-white/20 text-white' : 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t('quickActions')}</span>
          </button>

          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="w-full py-2 px-3 rounded-xl border border-violet-500/30 text-violet-600 dark:text-violet-300 text-xs font-medium flex items-center justify-center gap-2 hover:bg-violet-500/10"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install PWA App</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-14 bg-white/90 dark:bg-[#15152B]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            {!isRootTab(route.screen) && (
              <button
                type="button"
                onClick={goBack}
                aria-label={t('back')}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5 lg:hidden min-w-0">
              <Logo size={30} />
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                CREDIT LOGGER
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white capitalize">
                {route.screen.replace(/_/g, ' ')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-xs">{formatDateDDMMYYYY(todayISODate())}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                aria-label="Install app"
                className="lg:hidden min-h-[40px] px-2.5 rounded-xl bg-violet-600 text-white text-xs font-medium flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}
            {!isInstalled && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSInstall(true)}
                aria-label="Install on iOS"
                className="lg:hidden min-h-[40px] px-2.5 rounded-xl border border-violet-500/30 text-violet-600 dark:text-violet-300 text-xs font-medium"
              >
                Install
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('reminders')}
              aria-label="Open Reminders"
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Bell className="w-5 h-5" />
              {pendingRemindersCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {pendingRemindersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleQuickTheme}
              aria-label="Toggle Dark or Light Theme"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {settings.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {settings.securityPreferences.pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock Application"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('settings')}
              aria-label="Open Settings"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
          {!isOnline && (
            <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium text-amber-700 dark:text-amber-300 no-print">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Offline Mode — Local IndexedDB database active. All records are saved on your device.</span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Floating (+) Quick Action Button */}
      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        aria-label="Open Quick Action Menu"
        className="lg:hidden fixed bottom-20 right-4 z-30 h-13 w-13 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-xl shadow-violet-600/35 flex items-center justify-center active:scale-95 transition no-print"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Fixed Bottom Navigation Bar with 5 Tabs: HOME, PROFILES, TRANSACTIONS, CALCULATOR, SETTINGS */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 pb-safe bg-white/95 dark:bg-[#15152B]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 no-print"
        aria-label="Bottom Navigation"
      >
        <div className="grid grid-cols-5 h-full items-center max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate('home')}
            className={`flex flex-col items-center justify-center h-full gap-0.5 ${
              activeTab === 'home' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight truncate max-w-[70px]">{t('home')}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('profiles')}
            className={`flex flex-col items-center justify-center h-full gap-0.5 ${
              activeTab === 'profiles' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight truncate max-w-[70px]">{t('profiles')}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('transactions')}
            className={`flex flex-col items-center justify-center h-full gap-0.5 ${
              activeTab === 'transactions'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight truncate max-w-[70px]">{t('transactions')}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('calculator')}
            className={`flex flex-col items-center justify-center h-full gap-0.5 ${
              activeTab === 'calculator'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight truncate max-w-[70px]">{t('calculator')}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('settings')}
            className={`flex flex-col items-center justify-center h-full gap-0.5 ${
              activeTab === 'settings'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight truncate max-w-[70px]">{t('settings')}</span>
          </button>
        </div>
      </nav>

      {/* Quick Action Menu Modal / Sheet */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Actions"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('quickActions')}</h2>
              <button
                type="button"
                onClick={() => setQuickOpen(false)}
                aria-label="Close Quick Actions"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickAction('add_profile')}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0B18] hover:bg-violet-500/10 border border-slate-200 dark:border-white/10 text-left transition"
              >
                <div className="h-10 w-10 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('addLoanTaker')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Create a new person profile</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('add_credit')}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0B18] hover:bg-blue-500/10 border border-slate-200 dark:border-white/10 text-left transition"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('addCredit')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Issue universal credit with calendar interest</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('add_payment')}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0B18] hover:bg-emerald-500/10 border border-slate-200 dark:border-white/10 text-left transition"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ReceiptIndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('addPayment')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Adjust principal or pay accrued interest</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('normal_payment')}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0B18] hover:bg-purple-500/10 border border-slate-200 dark:border-white/10 text-left transition"
              >
                <div className="h-10 w-10 rounded-xl bg-purple-600/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('addNormalPayment')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Separate general payment (no credit change)</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Install Guide Modal */}
      {showIOSInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#15152B] p-6 shadow-xl border border-slate-200 dark:border-white/10">
            <h3 className="text-lg font-semibold">Install CREDIT LOGGER on iOS</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              1. Tap the <strong>Share</strong> icon in Safari toolbar.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSInstall(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast Stack */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-xl border backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-400/30'
                : toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-400/30'
                : 'bg-[#15152B] text-white border-violet-500/40'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};
