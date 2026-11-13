import type {
  AuditLog,
  Credit,
  CreditAdjustment,
  ExportBundle,
  Payment,
  Profile,
  Reminder,
  Settings,
  Transaction,
} from '../types';
import { generateId } from '../utils/format';

const DB_NAME = 'credit_logger_db';
const DB_VERSION = 1;
const STORES = [
  'profiles',
  'credits',
  'payments',
  'creditAdjustments',
  'transactions',
  'auditLogs',
  'reminders',
  'settings',
] as const;

export type StoreName = (typeof STORES)[number];

export const DEFAULT_SETTINGS: Settings = {
  id: 'app_settings',
  theme: 'dark',
  language: 'hi',
  financialPreferences: {
    defaultInterestPeriod: 'monthly',
    defaultInterestMethod: 'simple',
    defaultPaymentAllocation: 'principal_adjustment',
    decimalPrecision: 2,
  },
  securityPreferences: {
    pinEnabled: false,
    pinHash: '',
    pinSalt: '',
    autoLockMinutes: 5,
    biometricEnabled: false,
  },
  notificationPreferences: {
    paymentReminders: true,
    overdueAlerts: true,
    backupReminders: true,
  },
  firebaseConfig: null,
  lastSyncAt: null,
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putInStore<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface FullDatabaseSnapshot {
  profiles: Profile[];
  credits: Credit[];
  payments: Payment[];
  creditAdjustments: CreditAdjustment[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  reminders: Reminder[];
  settings: Settings;
}

export async function loadAllDatabaseData(): Promise<FullDatabaseSnapshot> {
  const [profiles, credits, payments, creditAdjustments, transactions, auditLogs, reminders, settingsArr] =
    await Promise.all([
      getAllFromStore<Profile>('profiles'),
      getAllFromStore<Credit>('credits'),
      getAllFromStore<Payment>('payments'),
      getAllFromStore<CreditAdjustment>('creditAdjustments'),
      getAllFromStore<Transaction>('transactions'),
      getAllFromStore<AuditLog>('auditLogs'),
      getAllFromStore<Reminder>('reminders'),
      getAllFromStore<Settings>('settings'),
    ]);

  let settings = settingsArr.find((s) => s.id === 'app_settings');
  if (!settings) {
    settings = DEFAULT_SETTINGS;
    await putInStore('settings', settings);
  } else {
    settings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      financialPreferences: { ...DEFAULT_SETTINGS.financialPreferences, ...settings.financialPreferences },
      securityPreferences: { ...DEFAULT_SETTINGS.securityPreferences, ...settings.securityPreferences },
      notificationPreferences: { ...DEFAULT_SETTINGS.notificationPreferences, ...settings.notificationPreferences },
    };
  }

  return {
    profiles,
    credits,
    payments,
    creditAdjustments,
    transactions,
    auditLogs,
    reminders,
    settings,
  };
}

export async function runAtomicWrite(
  writes: { store: StoreName; op: 'put' | 'delete'; value?: unknown; id?: string }[]
): Promise<void> {
  const db = await openDatabase();
  const storeNames = Array.from(new Set(writes.map((w) => w.store)));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const w of writes) {
      const s = tx.objectStore(w.store);
      if (w.op === 'put' && w.value !== undefined) {
        s.put(w.value);
      } else if (w.op === 'delete' && w.id !== undefined) {
        s.delete(w.id);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceAllDatabaseData(data: Partial<FullDatabaseSnapshot>): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    const clearAndWrite = <T>(storeName: StoreName, items: T[] | undefined) => {
      if (!items) return;
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
    };
    clearAndWrite('profiles', data.profiles);
    clearAndWrite('credits', data.credits);
    clearAndWrite('payments', data.payments);
    clearAndWrite('creditAdjustments', data.creditAdjustments);
    clearAndWrite('transactions', data.transactions);
    clearAndWrite('auditLogs', data.auditLogs);
    clearAndWrite('reminders', data.reminders);
    if (data.settings) {
      tx.objectStore('settings').put(data.settings);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const CURRENT_SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';

export function buildExportBundle(
  snapshot: FullDatabaseSnapshot,
  scope: 'all' | 'profile' | 'credit' | 'transactions',
  filterId?: string
): ExportBundle {
  const { settings } = snapshot;
  const safeSettings: Omit<Settings, 'securityPreferences' | 'firebaseConfig'> = {
    id: 'app_settings',
    theme: settings.theme,
    language: settings.language,
    financialPreferences: settings.financialPreferences,
    notificationPreferences: settings.notificationPreferences,
    lastSyncAt: settings.lastSyncAt,
  };

  if (scope === 'profile' && filterId) {
    const profiles = snapshot.profiles.filter((p) => p.id === filterId);
    const credits = snapshot.credits.filter((c) => c.profileId === filterId);
    const creditIds = new Set(credits.map((c) => c.id));
    const payments = snapshot.payments.filter((p) => p.profileId === filterId);
    const creditAdjustments = snapshot.creditAdjustments.filter((a) => creditIds.has(a.creditId));
    const transactions = snapshot.transactions.filter((t) => t.profileId === filterId);
    const reminders = snapshot.reminders.filter((r) => r.profileId === filterId);
    const auditLogs = snapshot.auditLogs.filter(
      (a) => a.entityId === filterId || creditIds.has(a.entityId)
    );
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportDate: new Date().toISOString(),
      exportScope: 'profile',
      profiles,
      credits,
      payments,
      creditAdjustments,
      transactions,
      auditLogs,
      reminders,
    };
  }

  if (scope === 'credit' && filterId) {
    const credits = snapshot.credits.filter((c) => c.id === filterId);
    const profileIds = new Set(credits.map((c) => c.profileId));
    const profiles = snapshot.profiles.filter((p) => profileIds.has(p.id));
    const payments = snapshot.payments.filter((p) => p.creditId === filterId);
    const creditAdjustments = snapshot.creditAdjustments.filter((a) => a.creditId === filterId);
    const transactions = snapshot.transactions.filter((t) => t.creditId === filterId);
    const reminders = snapshot.reminders.filter((r) => r.creditId === filterId);
    const auditLogs = snapshot.auditLogs.filter((a) => a.entityId === filterId);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportDate: new Date().toISOString(),
      exportScope: 'credit',
      profiles,
      credits,
      payments,
      creditAdjustments,
      transactions,
      auditLogs,
      reminders,
    };
  }

  if (scope === 'transactions') {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportDate: new Date().toISOString(),
      exportScope: 'transactions',
      profiles: snapshot.profiles,
      credits: snapshot.credits,
      payments: snapshot.payments,
      creditAdjustments: [],
      transactions: snapshot.transactions,
      auditLogs: [],
      reminders: [],
    };
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportDate: new Date().toISOString(),
    exportScope: 'all',
    profiles: snapshot.profiles,
    credits: snapshot.credits,
    payments: snapshot.payments,
    creditAdjustments: snapshot.creditAdjustments,
    transactions: snapshot.transactions,
    auditLogs: snapshot.auditLogs,
    reminders: snapshot.reminders,
    settings: safeSettings,
  };
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  duplicateIds: string[];
  missingRelationships: string[];
  bundle: ExportBundle | null;
}

export function validateImportBundle(
  rawJson: string,
  existing: FullDatabaseSnapshot
): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateIds: string[] = [];
  const missingRelationships: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      errors: ['Invalid JSON syntax. Please select a valid CREDIT LOGGER backup file.'],
      warnings,
      duplicateIds,
      missingRelationships,
      bundle: null,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      errors: ['Backup file root must be a JSON object.'],
      warnings,
      duplicateIds,
      missingRelationships,
      bundle: null,
    };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${String(obj.schemaVersion ?? 'missing')}`);
  }

  const arrayFields = ['profiles', 'credits', 'payments', 'creditAdjustments', 'transactions', 'auditLogs', 'reminders'];
  for (const field of arrayFields) {
    if (obj[field] !== undefined && !Array.isArray(obj[field])) {
      errors.push(`Field "${field}" must be an array.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, duplicateIds, missingRelationships, bundle: null };
  }

  const bundle: ExportBundle = {
    schemaVersion: Number(obj.schemaVersion),
    appVersion: String(obj.appVersion || '1.0.0'),
    exportDate: String(obj.exportDate || new Date().toISOString()),
    exportScope: (obj.exportScope as ExportBundle['exportScope']) || 'all',
    profiles: (obj.profiles as Profile[]) || [],
    credits: (obj.credits as Credit[]) || [],
    payments: (obj.payments as Payment[]) || [],
    creditAdjustments: (obj.creditAdjustments as CreditAdjustment[]) || [],
    transactions: (obj.transactions as Transaction[]) || [],
    auditLogs: (obj.auditLogs as AuditLog[]) || [],
    reminders: (obj.reminders as Reminder[]) || [],
    settings: obj.settings as ExportBundle['settings'],
  };

  const existingProfileIds = new Set(existing.profiles.map((p) => p.id));
  const existingCreditIds = new Set(existing.credits.map((c) => c.id));
  const existingPaymentIds = new Set(existing.payments.map((p) => p.id));

  const incomingProfileIds = new Set(bundle.profiles.map((p) => p.id));
  const incomingCreditIds = new Set(bundle.credits.map((c) => c.id));

  for (const p of bundle.profiles) {
    if (!p.id || !p.name) errors.push(`Profile missing id or name.`);
    if (existingProfileIds.has(p.id)) duplicateIds.push(`Profile ${p.name} (${p.id})`);
  }
  for (const c of bundle.credits) {
    if (!c.id || !c.profileId || !c.creditNumber) errors.push(`Credit missing required fields.`);
    if (existingCreditIds.has(c.id)) duplicateIds.push(`Credit ${c.creditNumber} (${c.id})`);
    if (!incomingProfileIds.has(c.profileId) && !existingProfileIds.has(c.profileId)) {
      missingRelationships.push(`Credit ${c.creditNumber} references missing Profile ${c.profileId}`);
    }
  }
  for (const pay of bundle.payments) {
    if (!pay.id || !pay.profileId) errors.push(`Payment missing id or profileId.`);
    if (existingPaymentIds.has(pay.id)) duplicateIds.push(`Payment ${pay.receiptNumber} (${pay.id})`);
    if (!incomingProfileIds.has(pay.profileId) && !existingProfileIds.has(pay.profileId)) {
      missingRelationships.push(`Payment ${pay.receiptNumber} references missing Profile ${pay.profileId}`);
    }
    if (pay.creditId && !incomingCreditIds.has(pay.creditId) && !existingCreditIds.has(pay.creditId)) {
      missingRelationships.push(`Payment ${pay.receiptNumber} references missing Credit ${pay.creditId}`);
    }
  }

  if (duplicateIds.length > 0) {
    warnings.push(`${duplicateIds.length} record ID(s) already exist locally. In Merge mode, existing IDs will be updated.`);
  }
  if (missingRelationships.length > 0) {
    errors.push(...missingRelationships);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    duplicateIds,
    missingRelationships,
    bundle: errors.length === 0 ? bundle : null,
  };
}

export function createSampleSeedData(): Omit<FullDatabaseSnapshot, 'settings'> {
  const now = new Date().toISOString();
  const p1 = generateId('prof');
  const p2 = generateId('prof');
  const c1 = generateId('cred');
  const c2 = generateId('cred');
  const pay1 = generateId('pay');
  const payNorm = generateId('pay');

  const profiles: Profile[] = [
    {
      id: p1,
      name: 'राहुल शर्मा (Rahul Sharma)',
      phone: '9876543210',
      address: 'मालवीय नगर, जयपुर',
      photo: '',
      note: 'नियमित ग्राहक',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    {
      id: p2,
      name: 'अमित वर्मा (Amit Verma)',
      phone: '9829011223',
      address: 'वैशाली नगर, जयपुर',
      photo: '',
      note: '',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
  ];

  const credits: Credit[] = [
    {
      id: c1,
      profileId: p1,
      creditNumber: 'CL-0001',
      originalPrincipal: 50000,
      currentPrincipal: 50000,
      interestRate: 2,
      interestPeriod: 'monthly',
      interestMethod: 'simple',
      startDate: '2026-06-13',
      status: 'active',
      closedDate: null,
      note: 'मासिक साधारण ब्याज खाता',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: c2,
      profileId: p2,
      creditNumber: 'CL-0002',
      originalPrincipal: 100000,
      currentPrincipal: 75000,
      interestRate: 1.5,
      interestPeriod: 'monthly',
      interestMethod: 'simple',
      startDate: '2026-05-13',
      status: 'active',
      closedDate: null,
      note: '',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const payments: Payment[] = [
    {
      id: pay1,
      profileId: p2,
      creditId: c2,
      paymentType: 'credit_payment',
      amount: 28000,
      paymentDate: '2026-07-13',
      paymentMethod: 'upi',
      allocationMode: 'principal_adjustment',
      previousPrincipal: 100000,
      previousInterest: 3000,
      previousMisradhan: 103000,
      newPrincipal: 75000,
      note: 'Credit Number: CL-0002\nPayment Received: ₹28,000\nNew Principal: ₹75,000',
      receiptNumber: 'RCP-0001',
      createdAt: now,
    },
    {
      id: payNorm,
      profileId: p1,
      creditId: null,
      paymentType: 'normal_payment',
      amount: 5000,
      paymentDate: '2026-08-10',
      paymentMethod: 'cash',
      allocationMode: null,
      previousPrincipal: 0,
      previousInterest: 0,
      previousMisradhan: 0,
      newPrincipal: 0,
      note: 'सामान्य जमा राशि',
      receiptNumber: 'NRM-0001',
      createdAt: now,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: generateId('tx'),
      profileId: p1,
      creditId: c1,
      paymentId: null,
      transactionType: 'credit_created',
      amount: 50000,
      effectiveDate: '2026-06-13',
      previousPrincipal: 0,
      previousInterest: 0,
      previousMisradhan: 0,
      newPrincipal: 50000,
      description: 'Credit CL-0001 created for ₹50,000 @ 2% monthly',
      createdAt: now,
    },
    {
      id: generateId('tx'),
      profileId: p2,
      creditId: c2,
      paymentId: null,
      transactionType: 'credit_created',
      amount: 100000,
      effectiveDate: '2026-05-13',
      previousPrincipal: 0,
      previousInterest: 0,
      previousMisradhan: 0,
      newPrincipal: 100000,
      description: 'Credit CL-0002 created for ₹1,00,000 @ 1.5% monthly',
      createdAt: now,
    },
    {
      id: generateId('tx'),
      profileId: p2,
      creditId: c2,
      paymentId: pay1,
      transactionType: 'credit_payment',
      amount: 28000,
      effectiveDate: '2026-07-13',
      previousPrincipal: 100000,
      previousInterest: 3000,
      previousMisradhan: 103000,
      newPrincipal: 75000,
      paymentMethod: 'upi',
      receiptNumber: 'RCP-0001',
      description: 'Credit payment ₹28,000 on CL-0002 (Principal Adjustment)',
      createdAt: now,
    },
    {
      id: generateId('tx'),
      profileId: p1,
      creditId: null,
      paymentId: payNorm,
      transactionType: 'normal_payment',
      amount: 5000,
      effectiveDate: '2026-08-10',
      previousPrincipal: 0,
      previousInterest: 0,
      previousMisradhan: 0,
      newPrincipal: 0,
      paymentMethod: 'cash',
      receiptNumber: 'NRM-0001',
      description: 'Normal payment ₹5,000 (non-credit)',
      createdAt: now,
    },
  ];

  const reminders: Reminder[] = [
    {
      id: generateId('rem'),
      profileId: p1,
      creditId: c1,
      reminderDate: '2026-11-20',
      reminderTime: '10:00',
      note: 'राहुल से मासिक ब्याज फॉलो-अप',
      status: 'pending',
      completedAt: null,
      createdAt: now,
    },
  ];

  return {
    profiles,
    credits,
    payments,
    creditAdjustments: [],
    transactions,
    auditLogs: [],
    reminders,
  };
}
