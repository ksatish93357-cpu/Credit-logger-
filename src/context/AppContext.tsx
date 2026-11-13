import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createSampleSeedData,
  DEFAULT_SETTINGS,
  loadAllDatabaseData,
  replaceAllDatabaseData,
  runAtomicWrite,
  type FullDatabaseSnapshot,
} from '../db/indexedDb';
import {
  calculateDashboardSummary,
  generateAutoPaymentNote,
  previewCreditPayment,
  reconstructCreditState,
} from '../engine/finance';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { syncWithFirestore } from '../services/firebaseSync';
import type {
  AuditLog,
  ComputedDashboardSummary,
  Credit,
  CreditAdjustment,
  DateFilterRange,
  InterestMethod,
  InterestPeriod,
  LanguageCode,
  Payment,
  PaymentAllocationMode,
  PaymentMethod,
  Profile,
  Reminder,
  RouteState,
  ScreenName,
  Settings,
  ThemeMode,
  Transaction,
} from '../types';
import { generateId, sha256Hash, todayISODate } from '../utils/format';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface PendingPaymentDraft {
  profileId: string;
  creditId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  allocationMode: PaymentAllocationMode;
  note: string;
}

interface AppContextValue {
  loading: boolean;
  isLocked: boolean;
  showSplash: boolean;
  dismissSplash: () => void;
  route: RouteState;
  navigate: (screen: ScreenName | RouteState) => void;
  goBack: () => void;
  profiles: Profile[];
  credits: Credit[];
  payments: Payment[];
  creditAdjustments: CreditAdjustment[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  reminders: Reminder[];
  settings: Settings;
  dashboard: ComputedDashboardSummary;
  dateFilter: DateFilterRange;
  setDateFilter: (f: DateFilterRange) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  pendingPaymentDraft: PendingPaymentDraft | null;
  setPendingPaymentDraft: (draft: PendingPaymentDraft | null) => void;
  syncLog: { lastRunAt: string | null; status: 'local' | 'synced' | 'error'; message: string; conflicts: string[] };
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  t: (key: TranslationKey) => string;
  nextCreditNumber: () => string;
  nextReceiptNumber: (type: 'credit_payment' | 'normal_payment') => string;
  // Mutations
  addProfile: (data: { name: string; phone: string; address: string; photo: string; note: string }) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<void>;
  archiveProfile: (id: string) => Promise<void>;
  restoreProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  addCredit: (data: {
    profileId: string;
    creditNumber: string;
    principal: number;
    interestRate: number;
    interestPeriod: InterestPeriod;
    interestMethod: InterestMethod;
    startDate: string;
    note: string;
  }) => Promise<Credit>;
  updateCreditInfo: (id: string, data: { creditNumber: string; note: string; startDate: string }) => Promise<void>;
  applyMainCreditUpdate: (data: {
    creditId: string;
    newPrincipal: number;
    newInterestRate: number;
    newInterestPeriod: InterestPeriod;
    effectiveDate: string;
    note: string;
  }) => Promise<void>;
  closeCredit: (id: string, closedDate?: string) => Promise<void>;
  reopenCredit: (id: string) => Promise<void>;
  archiveCredit: (id: string) => Promise<void>;
  deleteCredit: (id: string) => Promise<void>;
  recordCreditPayment: (draft: PendingPaymentDraft) => Promise<{ payment: Payment; shouldOfferClose: boolean }>;
  recordNormalPayment: (data: {
    profileId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    note: string;
  }) => Promise<Payment>;
  editCreditPayment: (data: {
    paymentId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    allocationMode: PaymentAllocationMode;
    note: string;
  }) => Promise<void>;
  reversePayment: (paymentId: string, reason?: string) => Promise<void>;
  addReminder: (data: {
    profileId: string;
    creditId: string | null;
    reminderDate: string;
    reminderTime: string;
    note: string;
  }) => Promise<Reminder>;
  updateReminder: (id: string, data: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  setPinCode: (pin: string) => Promise<void>;
  disablePinCode: () => Promise<void>;
  verifyPinCode: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  unlockBiometric: () => void;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  loadDemoData: () => Promise<void>;
  importBundleData: (
    snapshot: Partial<Omit<FullDatabaseSnapshot, 'settings'>> & { settings?: Partial<Settings> },
    mode: 'merge' | 'replace'
  ) => Promise<void>;
  runCloudSyncNow: () => Promise<{ ok: boolean; message: string }>;
  getFullSnapshot: () => FullDatabaseSnapshot;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return false;
    }
    return true;
  });
  const [isLocked, setIsLocked] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [creditAdjustments, setCreditAdjustments] = useState<CreditAdjustment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [history, setHistory] = useState<RouteState[]>([{ screen: 'home' }]);
  const [dateFilter, setDateFilter] = useState<DateFilterRange>({ preset: 'all' });
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingPaymentDraft, setPendingPaymentDraft] = useState<PendingPaymentDraft | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [syncLog, setSyncLog] = useState<{
    lastRunAt: string | null;
    status: 'local' | 'synced' | 'error';
    message: string;
    conflicts: string[];
  }>({
    lastRunAt: null,
    status: 'local',
    message: 'Offline-first IndexedDB active',
    conflicts: [],
  });

  const route = history[history.length - 1] || { screen: 'home' };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = generateId('toast');
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  // Load IndexedDB on mount
  useEffect(() => {
    let active = true;
    loadAllDatabaseData()
      .then((data) => {
        if (!active) return;
        setProfiles(data.profiles);
        setCredits(data.credits);
        setPayments(data.payments);
        setCreditAdjustments(data.creditAdjustments);
        setTransactions(data.transactions);
        setAuditLogs(data.auditLogs);
        setReminders(data.reminders);
        setSettings(data.settings);
        if (data.settings.securityPreferences.pinEnabled && data.settings.securityPreferences.pinHash) {
          setIsLocked(true);
        }
        if (data.settings.firebaseConfig) {
          setSyncLog({
            lastRunAt: data.settings.lastSyncAt,
            status: 'synced',
            message: 'Firebase configured',
            conflicts: [],
          });
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        showToast('Failed to open local database', 'error');
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  // Splash auto-dismiss
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(timer);
  }, [showSplash]);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: 'dark' | 'light') => {
      if (mode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      apply(settings.theme);
    }
  }, [settings.theme]);

  // Auto-lock on inactivity if PIN enabled
  useEffect(() => {
    if (!settings.securityPreferences.pinEnabled || !settings.securityPreferences.autoLockMinutes) return;
    const ms = settings.securityPreferences.autoLockMinutes * 60 * 1000;
    let timer = setTimeout(() => setIsLocked(true), ms);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsLocked(true), ms);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [settings.securityPreferences.pinEnabled, settings.securityPreferences.autoLockMinutes]);

  const navigate = useCallback((next: ScreenName | RouteState) => {
    const target: RouteState = typeof next === 'string' ? { screen: next } : next;
    setHistory((prev) => {
      const top = prev[prev.length - 1];
      if (
        top &&
        top.screen === target.screen &&
        top.profileId === target.profileId &&
        top.creditId === target.creditId &&
        top.paymentId === target.paymentId &&
        top.transactionId === target.transactionId &&
        top.pdfMode === target.pdfMode
      ) {
        return prev;
      }
      return [...prev.slice(-24), target];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ screen: 'home' }]));
  }, []);

  const t = useCallback(
    (key: TranslationKey) => getTranslation(settings.language, key),
    [settings.language]
  );

  const dashboard = useMemo(
    () =>
      calculateDashboardSummary(
        profiles,
        credits,
        creditAdjustments,
        payments,
        reminders,
        todayISODate(),
        dateFilter,
        settings.financialPreferences.decimalPrecision
      ),
    [profiles, credits, creditAdjustments, payments, reminders, dateFilter, settings.financialPreferences.decimalPrecision]
  );

  const nextCreditNumber = useCallback(() => {
    let maxNum = 0;
    for (const c of credits) {
      const m = /^CL-(\d+)$/i.exec(c.creditNumber.trim());
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    return `CL-${String(maxNum + 1).padStart(4, '0')}`;
  }, [credits]);

  const nextReceiptNumber = useCallback(
    (type: 'credit_payment' | 'normal_payment') => {
      const prefix = type === 'normal_payment' ? 'NRM' : 'RCP';
      let maxNum = 0;
      for (const p of payments) {
        const m = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(p.receiptNumber.trim());
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
      }
      return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
    },
    [payments]
  );

  const addProfile = useCallback(
    async (data: { name: string; phone: string; address: string; photo: string; note: string }) => {
      const now = new Date().toISOString();
      const profile: Profile = {
        id: generateId('prof'),
        name: data.name.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        photo: data.photo,
        note: data.note.trim(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'profile',
        entityId: profile.id,
        action: 'create',
        previousData: null,
        newData: JSON.stringify(profile),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'profiles', op: 'put', value: profile },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setProfiles((prev) => [profile, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
      return profile;
    },
    []
  );

  const updateProfile = useCallback(
    async (id: string, data: Partial<Profile>) => {
      const existing = profiles.find((p) => p.id === id);
      if (!existing) return;
      const now = new Date().toISOString();
      const updated: Profile = { ...existing, ...data, updatedAt: now };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'profile',
        entityId: id,
        action: 'update',
        previousData: JSON.stringify(existing),
        newData: JSON.stringify(updated),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'profiles', op: 'put', value: updated },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [profiles]
  );

  const archiveProfile = useCallback(
    async (id: string) => {
      await updateProfile(id, { archivedAt: new Date().toISOString() });
    },
    [updateProfile]
  );

  const restoreProfile = useCallback(
    async (id: string) => {
      await updateProfile(id, { archivedAt: null });
    },
    [updateProfile]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      const existing = profiles.find((p) => p.id === id);
      if (!existing) return;
      const profileCredits = credits.filter((c) => c.profileId === id);
      const profileCreditIds = new Set(profileCredits.map((c) => c.id));
      const profilePayments = payments.filter((p) => p.profileId === id);
      const profileAdj = creditAdjustments.filter((a) => profileCreditIds.has(a.creditId));
      const profileTx = transactions.filter((tx) => tx.profileId === id);
      const profileRem = reminders.filter((r) => r.profileId === id);

      const now = new Date().toISOString();
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'profile',
        entityId: id,
        action: 'delete',
        previousData: JSON.stringify(existing),
        newData: null,
        timestamp: now,
      };

      const writes: Parameters<typeof runAtomicWrite>[0] = [
        { store: 'profiles', op: 'delete', id },
        ...profileCredits.map((c) => ({ store: 'credits' as const, op: 'delete' as const, id: c.id })),
        ...profilePayments.map((p) => ({ store: 'payments' as const, op: 'delete' as const, id: p.id })),
        ...profileAdj.map((a) => ({ store: 'creditAdjustments' as const, op: 'delete' as const, id: a.id })),
        ...profileTx.map((tx) => ({ store: 'transactions' as const, op: 'delete' as const, id: tx.id })),
        ...profileRem.map((r) => ({ store: 'reminders' as const, op: 'delete' as const, id: r.id })),
        { store: 'auditLogs', op: 'put', value: audit },
      ];
      await runAtomicWrite(writes);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setCredits((prev) => prev.filter((c) => c.profileId !== id));
      setPayments((prev) => prev.filter((p) => p.profileId !== id));
      setCreditAdjustments((prev) => prev.filter((a) => !profileCreditIds.has(a.creditId)));
      setTransactions((prev) => prev.filter((tx) => tx.profileId !== id));
      setReminders((prev) => prev.filter((r) => r.profileId !== id));
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [profiles, credits, payments, creditAdjustments, transactions, reminders]
  );

  const addCredit = useCallback(
    async (data: {
      profileId: string;
      creditNumber: string;
      principal: number;
      interestRate: number;
      interestPeriod: InterestPeriod;
      interestMethod: InterestMethod;
      startDate: string;
      note: string;
    }) => {
      const now = new Date().toISOString();
      const credit: Credit = {
        id: generateId('cred'),
        profileId: data.profileId,
        creditNumber: data.creditNumber.trim(),
        originalPrincipal: data.principal,
        currentPrincipal: data.principal,
        interestRate: data.interestRate,
        interestPeriod: data.interestPeriod,
        interestMethod: data.interestMethod,
        startDate: data.startDate,
        status: 'active',
        closedDate: null,
        note: data.note.trim(),
        createdAt: now,
        updatedAt: now,
      };
      const tx: Transaction = {
        id: generateId('tx'),
        profileId: data.profileId,
        creditId: credit.id,
        paymentId: null,
        transactionType: 'credit_created',
        amount: data.principal,
        effectiveDate: data.startDate,
        previousPrincipal: 0,
        previousInterest: 0,
        previousMisradhan: 0,
        newPrincipal: data.principal,
        description: `Credit ${credit.creditNumber} created for ₹${data.principal} @ ${data.interestRate}% (${data.interestPeriod})`,
        createdAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: credit.id,
        action: 'create',
        previousData: null,
        newData: JSON.stringify(credit),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'put', value: credit },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => [credit, ...prev]);
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
      return credit;
    },
    []
  );

  const updateCreditInfo = useCallback(
    async (id: string, data: { creditNumber: string; note: string; startDate: string }) => {
      const existing = credits.find((c) => c.id === id);
      if (!existing) return;
      const now = new Date().toISOString();
      const updated: Credit = {
        ...existing,
        creditNumber: data.creditNumber.trim(),
        note: data.note.trim(),
        startDate: data.startDate,
        updatedAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: id,
        action: 'edit_info',
        previousData: JSON.stringify(existing),
        newData: JSON.stringify(updated),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'put', value: updated },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits]
  );

  const applyMainCreditUpdate = useCallback(
    async (data: {
      creditId: string;
      newPrincipal: number;
      newInterestRate: number;
      newInterestPeriod: InterestPeriod;
      effectiveDate: string;
      note: string;
    }) => {
      const credit = credits.find((c) => c.id === data.creditId);
      if (!credit) return;
      const now = new Date().toISOString();
      const precision = settings.financialPreferences.decimalPrecision;
      const stateAtDate = reconstructCreditState(credit, creditAdjustments, payments, data.effectiveDate, precision);

      const adjustment: CreditAdjustment = {
        id: generateId('adj'),
        creditId: credit.id,
        previousPrincipal: stateAtDate.currentPrincipal,
        newPrincipal: data.newPrincipal,
        previousInterestRate: stateAtDate.activeInterestRate,
        newInterestRate: data.newInterestRate,
        previousInterestPeriod: stateAtDate.activeInterestPeriod,
        newInterestPeriod: data.newInterestPeriod,
        effectiveDate: data.effectiveDate,
        note: data.note.trim(),
        createdAt: now,
      };

      const nextAdjustments = [...creditAdjustments, adjustment];
      const updatedState = reconstructCreditState(credit, nextAdjustments, payments, todayISODate(), precision);
      const updatedCredit: Credit = {
        ...credit,
        currentPrincipal: updatedState.currentPrincipal,
        updatedAt: now,
      };

      const txType =
        data.newPrincipal !== stateAtDate.currentPrincipal
          ? 'principal_adjustment'
          : 'interest_rate_update';

      const tx: Transaction = {
        id: generateId('tx'),
        profileId: credit.profileId,
        creditId: credit.id,
        paymentId: null,
        transactionType: txType,
        amount: data.newPrincipal,
        effectiveDate: data.effectiveDate,
        previousPrincipal: stateAtDate.currentPrincipal,
        previousInterest: stateAtDate.totalInterest,
        previousMisradhan: stateAtDate.totalMisradhan,
        newPrincipal: data.newPrincipal,
        description: `Main Update on ${credit.creditNumber}: Principal ₹${stateAtDate.currentPrincipal} -> ₹${data.newPrincipal}, Rate ${data.newInterestRate}% (${data.newInterestPeriod})`,
        createdAt: now,
      };

      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'adjustment',
        entityId: adjustment.id,
        action: 'main_credit_update',
        previousData: JSON.stringify(stateAtDate),
        newData: JSON.stringify(adjustment),
        timestamp: now,
      };

      await runAtomicWrite([
        { store: 'creditAdjustments', op: 'put', value: adjustment },
        { store: 'credits', op: 'put', value: updatedCredit },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);

      setCreditAdjustments(nextAdjustments);
      setCredits((prev) => prev.map((c) => (c.id === credit.id ? updatedCredit : c)));
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits, creditAdjustments, payments, settings.financialPreferences.decimalPrecision]
  );

  const closeCredit = useCallback(
    async (id: string, closedDate: string = todayISODate()) => {
      const credit = credits.find((c) => c.id === id);
      if (!credit) return;
      const now = new Date().toISOString();
      const updated: Credit = { ...credit, status: 'closed', closedDate, updatedAt: now };
      const tx: Transaction = {
        id: generateId('tx'),
        profileId: credit.profileId,
        creditId: credit.id,
        paymentId: null,
        transactionType: 'credit_closed',
        amount: 0,
        effectiveDate: closedDate,
        previousPrincipal: credit.currentPrincipal,
        previousInterest: 0,
        previousMisradhan: credit.currentPrincipal,
        newPrincipal: 0,
        description: `Credit ${credit.creditNumber} closed`,
        createdAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: id,
        action: 'close',
        previousData: JSON.stringify(credit),
        newData: JSON.stringify(updated),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'put', value: updated },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits]
  );

  const reopenCredit = useCallback(
    async (id: string) => {
      const credit = credits.find((c) => c.id === id);
      if (!credit) return;
      const now = new Date().toISOString();
      const updated: Credit = { ...credit, status: 'active', closedDate: null, updatedAt: now };
      const tx: Transaction = {
        id: generateId('tx'),
        profileId: credit.profileId,
        creditId: credit.id,
        paymentId: null,
        transactionType: 'credit_reopened',
        amount: 0,
        effectiveDate: todayISODate(),
        previousPrincipal: credit.currentPrincipal,
        previousInterest: 0,
        previousMisradhan: credit.currentPrincipal,
        newPrincipal: credit.currentPrincipal,
        description: `Credit ${credit.creditNumber} reopened`,
        createdAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: id,
        action: 'reopen',
        previousData: JSON.stringify(credit),
        newData: JSON.stringify(updated),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'put', value: updated },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits]
  );

  const archiveCredit = useCallback(
    async (id: string) => {
      const credit = credits.find((c) => c.id === id);
      if (!credit) return;
      const now = new Date().toISOString();
      const updated: Credit = { ...credit, status: 'archived', updatedAt: now };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: id,
        action: 'archive',
        previousData: JSON.stringify(credit),
        newData: JSON.stringify(updated),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'put', value: updated },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits]
  );

  const deleteCredit = useCallback(
    async (id: string) => {
      const credit = credits.find((c) => c.id === id);
      if (!credit) return;
      const now = new Date().toISOString();
      const relPayments = payments.filter((p) => p.creditId === id);
      const relAdj = creditAdjustments.filter((a) => a.creditId === id);
      const relTx = transactions.filter((tx) => tx.creditId === id);
      const relRem = reminders.filter((r) => r.creditId === id);
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'credit',
        entityId: id,
        action: 'delete',
        previousData: JSON.stringify(credit),
        newData: null,
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'credits', op: 'delete', id },
        ...relPayments.map((p) => ({ store: 'payments' as const, op: 'delete' as const, id: p.id })),
        ...relAdj.map((a) => ({ store: 'creditAdjustments' as const, op: 'delete' as const, id: a.id })),
        ...relTx.map((tx) => ({ store: 'transactions' as const, op: 'delete' as const, id: tx.id })),
        ...relRem.map((r) => ({ store: 'reminders' as const, op: 'delete' as const, id: r.id })),
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setCredits((prev) => prev.filter((c) => c.id !== id));
      setPayments((prev) => prev.filter((p) => p.creditId !== id));
      setCreditAdjustments((prev) => prev.filter((a) => a.creditId !== id));
      setTransactions((prev) => prev.filter((tx) => tx.creditId !== id));
      setReminders((prev) => prev.filter((r) => r.creditId !== id));
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [credits, payments, creditAdjustments, transactions, reminders]
  );

  const recordCreditPayment = useCallback(
    async (draft: PendingPaymentDraft) => {
      const credit = credits.find((c) => c.id === draft.creditId);
      if (!credit) throw new Error('Credit not found');
      const precision = settings.financialPreferences.decimalPrecision;
      const alloc = previewCreditPayment({
        credit,
        adjustments: creditAdjustments,
        payments,
        amount: draft.amount,
        paymentDate: draft.paymentDate,
        allocationMode: draft.allocationMode,
        precision,
      });

      const autoNote = generateAutoPaymentNote({
        creditNumber: credit.creditNumber,
        paymentAmount: draft.amount,
        paymentDate: draft.paymentDate,
        allocation: alloc,
        allocationMode: draft.allocationMode,
        precision,
      });
      const combinedNote = draft.note.trim() ? `${autoNote}\nManual Note: ${draft.note.trim()}` : autoNote;

      const now = new Date().toISOString();
      const receiptNumber = nextReceiptNumber('credit_payment');
      const payment: Payment = {
        id: generateId('pay'),
        profileId: draft.profileId,
        creditId: draft.creditId,
        paymentType: 'credit_payment',
        amount: draft.amount,
        paymentDate: draft.paymentDate,
        paymentMethod: draft.paymentMethod,
        allocationMode: draft.allocationMode,
        previousPrincipal: alloc.previousPrincipal,
        previousInterest: alloc.accruedInterest,
        previousMisradhan: alloc.previousMisradhan,
        newPrincipal: alloc.newPrincipal,
        note: combinedNote,
        receiptNumber,
        reversed: false,
        reversedAt: null,
        createdAt: now,
      };

      const nextPayments = [...payments, payment];
      const recomputed = reconstructCreditState(credit, creditAdjustments, nextPayments, todayISODate(), precision);
      const updatedCredit: Credit = {
        ...credit,
        currentPrincipal: recomputed.currentPrincipal,
        updatedAt: now,
      };

      const tx: Transaction = {
        id: generateId('tx'),
        profileId: draft.profileId,
        creditId: draft.creditId,
        paymentId: payment.id,
        transactionType: 'credit_payment',
        amount: draft.amount,
        effectiveDate: draft.paymentDate,
        previousPrincipal: alloc.previousPrincipal,
        previousInterest: alloc.accruedInterest,
        previousMisradhan: alloc.previousMisradhan,
        newPrincipal: alloc.newPrincipal,
        paymentMethod: draft.paymentMethod,
        receiptNumber,
        description: `Payment ${receiptNumber} on ${credit.creditNumber}: ₹${draft.amount}`,
        createdAt: now,
      };

      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'payment',
        entityId: payment.id,
        action: 'create_credit_payment',
        previousData: null,
        newData: JSON.stringify(payment),
        timestamp: now,
      };

      await runAtomicWrite([
        { store: 'payments', op: 'put', value: payment },
        { store: 'credits', op: 'put', value: updatedCredit },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);

      setPayments(nextPayments);
      setCredits((prev) => prev.map((c) => (c.id === credit.id ? updatedCredit : c)));
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);

      return { payment, shouldOfferClose: alloc.shouldOfferClose };
    },
    [credits, creditAdjustments, payments, settings.financialPreferences.decimalPrecision, nextReceiptNumber]
  );

  const recordNormalPayment = useCallback(
    async (data: {
      profileId: string;
      amount: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      note: string;
    }) => {
      const now = new Date().toISOString();
      const receiptNumber = nextReceiptNumber('normal_payment');
      const payment: Payment = {
        id: generateId('pay'),
        profileId: data.profileId,
        creditId: null,
        paymentType: 'normal_payment',
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        allocationMode: null,
        previousPrincipal: 0,
        previousInterest: 0,
        previousMisradhan: 0,
        newPrincipal: 0,
        note: data.note.trim() || 'Normal Payment (Does not affect credit principal or interest)',
        receiptNumber,
        reversed: false,
        reversedAt: null,
        createdAt: now,
      };
      const tx: Transaction = {
        id: generateId('tx'),
        profileId: data.profileId,
        creditId: null,
        paymentId: payment.id,
        transactionType: 'normal_payment',
        amount: data.amount,
        effectiveDate: data.paymentDate,
        previousPrincipal: 0,
        previousInterest: 0,
        previousMisradhan: 0,
        newPrincipal: 0,
        paymentMethod: data.paymentMethod,
        receiptNumber,
        description: `Normal Payment ${receiptNumber}: ₹${data.amount}`,
        createdAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'payment',
        entityId: payment.id,
        action: 'create_normal_payment',
        previousData: null,
        newData: JSON.stringify(payment),
        timestamp: now,
      };
      await runAtomicWrite([
        { store: 'payments', op: 'put', value: payment },
        { store: 'transactions', op: 'put', value: tx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);
      setPayments((prev) => [payment, ...prev]);
      setTransactions((prev) => [tx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
      return payment;
    },
    [nextReceiptNumber]
  );

  const editCreditPayment = useCallback(
    async (data: {
      paymentId: string;
      amount: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      allocationMode: PaymentAllocationMode;
      note: string;
    }) => {
      const existing = payments.find((p) => p.id === data.paymentId);
      if (!existing || !existing.creditId) return;
      const credit = credits.find((c) => c.id === existing.creditId);
      if (!credit) return;

      const precision = settings.financialPreferences.decimalPrecision;
      const now = new Date().toISOString();

      const otherPayments = payments.filter((p) => p.id !== existing.id);
      const alloc = previewCreditPayment({
        credit,
        adjustments: creditAdjustments,
        payments: otherPayments,
        amount: data.amount,
        paymentDate: data.paymentDate,
        allocationMode: data.allocationMode,
        precision,
      });

      const updatedPayment: Payment = {
        ...existing,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        allocationMode: data.allocationMode,
        previousPrincipal: alloc.previousPrincipal,
        previousInterest: alloc.accruedInterest,
        previousMisradhan: alloc.previousMisradhan,
        newPrincipal: alloc.newPrincipal,
        note: data.note.trim() || existing.note,
      };

      const nextPayments = payments.map((p) => (p.id === existing.id ? updatedPayment : p));
      const recomputed = reconstructCreditState(credit, creditAdjustments, nextPayments, todayISODate(), precision);
      const updatedCredit: Credit = { ...credit, currentPrincipal: recomputed.currentPrincipal, updatedAt: now };

      const corrTx: Transaction = {
        id: generateId('tx'),
        profileId: credit.profileId,
        creditId: credit.id,
        paymentId: existing.id,
        transactionType: 'correction',
        amount: data.amount,
        effectiveDate: data.paymentDate,
        previousPrincipal: alloc.previousPrincipal,
        previousInterest: alloc.accruedInterest,
        previousMisradhan: alloc.previousMisradhan,
        newPrincipal: alloc.newPrincipal,
        paymentMethod: data.paymentMethod,
        receiptNumber: existing.receiptNumber,
        description: `Edited payment ${existing.receiptNumber}: ₹${existing.amount} -> ₹${data.amount}`,
        createdAt: now,
      };

      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'payment',
        entityId: existing.id,
        action: 'edit_payment',
        previousData: JSON.stringify(existing),
        newData: JSON.stringify(updatedPayment),
        timestamp: now,
      };

      await runAtomicWrite([
        { store: 'payments', op: 'put', value: updatedPayment },
        { store: 'credits', op: 'put', value: updatedCredit },
        { store: 'transactions', op: 'put', value: corrTx },
        { store: 'auditLogs', op: 'put', value: audit },
      ]);

      setPayments(nextPayments);
      setCredits((prev) => prev.map((c) => (c.id === credit.id ? updatedCredit : c)));
      setTransactions((prev) => [corrTx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [payments, credits, creditAdjustments, settings.financialPreferences.decimalPrecision]
  );

  const reversePayment = useCallback(
    async (paymentId: string, reason = 'Reversed by user') => {
      const existing = payments.find((p) => p.id === paymentId);
      if (!existing || existing.reversed) return;
      const now = new Date().toISOString();
      const precision = settings.financialPreferences.decimalPrecision;

      const updatedPayment: Payment = { ...existing, reversed: true, reversedAt: now };
      const nextPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));

      const writes: Parameters<typeof runAtomicWrite>[0] = [
        { store: 'payments', op: 'put', value: updatedPayment },
      ];

      if (existing.creditId) {
        const credit = credits.find((c) => c.id === existing.creditId);
        if (credit) {
          const recomputed = reconstructCreditState(credit, creditAdjustments, nextPayments, todayISODate(), precision);
          const updatedCredit: Credit = { ...credit, currentPrincipal: recomputed.currentPrincipal, updatedAt: now };
          writes.push({ store: 'credits', op: 'put', value: updatedCredit });
          setCredits((prev) => prev.map((c) => (c.id === credit.id ? updatedCredit : c)));
        }
      }

      const refundTx: Transaction = {
        id: generateId('tx'),
        profileId: existing.profileId,
        creditId: existing.creditId,
        paymentId: existing.id,
        transactionType: 'refund',
        amount: existing.amount,
        effectiveDate: todayISODate(),
        previousPrincipal: existing.newPrincipal,
        previousInterest: existing.previousInterest,
        previousMisradhan: existing.previousMisradhan,
        newPrincipal: existing.previousPrincipal,
        paymentMethod: existing.paymentMethod,
        receiptNumber: existing.receiptNumber,
        description: `Reversed ${existing.receiptNumber} (₹${existing.amount}): ${reason}`,
        createdAt: now,
      };
      const audit: AuditLog = {
        id: generateId('aud'),
        entityType: 'payment',
        entityId: existing.id,
        action: 'reverse_payment',
        previousData: JSON.stringify(existing),
        newData: JSON.stringify(updatedPayment),
        timestamp: now,
      };

      writes.push({ store: 'transactions', op: 'put', value: refundTx });
      writes.push({ store: 'auditLogs', op: 'put', value: audit });
      await runAtomicWrite(writes);

      setPayments(nextPayments);
      setTransactions((prev) => [refundTx, ...prev]);
      setAuditLogs((prev) => [audit, ...prev]);
    },
    [payments, credits, creditAdjustments, settings.financialPreferences.decimalPrecision]
  );

  const addReminder = useCallback(
    async (data: {
      profileId: string;
      creditId: string | null;
      reminderDate: string;
      reminderTime: string;
      note: string;
    }) => {
      const now = new Date().toISOString();
      const reminder: Reminder = {
        id: generateId('rem'),
        profileId: data.profileId,
        creditId: data.creditId,
        reminderDate: data.reminderDate,
        reminderTime: data.reminderTime || '09:00',
        note: data.note.trim(),
        status: 'pending',
        completedAt: null,
        createdAt: now,
      };
      await runAtomicWrite([{ store: 'reminders', op: 'put', value: reminder }]);
      setReminders((prev) => [reminder, ...prev]);
      return reminder;
    },
    []
  );

  const updateReminder = useCallback(
    async (id: string, data: Partial<Reminder>) => {
      const existing = reminders.find((r) => r.id === id);
      if (!existing) return;
      const updated: Reminder = { ...existing, ...data };
      await runAtomicWrite([{ store: 'reminders', op: 'put', value: updated }]);
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
    },
    [reminders]
  );

  const deleteReminder = useCallback(async (id: string) => {
    await runAtomicWrite([{ store: 'reminders', op: 'delete', id }]);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<Settings>) => {
      const updated: Settings = {
        ...settings,
        ...partial,
        financialPreferences: { ...settings.financialPreferences, ...(partial.financialPreferences || {}) },
        securityPreferences: { ...settings.securityPreferences, ...(partial.securityPreferences || {}) },
        notificationPreferences: { ...settings.notificationPreferences, ...(partial.notificationPreferences || {}) },
      };
      await runAtomicWrite([{ store: 'settings', op: 'put', value: updated }]);
      setSettings(updated);
    },
    [settings]
  );

  const setPinCode = useCallback(
    async (pin: string) => {
      const salt = generateId('salt');
      const hash = await sha256Hash(`${salt}:${pin}`);
      await updateSettings({
        securityPreferences: {
          ...settings.securityPreferences,
          pinEnabled: true,
          pinHash: hash,
          pinSalt: salt,
        },
      });
    },
    [settings.securityPreferences, updateSettings]
  );

  const disablePinCode = useCallback(async () => {
    await updateSettings({
      securityPreferences: {
        ...settings.securityPreferences,
        pinEnabled: false,
        pinHash: '',
        pinSalt: '',
      },
    });
    setIsLocked(false);
  }, [settings.securityPreferences, updateSettings]);

  const verifyPinCode = useCallback(
    async (pin: string) => {
      const { pinSalt, pinHash } = settings.securityPreferences;
      const candidate = await sha256Hash(`${pinSalt}:${pin}`);
      if (candidate === pinHash) {
        setIsLocked(false);
        return true;
      }
      return false;
    },
    [settings.securityPreferences]
  );

  const lockApp = useCallback(() => {
    if (settings.securityPreferences.pinEnabled) {
      setIsLocked(true);
    }
  }, [settings.securityPreferences.pinEnabled]);

  const unlockBiometric = useCallback(() => {
    setIsLocked(false);
  }, []);

  const setTheme = useCallback(
    async (theme: ThemeMode) => {
      await updateSettings({ theme });
    },
    [updateSettings]
  );

  const setLanguage = useCallback(
    async (language: LanguageCode) => {
      await updateSettings({ language });
    },
    [updateSettings]
  );

  const loadDemoData = useCallback(async () => {
    const seed = createSampleSeedData();
    await replaceAllDatabaseData({ ...seed, settings });
    setProfiles(seed.profiles);
    setCredits(seed.credits);
    setPayments(seed.payments);
    setCreditAdjustments(seed.creditAdjustments);
    setTransactions(seed.transactions);
    setAuditLogs(seed.auditLogs);
    setReminders(seed.reminders);
    showToast('Sample ledger loaded', 'success');
  }, [settings, showToast]);

  const getFullSnapshot = useCallback(
    (): FullDatabaseSnapshot => ({
      profiles,
      credits,
      payments,
      creditAdjustments,
      transactions,
      auditLogs,
      reminders,
      settings,
    }),
    [profiles, credits, payments, creditAdjustments, transactions, auditLogs, reminders, settings]
  );

  const importBundleData = useCallback(
    async (
      incoming: Partial<Omit<FullDatabaseSnapshot, 'settings'>> & { settings?: Partial<Settings> },
      mode: 'merge' | 'replace'
    ) => {
      if (mode === 'replace') {
        const nextSettings = incoming.settings ? { ...settings, ...incoming.settings, securityPreferences: settings.securityPreferences, firebaseConfig: settings.firebaseConfig } : settings;
        await replaceAllDatabaseData({
          profiles: incoming.profiles || [],
          credits: incoming.credits || [],
          payments: incoming.payments || [],
          creditAdjustments: incoming.creditAdjustments || [],
          transactions: incoming.transactions || [],
          auditLogs: incoming.auditLogs || [],
          reminders: incoming.reminders || [],
          settings: nextSettings,
        });
        setProfiles(incoming.profiles || []);
        setCredits(incoming.credits || []);
        setPayments(incoming.payments || []);
        setCreditAdjustments(incoming.creditAdjustments || []);
        setTransactions(incoming.transactions || []);
        setAuditLogs(incoming.auditLogs || []);
        setReminders(incoming.reminders || []);
        setSettings(nextSettings);
      } else {
        const mergeById = <T extends { id: string }>(curr: T[], inc: T[] = []) => {
          const map = new Map(curr.map((x) => [x.id, x]));
          for (const item of inc) map.set(item.id, item);
          return Array.from(map.values());
        };
        const mergedProfiles = mergeById(profiles, incoming.profiles);
        const mergedCredits = mergeById(credits, incoming.credits);
        const mergedPayments = mergeById(payments, incoming.payments);
        const mergedAdj = mergeById(creditAdjustments, incoming.creditAdjustments);
        const mergedTx = mergeById(transactions, incoming.transactions);
        const mergedAud = mergeById(auditLogs, incoming.auditLogs);
        const mergedRem = mergeById(reminders, incoming.reminders);

        await replaceAllDatabaseData({
          profiles: mergedProfiles,
          credits: mergedCredits,
          payments: mergedPayments,
          creditAdjustments: mergedAdj,
          transactions: mergedTx,
          auditLogs: mergedAud,
          reminders: mergedRem,
          settings,
        });
        setProfiles(mergedProfiles);
        setCredits(mergedCredits);
        setPayments(mergedPayments);
        setCreditAdjustments(mergedAdj);
        setTransactions(mergedTx);
        setAuditLogs(mergedAud);
        setReminders(mergedRem);
      }
    },
    [profiles, credits, payments, creditAdjustments, transactions, auditLogs, reminders, settings]
  );

  const runCloudSyncNow = useCallback(async () => {
    if (!settings.firebaseConfig) {
      return { ok: false, message: 'Firebase is not configured. Using local IndexedDB.' };
    }
    const snap = getFullSnapshot();
    const res = await syncWithFirestore(settings.firebaseConfig, snap);
    const now = new Date().toISOString();
    if (!res.ok || !res.mergedSnapshot) {
      setSyncLog({
        lastRunAt: now,
        status: 'error',
        message: res.error || 'Sync failed',
        conflicts: res.conflicts,
      });
      return { ok: false, message: res.error || 'Sync failed' };
    }

    await replaceAllDatabaseData(res.mergedSnapshot);
    setProfiles(res.mergedSnapshot.profiles);
    setCredits(res.mergedSnapshot.credits);
    setPayments(res.mergedSnapshot.payments);
    setCreditAdjustments(res.mergedSnapshot.creditAdjustments);
    setTransactions(res.mergedSnapshot.transactions);
    setAuditLogs(res.mergedSnapshot.auditLogs);
    setReminders(res.mergedSnapshot.reminders);
    await updateSettings({ lastSyncAt: now });

    const msg = `Synced: ${res.uploadedCount} uploaded, ${res.downloadedCount} downloaded`;
    setSyncLog({
      lastRunAt: now,
      status: 'synced',
      message: msg,
      conflicts: res.conflicts,
    });
    return { ok: true, message: msg };
  }, [settings.firebaseConfig, getFullSnapshot, updateSettings]);

  return (
    <AppContext.Provider
      value={{
        loading,
        isLocked,
        showSplash,
        dismissSplash: () => setShowSplash(false),
        route,
        navigate,
        goBack,
        profiles,
        credits,
        payments,
        creditAdjustments,
        transactions,
        auditLogs,
        reminders,
        settings,
        dashboard,
        dateFilter,
        setDateFilter,
        globalSearch,
        setGlobalSearch,
        pendingPaymentDraft,
        setPendingPaymentDraft,
        syncLog,
        toasts,
        showToast,
        t,
        nextCreditNumber,
        nextReceiptNumber,
        addProfile,
        updateProfile,
        archiveProfile,
        restoreProfile,
        deleteProfile,
        addCredit,
        updateCreditInfo,
        applyMainCreditUpdate,
        closeCredit,
        reopenCredit,
        archiveCredit,
        deleteCredit,
        recordCreditPayment,
        recordNormalPayment,
        editCreditPayment,
        reversePayment,
        addReminder,
        updateReminder,
        deleteReminder,
        updateSettings,
        setPinCode,
        disablePinCode,
        verifyPinCode,
        lockApp,
        unlockBiometric,
        setTheme,
        setLanguage,
        loadDemoData,
        importBundleData,
        runCloudSyncNow,
        getFullSnapshot,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
