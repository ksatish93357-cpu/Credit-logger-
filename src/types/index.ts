export type ThemeMode = 'dark' | 'light' | 'system';
export type LanguageCode = 'hi' | 'en';
export type InterestPeriod = 'monthly' | 'yearly';
export type InterestMethod = 'simple' | 'compound';
export type PaymentAllocationMode = 'interest_first' | 'principal_adjustment';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';
export type CreditStatus = 'active' | 'closed' | 'archived';
export type PaymentType = 'credit_payment' | 'normal_payment';
export type TransactionType =
  | 'credit_created'
  | 'credit_payment'
  | 'normal_payment'
  | 'principal_adjustment'
  | 'interest_rate_update'
  | 'credit_closed'
  | 'credit_reopened'
  | 'refund'
  | 'correction';

export interface Profile {
  id: string;
  name: string;
  phone: string;
  address: string;
  photo: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Credit {
  id: string;
  profileId: string;
  creditNumber: string;
  originalPrincipal: number;
  currentPrincipal: number;
  interestRate: number;
  interestPeriod: InterestPeriod;
  interestMethod: InterestMethod;
  startDate: string; // YYYY-MM-DD
  status: CreditStatus;
  closedDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  profileId: string;
  creditId: string | null;
  paymentType: PaymentType;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  allocationMode: PaymentAllocationMode | null;
  previousPrincipal: number;
  previousInterest: number;
  previousMisradhan: number;
  newPrincipal: number;
  note: string;
  receiptNumber: string;
  reversed?: boolean;
  reversedAt?: string | null;
  createdAt: string;
}

export interface CreditAdjustment {
  id: string;
  creditId: string;
  previousPrincipal: number;
  newPrincipal: number;
  previousInterestRate: number;
  newInterestRate: number;
  previousInterestPeriod: InterestPeriod;
  newInterestPeriod: InterestPeriod;
  effectiveDate: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  profileId: string;
  creditId: string | null;
  paymentId: string | null;
  transactionType: TransactionType;
  amount: number;
  effectiveDate: string; // YYYY-MM-DD
  previousPrincipal: number;
  previousInterest: number;
  previousMisradhan: number;
  newPrincipal: number;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  description: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: 'profile' | 'credit' | 'payment' | 'adjustment' | 'reminder' | 'settings' | 'sync';
  entityId: string;
  action: string;
  previousData: string | null;
  newData: string | null;
  timestamp: string;
}

export interface Reminder {
  id: string;
  profileId: string;
  creditId: string | null;
  reminderDate: string; // YYYY-MM-DD
  reminderTime: string; // HH:mm
  note: string;
  status: 'pending' | 'completed';
  completedAt: string | null;
  createdAt: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface Settings {
  id: 'app_settings';
  theme: ThemeMode;
  language: LanguageCode;
  financialPreferences: {
    defaultInterestPeriod: InterestPeriod;
    defaultInterestMethod: InterestMethod;
    defaultPaymentAllocation: PaymentAllocationMode;
    decimalPrecision: 0 | 2;
  };
  securityPreferences: {
    pinEnabled: boolean;
    pinHash: string;
    pinSalt: string;
    autoLockMinutes: number;
    biometricEnabled: boolean;
  };
  notificationPreferences: {
    paymentReminders: boolean;
    overdueAlerts: boolean;
    backupReminders: boolean;
  };
  firebaseConfig: FirebaseConfig | null;
  lastSyncAt: string | null;
}

export interface CalendarDuration {
  completedMonths: number;
  remainingDays: number;
  totalDays: number;
  cycleDays: number;
}

export interface ComputedCreditState {
  credit: Credit;
  originalPrincipal: number;
  currentPrincipal: number;
  activeInterestRate: number;
  activeInterestPeriod: InterestPeriod;
  activeInterestMethod: InterestMethod;
  lastAdjustmentDate: string;
  asOfDate: string;
  durationSinceStart: CalendarDuration;
  durationCurrentPeriod: CalendarDuration;
  currentPeriodInterest: number;
  carriedUnpaidInterest: number;
  totalInterest: number;
  totalMisradhan: number;
  totalPaidOnCredit: number;
  advanceBalance: number;
  outstandingAmount: number;
  todayInterestAccrued: number;
}

export interface ComputedProfileSummary {
  profile: Profile;
  totalPrincipal: number;
  totalInterest: number;
  totalMisradhan: number;
  totalCreditPaid: number;
  totalNormalPaid: number;
  totalPaidAmount: number;
  currentOutstanding: number;
  totalAdvance: number;
  activeCreditCount: number;
  closedCreditCount: number;
  totalCreditCount: number;
  latestPaymentDate: string | null;
  creditStates: ComputedCreditState[];
}

export type DateFilterPreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateFilterRange {
  preset: DateFilterPreset;
  startDate?: string;
  endDate?: string;
}

export interface ComputedDashboardSummary {
  totalPrincipal: number;
  totalInterest: number;
  totalMisradhan: number;
  totalPaidAmount: number;
  totalCreditPaid: number;
  totalNormalPaid: number;
  totalLoanTakers: number;
  totalActiveCredits: number;
  totalClosedCredits: number;
  totalCreditRecords: number;
  totalMoneyGiven: number;
  totalMoneyReceived: number;
  todayInterestAccrued: number;
  currentOutstanding: number;
  filteredCollectionTotal: number;
  monthlyCollections: { monthKey: string; label: string; creditPaid: number; normalPaid: number; total: number }[];
  profileSummaries: ComputedProfileSummary[];
}

export type ScreenName =
  | 'splash'
  | 'pin_lock'
  | 'home'
  | 'profiles'
  | 'add_profile'
  | 'profile_details'
  | 'edit_profile'
  | 'credit_list'
  | 'add_credit'
  | 'credit_details'
  | 'edit_credit'
  | 'daily_credit_update'
  | 'add_payment'
  | 'payment_preview'
  | 'payment_receipt'
  | 'main_credit_update'
  | 'normal_payment'
  | 'transactions'
  | 'transaction_details'
  | 'calculator'
  | 'loan_calculator'
  | 'reports'
  | 'reminders'
  | 'json_import'
  | 'json_export'
  | 'pdf_preview'
  | 'firebase_config'
  | 'sync_status'
  | 'settings'
  | 'security_settings'
  | 'language_settings'
  | 'theme_settings'
  | 'about';

export interface RouteState {
  screen: ScreenName;
  profileId?: string;
  creditId?: string;
  paymentId?: string;
  transactionId?: string;
  pdfMode?: 'credit' | 'receipt' | 'profile' | 'report';
  calculatorTab?: 'loan' | 'normal';
}

export interface ExportBundle {
  schemaVersion: number;
  appVersion: string;
  exportDate: string;
  exportScope: 'all' | 'profile' | 'credit' | 'transactions';
  profiles: Profile[];
  credits: Credit[];
  payments: Payment[];
  creditAdjustments: CreditAdjustment[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  reminders: Reminder[];
  settings?: Omit<Settings, 'securityPreferences' | 'firebaseConfig'>;
}
