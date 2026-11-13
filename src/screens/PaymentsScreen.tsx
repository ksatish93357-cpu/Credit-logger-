import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, FileDown, Mail, MessageCircle, Send, Share2 } from 'lucide-react';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import {
  generatePaymentReceipt,
  previewCreditPayment,
} from '../engine/finance';
import { createPaymentReceiptPdf } from '../services/pdf';
import { copyToClipboard, openExternalShareChannel, sharePdfDocument, shareText } from '../services/share';
import type { PaymentAllocationMode, PaymentMethod } from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const AddCreditPaymentScreen: React.FC<{ initialProfileId?: string; initialCreditId?: string }> = ({
  initialProfileId,
  initialCreditId,
}) => {
  const {
    profiles,
    credits,
    creditAdjustments,
    payments,
    settings,
    setPendingPaymentDraft,
    navigate,
    goBack,
    t,
  } = useApp();

  const activeProfiles = profiles.filter((p) => !p.archivedAt);
  const initialCredit = initialCreditId ? credits.find((c) => c.id === initialCreditId) : undefined;
  const [profileId, setProfileId] = useState(initialCredit?.profileId || initialProfileId || activeProfiles[0]?.id || '');

  const profileActiveCredits = useMemo(
    () => credits.filter((c) => c.profileId === profileId && c.status === 'active'),
    [credits, profileId]
  );

  const [creditId, setCreditId] = useState(initialCreditId || profileActiveCredits[0]?.id || '');
  const selectedCredit = credits.find((c) => c.id === creditId) || profileActiveCredits[0];

  const [amountStr, setAmountStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [allocationMode, setAllocationMode] = useState<PaymentAllocationMode>(
    settings.financialPreferences.defaultPaymentAllocation
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const precision = settings.financialPreferences.decimalPrecision;
  const amountNum = Number(amountStr);

  const livePreview = useMemo(() => {
    if (!selectedCredit) return null;
    return previewCreditPayment({
      credit: selectedCredit,
      adjustments: creditAdjustments,
      payments,
      amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0,
      paymentDate,
      allocationMode,
      precision,
    });
  }, [selectedCredit, creditAdjustments, payments, amountNum, paymentDate, allocationMode, precision]);

  const handleProceedPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !selectedCredit) {
      setError('Select a Loan Taker and an active Credit.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Payment Amount must be greater than 0.');
      return;
    }
    setPendingPaymentDraft({
      profileId,
      creditId: selectedCredit.id,
      amount: amountNum,
      paymentDate,
      paymentMethod,
      allocationMode,
      note,
    });
    navigate('payment_preview');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('addPayment')}</h1>

        {activeProfiles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No active profiles found.</p>
        ) : (
          <form onSubmit={handleProceedPreview} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pay-profile" className="block text-xs font-medium mb-1.5">
                  Loan Taker <span className="text-red-500">*</span>
                </label>
                <select
                  id="pay-profile"
                  value={profileId}
                  onChange={(e) => {
                    const nextPid = e.target.value;
                    setProfileId(nextPid);
                    const firstCred = credits.find((c) => c.profileId === nextPid && c.status === 'active');
                    setCreditId(firstCred?.id || '');
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
                >
                  {activeProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="pay-credit" className="block text-xs font-medium mb-1.5">
                  {t('creditNumber')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="pay-credit"
                  value={selectedCredit?.id || ''}
                  onChange={(e) => setCreditId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
                >
                  {profileActiveCredits.length === 0 ? (
                    <option value="">No active credits</option>
                  ) : (
                    profileActiveCredits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.creditNumber} ({formatINR(c.currentPrincipal, precision)})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pay-amount" className="block text-xs font-medium mb-1.5">
                  {t('paymentAmount')} (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    setError('');
                  }}
                  placeholder="1000"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
                />
              </div>

              <div>
                <label htmlFor="pay-method" className="block text-xs font-medium mb-1.5">
                  {t('paymentMethod')}
                </label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
                >
                  <option value="cash">{t('cash')}</option>
                  <option value="upi">{t('upi')}</option>
                  <option value="bank_transfer">{t('bankTransfer')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </div>
            </div>

            <DateInput id="pay-date" label={t('paymentDate')} value={paymentDate} onChange={setPaymentDate} required />

            <div>
              <label className="block text-xs font-medium mb-1.5">{t('allocationMode')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAllocationMode('principal_adjustment')}
                  className={`p-3 rounded-xl border text-left transition ${
                    allocationMode === 'principal_adjustment'
                      ? 'border-violet-600 bg-violet-600/10'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{t('principalAdjustment')}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    New Principal = Old Misradhan - Payment
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode('interest_first')}
                  className={`p-3 rounded-xl border text-left transition ${
                    allocationMode === 'interest_first'
                      ? 'border-violet-600 bg-violet-600/10'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{t('interestFirst')}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Clears accrued interest first, remainder reduces principal
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="pay-note" className="block text-xs font-medium mb-1.5">
                {t('notes')}
              </label>
              <textarea
                id="pay-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional manual note..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
              />
            </div>

            {livePreview && (
              <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-4 space-y-2 text-xs font-mono-num">
                <div className="font-sans font-bold text-slate-800 dark:text-slate-200">Live Calculation Preview</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Previous Principal: {formatINR(livePreview.previousPrincipal, precision)}</div>
                  <div>Accrued Interest: {formatINR(livePreview.accruedInterest, precision)}</div>
                  <div>Previous Misradhan: {formatINR(livePreview.previousMisradhan, precision)}</div>
                  <div className="text-emerald-600 dark:text-emerald-400">
                    Payment: {formatINR(amountNum > 0 ? amountNum : 0, precision)}
                  </div>
                  <div className="text-blue-600 dark:text-blue-400 font-bold">
                    New Principal: {formatINR(livePreview.newPrincipal, precision)}
                  </div>
                  <div className="text-red-500 font-bold">
                    New Outstanding: {formatINR(livePreview.newOutstanding, precision)}
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={goBack} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={!selectedCredit}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {t('previewPayment')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const PaymentPreviewScreen: React.FC = () => {
  const {
    pendingPaymentDraft,
    setPendingPaymentDraft,
    profiles,
    credits,
    creditAdjustments,
    payments,
    settings,
    recordCreditPayment,
    closeCredit,
    navigate,
    goBack,
    showToast,
    t,
  } = useApp();

  const [saving, setSaving] = useState(false);
  const precision = settings.financialPreferences.decimalPrecision;

  if (!pendingPaymentDraft) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#15152B] p-6 text-center">
        <p className="text-sm text-slate-500">No payment draft found.</p>
        <button type="button" onClick={() => navigate('add_payment')} className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm">
          Go to Add Payment
        </button>
      </div>
    );
  }

  const profile = profiles.find((p) => p.id === pendingPaymentDraft.profileId);
  const credit = credits.find((c) => c.id === pendingPaymentDraft.creditId);
  if (!profile || !credit) return null;

  const preview = previewCreditPayment({
    credit,
    adjustments: creditAdjustments,
    payments,
    amount: pendingPaymentDraft.amount,
    paymentDate: pendingPaymentDraft.paymentDate,
    allocationMode: pendingPaymentDraft.allocationMode,
    precision,
  });

  const handleConfirm = async (alsoClose = false) => {
    setSaving(true);
    try {
      const { payment } = await recordCreditPayment(pendingPaymentDraft);
      if (alsoClose) {
        await closeCredit(credit.id, pendingPaymentDraft.paymentDate);
      }
      setPendingPaymentDraft(null);
      showToast(`Payment ${payment.receiptNumber} saved`, 'success');
      navigate({ screen: 'payment_receipt', paymentId: payment.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('previewPayment')}</h1>
        <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Loan Taker</span>
            <span className="font-semibold">{profile.name}</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Credit Number</span>
            <span className="font-mono-num font-bold text-violet-600 dark:text-violet-400">{credit.creditNumber}</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">Payment Date</span>
            <span className="font-mono-num">{formatDateDDMMYYYY(pendingPaymentDraft.paymentDate)}</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('previousPrincipal')}</span>
            <span className="font-mono-num text-blue-600 dark:text-blue-400 font-semibold">
              {formatINR(preview.previousPrincipal, precision)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('accruedInterest')}</span>
            <span className="font-mono-num text-amber-600 dark:text-amber-400 font-semibold">
              {formatINR(preview.accruedInterest, precision)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('previousMisradhan')}</span>
            <span className="font-mono-num text-violet-600 dark:text-violet-400 font-bold">
              {formatINR(preview.previousMisradhan, precision)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('paymentAmount')}</span>
            <span className="font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">
              -{formatINR(pendingPaymentDraft.amount, precision)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('newPrincipal')}</span>
            <span data-testid="preview-new-principal" className="font-mono-num text-blue-600 dark:text-blue-400 font-extrabold">
              {formatINR(preview.newPrincipal, precision)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-slate-500">{t('newOutstanding')}</span>
            <span className="font-mono-num text-red-500 font-bold">
              {formatINR(preview.newOutstanding, precision)}
            </span>
          </div>
          {preview.advanceAdded > 0 && (
            <div className="py-2.5 flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Excess Advance Balance</span>
              <span className="font-mono-num font-bold">{formatINR(preview.advanceAdded, precision)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button type="button" onClick={goBack} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
            Back &amp; Edit
          </button>
          {preview.shouldOfferClose && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
            >
              Save &amp; Close Credit
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleConfirm(false)}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            {saving ? 'Saving...' : t('confirmSavePayment')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PaymentReceiptScreen: React.FC<{ paymentId: string }> = ({ paymentId }) => {
  const { payments, profiles, credits, settings, navigate, showToast, t } = useApp();
  const payment = payments.find((p) => p.id === paymentId);
  const profile = payment ? profiles.find((pr) => pr.id === payment.profileId) : undefined;
  const credit = payment?.creditId ? credits.find((c) => c.id === payment.creditId) || null : null;
  const precision = settings.financialPreferences.decimalPrecision;

  if (!payment || !profile) {
    return <p className="text-sm text-slate-500">Payment receipt not found.</p>;
  }

  const receiptText = generatePaymentReceipt(profile, credit, payment, precision);

  const handleDownloadPdf = async () => {
    const doc = createPaymentReceiptPdf(profile, credit, payment, precision);
    await sharePdfDocument(doc, `receipt-${payment.receiptNumber}.pdf`, `Receipt ${payment.receiptNumber}`);
    showToast('PDF receipt ready', 'success');
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('paymentReceipt')}</h1>
            <p className="text-xs font-mono-num text-violet-600 dark:text-violet-400">{payment.receiptNumber}</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Customer Name</span>
            <span className="font-semibold">{profile.name}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Credit / Type</span>
            <span className="font-mono-num font-semibold">
              {credit ? credit.creditNumber : 'Normal Payment'}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Payment Amount</span>
            <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(payment.amount, precision)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Payment Date</span>
            <span className="font-mono-num">{formatDateDDMMYYYY(payment.paymentDate)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Method</span>
            <span className="uppercase">{payment.paymentMethod}</span>
          </div>
          {credit && (
            <>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Previous Principal</span>
                <span className="font-mono-num">{formatINR(payment.previousPrincipal, precision)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Previous Interest</span>
                <span className="font-mono-num">{formatINR(payment.previousInterest, precision)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Previous Misradhan</span>
                <span className="font-mono-num">{formatINR(payment.previousMisradhan, precision)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">New Principal</span>
                <span className="font-mono-num font-bold text-blue-600 dark:text-blue-400">
                  {formatINR(payment.newPrincipal, precision)}
                </span>
              </div>
            </>
          )}
        </div>

        {payment.note && (
          <pre className="text-xs whitespace-pre-wrap font-sans bg-slate-50 dark:bg-[#0B0B18] p-3.5 rounded-xl text-slate-600 dark:text-slate-300">
            {payment.note}
          </pre>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={async () => {
              await copyToClipboard(receiptText);
              showToast('Receipt copied', 'success');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button
            type="button"
            onClick={() => shareText(`Receipt ${payment.receiptNumber}`, receiptText)}
            className="px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button
            type="button"
            onClick={() => openExternalShareChannel('whatsapp', receiptText)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => openExternalShareChannel('telegram', receiptText)}
            className="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Telegram
          </button>
          <button
            type="button"
            onClick={() => openExternalShareChannel('email', receiptText, `Receipt ${payment.receiptNumber}`)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> Save PDF
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const NormalPaymentScreen: React.FC<{ initialProfileId?: string }> = ({ initialProfileId }) => {
  const { profiles, recordNormalPayment, navigate, goBack, showToast, t } = useApp();
  const activeProfiles = profiles.filter((p) => !p.archivedAt);

  const [profileId, setProfileId] = useState(initialProfileId || activeProfiles[0]?.id || '');
  const [amountStr, setAmountStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISODate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amountStr);
    if (!profileId) {
      setError('Select a Loan Taker.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Payment Amount must be greater than 0.');
      return;
    }
    const payment = await recordNormalPayment({
      profileId,
      amount: amt,
      paymentDate,
      paymentMethod,
      note,
    });
    showToast(`Normal Payment ${payment.receiptNumber} recorded`, 'success');
    navigate({ screen: 'payment_receipt', paymentId: payment.id });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('addNormalPayment')}</h1>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          {t('normalPaymentDisclaimer')}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="norm-profile" className="block text-xs font-medium mb-1.5">
              Loan Taker <span className="text-red-500">*</span>
            </label>
            <select
              id="norm-profile"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
            >
              {activeProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="norm-amount" className="block text-xs font-medium mb-1.5">
                {t('paymentAmount')} (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="norm-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="norm-method" className="block text-xs font-medium mb-1.5">
                {t('paymentMethod')}
              </label>
              <select
                id="norm-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
              >
                <option value="cash">{t('cash')}</option>
                <option value="upi">{t('upi')}</option>
                <option value="bank_transfer">{t('bankTransfer')}</option>
                <option value="other">{t('other')}</option>
              </select>
            </div>
          </div>

          <DateInput id="norm-date" label={t('paymentDate')} value={paymentDate} onChange={setPaymentDate} required />

          <div>
            <label htmlFor="norm-note" className="block text-xs font-medium mb-1.5">
              {t('notes')}
            </label>
            <textarea
              id="norm-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={goBack} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
              {t('cancel')}
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold">
              Save Normal Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
