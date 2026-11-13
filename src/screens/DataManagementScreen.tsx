import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileDown, Printer, Share2, Upload } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';
import { buildExportBundle, validateImportBundle, type ImportValidationResult } from '../db/indexedDb';
import {
  calculateProfileSummary,
  generateCreditStatement,
  generatePaymentReceipt,
  generateProfileStatement,
  reconstructCreditState,
} from '../engine/finance';
import {
  createAnalyticsReportPdf,
  createCreditStatementPdf,
  createPaymentReceiptPdf,
  createProfileStatementPdf,
} from '../services/pdf';
import { copyToClipboard, downloadJsonFile, sharePdfDocument, shareText } from '../services/share';
import { todayISODate } from '../utils/format';

export const JsonExportScreen: React.FC = () => {
  const { profiles, credits, getFullSnapshot, showToast, t } = useApp();
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || '');
  const [selectedCreditId, setSelectedCreditId] = useState(credits[0]?.id || '');

  const handleExport = (scope: 'all' | 'profile' | 'credit' | 'transactions') => {
    const id = scope === 'profile' ? selectedProfileId : scope === 'credit' ? selectedCreditId : undefined;
    const bundle = buildExportBundle(getFullSnapshot(), scope, id);
    downloadJsonFile(
      JSON.stringify(bundle, null, 2),
      `credit-logger-${scope}-${todayISODate()}.json`
    );
    showToast(`Exported ${scope} JSON backup`, 'success');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold">{t('jsonExport')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Includes Schema Version, App Version, Export Date, Unique IDs, and excludes sensitive PIN/Firebase credentials.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleExport('all')}
            className="w-full p-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-between"
          >
            <div className="text-left">
              <div className="text-sm font-bold">Export All Data (Complete Backup)</div>
              <div className="text-xs text-violet-200">Profiles, Credits, Payments, Adjustments, Audit Logs &amp; Reminders</div>
            </div>
            <Download className="w-5 h-5" />
          </button>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-sm font-semibold">Export Single Profile</div>
            <div className="flex gap-2">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedProfileId}
                onClick={() => handleExport('profile')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-sm font-semibold">Export Single Credit</div>
            <div className="flex gap-2">
              <select
                value={selectedCreditId}
                onChange={(e) => setSelectedCreditId(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs font-mono-num"
              >
                {credits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.creditNumber}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedCreditId}
                onClick={() => handleExport('credit')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleExport('transactions')}
            className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <div className="text-left">
              <div className="text-sm font-semibold">Export Transaction History</div>
              <div className="text-xs text-slate-500">All ledger entries and payment records</div>
            </div>
            <Download className="w-4 h-4 text-violet-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const JsonImportScreen: React.FC = () => {
  const { getFullSnapshot, importBundleData, navigate, showToast, t } = useApp();
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = validateImportBundle(text, getFullSnapshot());
    setValidation(res);
  };

  const executeImport = async () => {
    if (!validation?.bundle) return;
    setConfirmOpen(false);
    await importBundleData(validation.bundle, importMode);
    showToast(`JSON backup imported (${importMode})`, 'success');
    navigate('home');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <h1 className="text-xl font-bold">{t('jsonImport')}</h1>
        <p className="text-xs text-slate-500">
          Validates schema version, record IDs, and relationships before restoring. Never silently overwrites data.
        </p>

        <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-500/40 p-8 cursor-pointer hover:bg-violet-500/5">
          <Upload className="w-8 h-8 text-violet-500 mb-2" />
          <span className="text-sm font-semibold">Select JSON Backup File</span>
          <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        </label>

        {validation && (
          <div className="space-y-4">
            {!validation.valid ? (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-1 text-xs text-red-600 dark:text-red-400">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Validation Failed
                </div>
                {validation.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            ) : (
              validation.bundle && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-3 text-xs">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Valid CREDIT LOGGER Backup (Schema v{validation.bundle.schemaVersion})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono-num">
                    <div>Profiles: {validation.bundle.profiles.length}</div>
                    <div>Credits: {validation.bundle.credits.length}</div>
                    <div>Payments: {validation.bundle.payments.length}</div>
                    <div>Adjustments: {validation.bundle.creditAdjustments.length}</div>
                    <div>Transactions: {validation.bundle.transactions.length}</div>
                    <div>Reminders: {validation.bundle.reminders.length}</div>
                  </div>
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="text-amber-600 dark:text-amber-400">
                      Warning: {w}
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`py-2 rounded-xl border text-xs font-semibold ${
                        importMode === 'merge' ? 'border-violet-600 bg-violet-600/15 text-violet-600 dark:text-violet-300' : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Merge with Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`py-2 rounded-xl border text-xs font-semibold ${
                        importMode === 'replace' ? 'border-red-500 bg-red-500/15 text-red-500' : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      Replace Entire DB
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
                  >
                    Proceed to Import ({importMode.toUpperCase()})
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        danger={importMode === 'replace'}
        title={`Confirm ${importMode.toUpperCase()} Import`}
        message={
          importMode === 'replace'
            ? 'Replace mode will overwrite all local records with the selected backup file.'
            : 'Merge mode will add new records and update matching IDs while keeping other existing data.'
        }
        confirmLabel="Confirm Import"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeImport}
      />
    </div>
  );
};

export const PdfPreviewScreen: React.FC<{
  mode?: 'credit' | 'receipt' | 'profile' | 'report';
  profileId?: string;
  creditId?: string;
  paymentId?: string;
}> = ({ mode = 'report', profileId, creditId, paymentId }) => {
  const { profiles, credits, creditAdjustments, payments, dashboard, settings, showToast } = useApp();
  const precision = settings.financialPreferences.decimalPrecision;

  let title = 'Portfolio Analytics Report';
  let textBody = '';
  let buildPdf = () => createAnalyticsReportPdf(dashboard, precision);

  if (mode === 'credit' && creditId) {
    const credit = credits.find((c) => c.id === creditId);
    const profile = credit ? profiles.find((p) => p.id === credit.profileId) : undefined;
    if (credit && profile) {
      const state = reconstructCreditState(credit, creditAdjustments, payments, todayISODate(), precision);
      title = `Credit Statement — ${credit.creditNumber}`;
      textBody = generateCreditStatement(profile, state, payments, precision);
      buildPdf = () => createCreditStatementPdf(profile, state, payments, precision);
    }
  } else if (mode === 'profile' && profileId) {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      const summary = calculateProfileSummary(profile, credits, creditAdjustments, payments, todayISODate(), precision);
      title = `Complete Profile Statement — ${profile.name}`;
      textBody = generateProfileStatement(summary, payments, precision);
      buildPdf = () => createProfileStatementPdf(summary, payments, precision);
    }
  } else if (mode === 'receipt' && paymentId) {
    const payment = payments.find((p) => p.id === paymentId);
    const profile = payment ? profiles.find((p) => p.id === payment.profileId) : undefined;
    const credit = payment?.creditId ? credits.find((c) => c.id === payment.creditId) || null : null;
    if (payment && profile) {
      title = `Payment Receipt — ${payment.receiptNumber}`;
      textBody = generatePaymentReceipt(profile, credit, payment, precision);
      buildPdf = () => createPaymentReceiptPdf(profile, credit, payment, precision);
    }
  } else {
    textBody = [
      `CREDIT LOGGER — PORTFOLIO STATEMENT`,
      `Loan Takers: ${dashboard.totalLoanTakers}`,
      `Active Credits: ${dashboard.totalActiveCredits}`,
      `Total Principal: ₹${dashboard.totalPrincipal}`,
      `Total Interest: ₹${dashboard.totalInterest}`,
      `Total Misradhan: ₹${dashboard.totalMisradhan}`,
      `Total Paid: ₹${dashboard.totalPaidAmount}`,
      `Current Outstanding: ₹${dashboard.currentOutstanding}`,
    ].join('\n');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await copyToClipboard(textBody);
              showToast('Statement copied', 'success');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
          >
            Copy Text
          </button>
          <button
            type="button"
            onClick={() => shareText(title, textBody)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Text
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={async () => {
              const doc = buildPdf();
              await sharePdfDocument(doc, `credit-logger-${mode}-${todayISODate()}.pdf`, title);
              showToast('PDF downloaded / shared', 'success');
            }}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> Save / Share PDF
          </button>
        </div>
      </div>

      {/* Printable Document Sheet */}
      <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Logo size={42} />
            <div>
              <div className="text-lg font-extrabold tracking-tight">CREDIT LOGGER</div>
              <div className="text-xs text-slate-500">{title}</div>
            </div>
          </div>
          <div className="text-xs font-mono-num text-slate-500">{todayISODate()}</div>
        </div>
        <pre className="text-xs sm:text-sm whitespace-pre-wrap font-mono-num leading-relaxed text-slate-800">
          {textBody}
        </pre>
      </div>
    </div>
  );
};
