import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  FileDown,
  FileUp,
  Info,
  Languages,
  Lock,
  Moon,
  RefreshCw,
  Shield,
  Sun,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';
import { connectFirebaseApp, disconnectFirebaseApp } from '../services/firebaseSync';
import { isBiometricSupported, usePWAInstall } from '../services/platform';
import type { FirebaseConfig, InterestMethod, InterestPeriod, PaymentAllocationMode } from '../types';

export const SettingsHubScreen: React.FC = () => {
  const { settings, updateSettings, navigate, showToast, t } = useApp();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const fp = settings.financialPreferences;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings')}</h1>

      {/* Application Preferences */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
        <button
          type="button"
          onClick={() => navigate('language_settings')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <Languages className="w-5 h-5 text-violet-500" />
            <span>
              <div className="text-sm font-semibold">{t('languageSettings')}</div>
              <div className="text-xs text-slate-500">{settings.language === 'hi' ? 'हिन्दी (Default)' : 'English'}</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Change</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('theme_settings')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            {settings.theme === 'light' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-violet-500" />
            )}
            <span>
              <div className="text-sm font-semibold">{t('themeSettings')}</div>
              <div className="text-xs text-slate-500 capitalize">{settings.theme} Mode</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Change</span>
        </button>

        <div className="p-4 flex items-center justify-between text-xs text-slate-500">
          <span>Currency: INR (₹) · Date Format: DD/MM/YYYY</span>
        </div>
      </section>

      {/* Financial Preferences */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Financial Defaults</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Default Interest Period</label>
            <select
              value={fp.defaultInterestPeriod}
              onChange={(e) =>
                updateSettings({
                  financialPreferences: { ...fp, defaultInterestPeriod: e.target.value as InterestPeriod },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Default Interest Method</label>
            <select
              value={fp.defaultInterestMethod}
              onChange={(e) =>
                updateSettings({
                  financialPreferences: { ...fp, defaultInterestMethod: e.target.value as InterestMethod },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            >
              <option value="simple">Simple Interest (Default)</option>
              <option value="compound">Compound Interest</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Default Payment Allocation</label>
            <select
              value={fp.defaultPaymentAllocation}
              onChange={(e) =>
                updateSettings({
                  financialPreferences: {
                    ...fp,
                    defaultPaymentAllocation: e.target.value as PaymentAllocationMode,
                  },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            >
              <option value="principal_adjustment">Principal Adjustment (Misradhan Less)</option>
              <option value="interest_first">Interest First</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Decimal Precision</label>
            <select
              value={fp.decimalPrecision}
              onChange={(e) =>
                updateSettings({
                  financialPreferences: { ...fp, decimalPrecision: Number(e.target.value) as 0 | 2 },
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            >
              <option value={2}>2 Decimals (₹1,500.50)</option>
              <option value={0}>Rounded Rupees (₹1,501)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Security, Cloud & Data */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
        <button
          type="button"
          onClick={() => navigate('security_settings')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-500" />
            <span>
              <div className="text-sm font-semibold">{t('securitySettings')}</div>
              <div className="text-xs text-slate-500">
                {settings.securityPreferences.pinEnabled ? '4-Digit PIN Enabled' : 'PIN Protection Disabled'}
              </div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Manage</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('firebase_config')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-500" />
            <span>
              <div className="text-sm font-semibold">{t('firebaseConfig')}</div>
              <div className="text-xs text-slate-500">
                {settings.firebaseConfig ? `Connected: ${settings.firebaseConfig.projectId}` : 'Local IndexedDB Only'}
              </div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Configure</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('sync_status')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <Database className="w-5 h-5 text-violet-500" />
            <span>
              <div className="text-sm font-semibold">{t('syncStatus')}</div>
              <div className="text-xs text-slate-500">View cloud sync &amp; local database state</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Open</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('json_export')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <FileDown className="w-5 h-5 text-emerald-500" />
            <span>
              <div className="text-sm font-semibold">{t('jsonExport')}</div>
              <div className="text-xs text-slate-500">Download full or partial JSON backups</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Export</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('json_import')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <FileUp className="w-5 h-5 text-amber-500" />
            <span>
              <div className="text-sm font-semibold">{t('jsonImport')}</div>
              <div className="text-xs text-slate-500">Validate &amp; restore JSON backup</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Import</span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ screen: 'pdf_preview', pdfMode: 'report' })}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <FileDown className="w-5 h-5 text-purple-500" />
            <span>
              <div className="text-sm font-semibold">{t('pdfPreview')}</div>
              <div className="text-xs text-slate-500">Preview &amp; export full portfolio PDF</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">Preview</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('about')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <span className="flex items-center gap-3">
            <Info className="w-5 h-5 text-slate-500" />
            <span>
              <div className="text-sm font-semibold">{t('aboutApp')}</div>
              <div className="text-xs text-slate-500">Version, Privacy, Terms &amp; Android Build Guide</div>
            </span>
          </span>
          <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">View</span>
        </button>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-3">
        <h2 className="text-sm font-bold">Notifications</h2>
        {(
          [
            { key: 'paymentReminders', label: 'Payment Reminders' },
            { key: 'overdueAlerts', label: 'Overdue Alerts' },
            { key: 'backupReminders', label: 'Backup Reminders' },
          ] as const
        ).map((item) => (
          <label key={item.key} className="flex items-center justify-between text-sm cursor-pointer">
            <span>{item.label}</span>
            <input
              type="checkbox"
              checked={settings.notificationPreferences[item.key]}
              onChange={(e) => {
                updateSettings({
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    [item.key]: e.target.checked,
                  },
                });
                showToast('Preference saved', 'success');
              }}
              className="w-4 h-4 accent-violet-600"
            />
          </label>
        ))}
      </section>

      {!isInstalled && isInstallable && (
        <button
          type="button"
          onClick={install}
          className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold"
        >
          Install CREDIT LOGGER as App (PWA)
        </button>
      )}
    </div>
  );
};

export const SecuritySettingsScreen: React.FC = () => {
  const { settings, setPinCode, disablePinCode, updateSettings, lockApp, showToast, t } = useApp();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setBioAvailable);
  }, []);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    await setPinCode(pin);
    setPin('');
    setConfirmPin('');
    setError('');
    showToast('4-digit PIN saved securely (SHA-256 hashed)', 'success');
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Lock className="w-6 h-6 text-violet-500" />
          <div>
            <h1 className="text-xl font-bold">{t('securitySettings')}</h1>
            <p className="text-xs text-slate-500">Salted SHA-256 PIN protection — never stored in plain text</p>
          </div>
        </div>

        <form onSubmit={handleSetPin} className="space-y-3">
          <div>
            <label htmlFor="pin-1" className="block text-xs font-medium mb-1">
              {settings.securityPreferences.pinEnabled ? 'New 4-Digit PIN' : 'Set 4-Digit PIN'}
            </label>
            <input
              id="pin-1"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num tracking-widest"
            />
          </div>
          <div>
            <label htmlFor="pin-2" className="block text-xs font-medium mb-1">
              Confirm 4-Digit PIN
            </label>
            <input
              id="pin-2"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num tracking-widest"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold">
            {settings.securityPreferences.pinEnabled ? 'Change PIN' : 'Enable PIN Lock'}
          </button>
        </form>

        {settings.securityPreferences.pinEnabled && (
          <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Auto-Lock Timeout</span>
              <select
                value={settings.securityPreferences.autoLockMinutes}
                onChange={(e) =>
                  updateSettings({
                    securityPreferences: {
                      ...settings.securityPreferences,
                      autoLockMinutes: Number(e.target.value),
                    },
                  })
                }
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-1.5 text-xs"
              >
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={0}>Manual Only</option>
              </select>
            </div>

            <label className="flex items-center justify-between text-sm">
              <span>Biometric Unlock {bioAvailable ? '(Supported)' : '(Device dependent)'}</span>
              <input
                type="checkbox"
                checked={settings.securityPreferences.biometricEnabled}
                onChange={(e) =>
                  updateSettings({
                    securityPreferences: {
                      ...settings.securityPreferences,
                      biometricEnabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 accent-violet-600"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={lockApp}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                Lock App Now
              </button>
              <button
                type="button"
                onClick={async () => {
                  await disablePinCode();
                  showToast('PIN protection disabled', 'info');
                }}
                className="px-4 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-semibold"
              >
                Disable PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const LanguageSettingsScreen: React.FC = () => {
  const { settings, setLanguage, showToast, t } = useApp();
  return (
    <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
      <h1 className="text-xl font-bold">{t('languageSettings')}</h1>
      <div className="space-y-2">
        {(
          [
            { code: 'hi', title: 'हिन्दी (Hindi)', sub: 'Default application language' },
            { code: 'en', title: 'English', sub: 'International financial terminology' },
          ] as const
        ).map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={async () => {
              await setLanguage(item.code);
              showToast(`Language changed to ${item.title}`, 'success');
            }}
            className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
              settings.language === item.code
                ? 'border-violet-600 bg-violet-600/10'
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            <div>
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-xs text-slate-500">{item.sub}</div>
            </div>
            {settings.language === item.code && <CheckCircle2 className="w-5 h-5 text-violet-500" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export const ThemeSettingsScreen: React.FC = () => {
  const { settings, setTheme, showToast, t } = useApp();
  return (
    <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
      <h1 className="text-xl font-bold">{t('themeSettings')}</h1>
      <div className="space-y-2">
        {(
          [
            { id: 'dark', title: t('darkTheme'), sub: 'Deep navy & violet fintech workspace (#0B0B18)' },
            { id: 'light', title: t('lightTheme'), sub: 'Crisp white cards on soft violet canvas (#F5F6FC)' },
            { id: 'system', title: t('systemTheme'), sub: 'Follows device dark/light preference' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={async () => {
              await setTheme(item.id);
              showToast(`Theme set to ${item.id}`, 'success');
            }}
            className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
              settings.theme === item.id
                ? 'border-violet-600 bg-violet-600/10'
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            <div>
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-xs text-slate-500">{item.sub}</div>
            </div>
            {settings.theme === item.id && <CheckCircle2 className="w-5 h-5 text-violet-500" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export const FirebaseConfigScreen: React.FC = () => {
  const { settings, updateSettings, runCloudSyncNow, navigate, showToast, t } = useApp();
  const [form, setForm] = useState<FirebaseConfig>(
    settings.firebaseConfig || {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    }
  );
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleConnect = async () => {
    setTesting(true);
    setStatusMsg('');
    const res = await connectFirebaseApp(form);
    setTesting(false);
    if (res.ok) {
      await updateSettings({ firebaseConfig: form });
      setStatusMsg(`Connected to Firebase project "${form.projectId}" (UID: ${res.uid})`);
      showToast('Firebase connected', 'success');
    } else {
      setStatusMsg(`Connection failed: ${res.error}`);
      showToast(res.error || 'Connection failed', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('firebaseConfig')}</h1>
            <p className="text-xs text-slate-500">
              Firebase is optional. Without Firebase, all data stays safely in local IndexedDB offline.
            </p>
          </div>
          {settings.firebaseConfig ? (
            <Cloud className="w-6 h-6 text-emerald-500" />
          ) : (
            <CloudOff className="w-6 h-6 text-slate-400" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              { key: 'apiKey', label: 'API Key' },
              { key: 'authDomain', label: 'Auth Domain' },
              { key: 'projectId', label: 'Project ID' },
              { key: 'storageBucket', label: 'Storage Bucket' },
              { key: 'messagingSenderId', label: 'Messaging Sender ID' },
              { key: 'appId', label: 'App ID' },
            ] as const
          ).map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium mb-1">{field.label}</label>
              <input
                type="text"
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs font-mono-num"
              />
            </div>
          ))}
        </div>

        {statusMsg && (
          <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-3 text-xs">
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={testing}
            onClick={handleConnect}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
          >
            {testing ? 'Testing...' : 'Connect & Test'}
          </button>
          <button
            type="button"
            disabled={!settings.firebaseConfig}
            onClick={async () => {
              const res = await runCloudSyncNow();
              setStatusMsg(res.message);
              showToast(res.message, res.ok ? 'success' : 'error');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40"
          >
            Sync Now
          </button>
          <button
            type="button"
            onClick={() => navigate('sync_status')}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
          >
            View Sync Status
          </button>
          {settings.firebaseConfig && (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-semibold"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDisconnect}
        danger
        title="Disconnect Firebase?"
        message="Local data in IndexedDB will remain safe. Remember to export a JSON backup before changing cloud configuration."
        confirmLabel="Disconnect"
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={async () => {
          setConfirmDisconnect(false);
          await disconnectFirebaseApp();
          await updateSettings({ firebaseConfig: null });
          setStatusMsg('Disconnected. Local-only mode active.');
          showToast('Firebase disconnected', 'info');
        }}
      />
    </div>
  );
};

export const SyncStatusScreen: React.FC = () => {
  const { settings, syncLog, runCloudSyncNow, profiles, credits, payments, showToast, t } = useApp();
  const [syncing, setSyncing] = useState(false);

  return (
    <div className="max-w-xl mx-auto rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
      <h1 className="text-xl font-bold">{t('syncStatus')}</h1>
      <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
        <div className="py-2.5 flex justify-between">
          <span className="text-slate-500">Mode</span>
          <span className="font-semibold">
            {settings.firebaseConfig ? 'Firebase Cloud + Local IndexedDB' : 'Local-Only (IndexedDB)'}
          </span>
        </div>
        <div className="py-2.5 flex justify-between">
          <span className="text-slate-500">Last Sync Time</span>
          <span className="font-mono-num text-xs">{settings.lastSyncAt || 'Not synced yet'}</span>
        </div>
        <div className="py-2.5 flex justify-between">
          <span className="text-slate-500">Local Records</span>
          <span className="font-mono-num text-xs">
            {profiles.length} Profiles · {credits.length} Credits · {payments.length} Payments
          </span>
        </div>
        <div className="py-2.5 flex justify-between">
          <span className="text-slate-500">Status</span>
          <span className="text-xs font-medium">{syncLog.message}</span>
        </div>
      </div>

      {syncLog.conflicts.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1">
          <div className="font-bold">Conflict Resolution Log</div>
          {syncLog.conflicts.map((c, i) => (
            <div key={i}>• {c}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={syncing || !settings.firebaseConfig}
        onClick={async () => {
          setSyncing(true);
          const res = await runCloudSyncNow();
          setSyncing(false);
          showToast(res.message, res.ok ? 'success' : 'error');
        }}
        className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
      </button>
    </div>
  );
};

export const AboutScreen: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Logo size={52} />
          <div>
            <h1 className="text-xl font-extrabold">CREDIT LOGGER</h1>
            <p className="text-xs text-slate-500">Version 1.0.0 · Universal Credit &amp; Interest Ledger</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          CREDIT LOGGER is an offline-first financial ledger built with an exact calendar-based interest engine,
          principal adjustment tracking, normal payment separation, JSON backup/restore, PDF statements, and optional
          Firebase cloud sync.
        </p>
        <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-4 text-xs space-y-2">
          <div className="font-bold text-slate-900 dark:text-white">Privacy &amp; Data Safety</div>
          <p className="text-slate-500 dark:text-slate-400">
            All financial records are stored locally on your device in IndexedDB (and SQLite on Capacitor Android).
            PIN codes are salted and hashed via SHA-256. No third-party tracking or external servers are used unless
            you explicitly configure your own Firebase project.
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-4 text-xs space-y-1.5">
          <div className="font-bold text-slate-900 dark:text-white">Android APK Build Instructions</div>
          <p className="text-slate-500 dark:text-slate-400 font-mono-num">
            npm run build &amp;&amp; npx cap add android &amp;&amp; npx cap sync android &amp;&amp; npx cap open android
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            See ANDROID_BUILD.md in the project root for full Capacitor plugin setup and signing instructions.
          </p>
        </div>
      </div>
    </div>
  );
};
