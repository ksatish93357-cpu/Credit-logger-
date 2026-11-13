import React, { useMemo, useState } from 'react';
import { Edit3, RotateCcw, Search } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import { previewHistoricalPaymentEdit, resolveDateFilterRange } from '../engine/finance';
import type {
  DateFilterPreset,
  PaymentAllocationMode,
  PaymentMethod,
  TransactionType,
} from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const TransactionHistoryScreen: React.FC = () => {
  const { transactions, profiles, credits, settings, navigate, t } = useApp();
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customStart, setCustomStart] = useState(todayISODate());
  const [customEnd, setCustomEnd] = useState(todayISODate());
  const [profileFilter, setProfileFilter] = useState('');
  const [creditFilter, setCreditFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount_desc'>('newest');

  const precision = settings.financialPreferences.decimalPrecision;

  const filtered = useMemo(() => {
    const { startDate, endDate } = resolveDateFilterRange({
      preset: datePreset,
      startDate: customStart,
      endDate: customEnd,
    });
    const q = search.trim().toLowerCase();

    const list = transactions.filter((tx) => {
      if (startDate && tx.effectiveDate < startDate) return false;
      if (endDate && tx.effectiveDate > endDate) return false;
      if (profileFilter && tx.profileId !== profileFilter) return false;
      if (creditFilter && tx.creditId !== creditFilter) return false;
      if (typeFilter && tx.transactionType !== typeFilter) return false;
      if (methodFilter && tx.paymentMethod !== methodFilter) return false;
      if (q) {
        const prof = profiles.find((p) => p.id === tx.profileId);
        const cred = tx.creditId ? credits.find((c) => c.id === tx.creditId) : null;
        const hay = `${tx.id} ${tx.description} ${tx.receiptNumber || ''} ${prof?.name || ''} ${cred?.creditNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortOrder === 'newest') {
      list.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt));
    } else if (sortOrder === 'oldest') {
      list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.createdAt.localeCompare(b.createdAt));
    } else {
      list.sort((a, b) => b.amount - a.amount);
    }
    return list;
  }, [
    transactions,
    profiles,
    credits,
    search,
    datePreset,
    customStart,
    customEnd,
    profileFilter,
    creditFilter,
    typeFilter,
    methodFilter,
    sortOrder,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('transactions')}</h1>
        <p className="text-xs text-slate-500">Complete chronological audit ledger across all profiles and credits</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transaction ID, receipt #, credit #, name..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] pl-10 pr-4 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'today', 'week', 'month', 'custom'] as DateFilterPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDatePreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                datePreset === p
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 dark:bg-[#0B0B18] text-slate-600 dark:text-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateInput label="From" value={customStart} onChange={setCustomStart} />
            <DateInput label="To" value={customEnd} onChange={setCustomEnd} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select
            aria-label="Filter by Loan Taker"
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
          >
            <option value="">All Profiles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Credit Number"
            value={creditFilter}
            onChange={(e) => setCreditFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
          >
            <option value="">All Credits</option>
            {credits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.creditNumber}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Transaction Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | '')}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
          >
            <option value="">All Types</option>
            <option value="credit_created">Credit Created</option>
            <option value="credit_payment">Credit Payment</option>
            <option value="normal_payment">Normal Payment</option>
            <option value="principal_adjustment">Principal Adjustment</option>
            <option value="interest_rate_update">Interest Rate Update</option>
            <option value="credit_closed">Credit Closed</option>
            <option value="credit_reopened">Credit Reopened</option>
            <option value="refund">Refund / Reversal</option>
            <option value="correction">Correction</option>
          </select>

          <select
            aria-label="Filter by Payment Method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | '')}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
          >
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>

          <select
            aria-label="Sort transactions"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-xs"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No matching transactions found.</p>
        ) : (
          filtered.map((tx) => {
            const prof = profiles.find((p) => p.id === tx.profileId);
            const cred = tx.creditId ? credits.find((c) => c.id === tx.creditId) : null;
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => navigate({ screen: 'transaction_details', transactionId: tx.id })}
                className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {tx.description}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{prof?.name || 'Unknown'}</span>
                    {cred && <span className="font-mono-num text-violet-600 dark:text-violet-400">· {cred.creditNumber}</span>}
                    <span className="font-mono-num">· {formatDateDDMMYYYY(tx.effectiveDate)}</span>
                    <span className="capitalize">· {tx.transactionType.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                    {formatINR(tx.amount, precision)}
                  </div>
                  {tx.receiptNumber && (
                    <div className="text-[11px] font-mono-num text-slate-400">{tx.receiptNumber}</div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export const TransactionDetailsScreen: React.FC<{ transactionId: string }> = ({ transactionId }) => {
  const {
    transactions,
    profiles,
    credits,
    payments,
    creditAdjustments,
    settings,
    editCreditPayment,
    reversePayment,
    navigate,
    showToast,
  } = useApp();

  const tx = transactions.find((t) => t.id === transactionId);
  const profile = tx ? profiles.find((p) => p.id === tx.profileId) : undefined;
  const credit = tx?.creditId ? credits.find((c) => c.id === tx.creditId) : undefined;
  const linkedPayment = tx?.paymentId ? payments.find((p) => p.id === tx.paymentId) : undefined;
  const precision = settings.financialPreferences.decimalPrecision;

  const [editing, setEditing] = useState(false);
  const [editAmountStr, setEditAmountStr] = useState(String(linkedPayment?.amount || ''));
  const [editDate, setEditDate] = useState(linkedPayment?.paymentDate || todayISODate());
  const [editMethod, setEditMethod] = useState<PaymentMethod>(linkedPayment?.paymentMethod || 'cash');
  const [editMode, setEditMode] = useState<PaymentAllocationMode>(
    linkedPayment?.allocationMode || 'principal_adjustment'
  );
  const [editNote, setEditNote] = useState(linkedPayment?.note || '');
  const [confirmReverse, setConfirmReverse] = useState(false);

  const editPreview = useMemo(() => {
    if (!editing || !linkedPayment || !credit || linkedPayment.paymentType !== 'credit_payment') return null;
    return previewHistoricalPaymentEdit({
      credit,
      adjustments: creditAdjustments,
      payments,
      editedPaymentId: linkedPayment.id,
      newAmount: Number(editAmountStr) || 0,
      newPaymentDate: editDate,
      newAllocationMode: editMode,
      precision,
    });
  }, [editing, linkedPayment, credit, creditAdjustments, payments, editAmountStr, editDate, editMode, precision]);

  if (!tx) {
    return <p className="text-sm text-slate-500">Transaction not found.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <div>
          <div className="text-xs font-mono-num text-violet-600 dark:text-violet-400">{tx.id}</div>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{tx.description}</h1>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Loan Taker</span>
            <span className="font-semibold">{profile?.name || '-'}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Credit Number</span>
            <span className="font-mono-num font-semibold">{credit?.creditNumber || 'N/A'}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Transaction Type</span>
            <span className="capitalize">{tx.transactionType.replace(/_/g, ' ')}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Effective Date</span>
            <span className="font-mono-num">{formatDateDDMMYYYY(tx.effectiveDate)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-mono-num font-bold">{formatINR(tx.amount, precision)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Previous Principal</span>
            <span className="font-mono-num">{formatINR(tx.previousPrincipal, precision)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Previous Interest</span>
            <span className="font-mono-num">{formatINR(tx.previousInterest, precision)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">Previous Misradhan</span>
            <span className="font-mono-num">{formatINR(tx.previousMisradhan, precision)}</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-slate-500">New Principal</span>
            <span className="font-mono-num font-bold text-blue-600 dark:text-blue-400">
              {formatINR(tx.newPrincipal, precision)}
            </span>
          </div>
        </div>

        {linkedPayment && !linkedPayment.reversed && (
          <div className="flex flex-wrap gap-2 pt-2">
            {linkedPayment.paymentType === 'credit_payment' && (
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Historical Payment
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmReverse(true)}
              className="px-4 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reverse / Delete Payment
            </button>
            <button
              type="button"
              onClick={() => navigate({ screen: 'payment_receipt', paymentId: linkedPayment.id })}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
            >
              View Receipt
            </button>
          </div>
        )}

        {linkedPayment?.reversed && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 font-medium">
            This payment was reversed on {formatDateDDMMYYYY(linkedPayment.reversedAt?.slice(0, 10))}.
          </div>
        )}
      </div>

      {/* Historical Edit Panel with Subsequent Impact Preview */}
      {editing && linkedPayment && credit && (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-violet-500/30 p-6 space-y-4">
          <h2 className="text-base font-bold">Edit Historical Payment ({linkedPayment.receiptNumber})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={editAmountStr}
                onChange={(e) => setEditAmountStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Method</label>
              <select
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <DateInput label="Payment Date" value={editDate} onChange={setEditDate} />
          <div>
            <label className="block text-xs font-medium mb-1">Allocation Mode</label>
            <select
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as PaymentAllocationMode)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            >
              <option value="principal_adjustment">Principal Adjustment</option>
              <option value="interest_first">Interest First</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Note</label>
            <textarea
              rows={2}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
            />
          </div>

          {editPreview && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-2 text-xs font-mono-num">
              <div className="font-sans font-bold text-amber-700 dark:text-amber-300">
                Affected Subsequent Balances Preview (Today)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>Before Principal: {formatINR(editPreview.before.currentPrincipal, precision)}</div>
                <div>After Principal: {formatINR(editPreview.after.currentPrincipal, precision)}</div>
                <div>Before Interest: {formatINR(editPreview.before.totalInterest, precision)}</div>
                <div>After Interest: {formatINR(editPreview.after.totalInterest, precision)}</div>
                <div>Before Outstanding: {formatINR(editPreview.before.outstandingAmount, precision)}</div>
                <div className="font-bold">After Outstanding: {formatINR(editPreview.after.outstandingAmount, precision)}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await editCreditPayment({
                  paymentId: linkedPayment.id,
                  amount: Number(editAmountStr) || 0,
                  paymentDate: editDate,
                  paymentMethod: editMethod,
                  allocationMode: editMode,
                  note: editNote,
                });
                setEditing(false);
                showToast('Historical payment updated & balances recalculated', 'success');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Confirm Recalculation
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmReverse}
        danger
        title="Reverse Payment?"
        message="This will reverse the payment, restore subsequent credit balances safely, and record a reversal entry in audit history."
        confirmLabel="Reverse Payment"
        onCancel={() => setConfirmReverse(false)}
        onConfirm={async () => {
          setConfirmReverse(false);
          if (linkedPayment) {
            await reversePayment(linkedPayment.id, 'User reversed from transaction details');
            showToast('Payment reversed & balances recalculated', 'info');
          }
        }}
      />
    </div>
  );
};
