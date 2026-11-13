import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  Sliders,
  Trash2,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import {
  calculateInterest,
  generateCreditStatement,
  previewMainCreditUpdate,
  reconstructCreditState,
} from '../engine/finance';
import { copyToClipboard, shareText } from '../services/share';
import type { InterestMethod, InterestPeriod } from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const CreditListScreen: React.FC = () => {
  const { credits, profiles, creditAdjustments, payments, settings, navigate, t } = useApp();
  const [filter, setFilter] = useState<'active' | 'closed' | 'archived' | 'all'>('active');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');
  const precision = settings.financialPreferences.decimalPrecision;

  const list = useMemo(() => {
    const items = credits
      .filter((c) => (filter === 'all' ? true : c.status === filter))
      .map((c) => ({
        credit: c,
        profile: profiles.find((p) => p.id === c.profileId),
        state: reconstructCreditState(c, creditAdjustments, payments, todayISODate(), precision),
      }));

    if (sortBy === 'recent') items.sort((a, b) => b.credit.startDate.localeCompare(a.credit.startDate));
    if (sortBy === 'oldest') items.sort((a, b) => a.credit.startDate.localeCompare(b.credit.startDate));
    if (sortBy === 'highest') items.sort((a, b) => b.state.outstandingAmount - a.state.outstandingAmount);
    if (sortBy === 'lowest') items.sort((a, b) => a.state.outstandingAmount - b.state.outstandingAmount);
    return items;
  }, [credits, profiles, creditAdjustments, payments, filter, sortBy, precision]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('totalCreditRecords')}</h1>
          <p className="text-xs text-slate-500">Universal Credit Ledger — No categories, independent interest tracking</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('add_credit')}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {t('addCredit')}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10">
          {(['active', 'closed', 'archived', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                filter === f ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <select
          aria-label="Sort credits"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15152B] px-3 py-2 text-xs font-medium"
        >
          <option value="recent">Recent Credits</option>
          <option value="oldest">Oldest Credits</option>
          <option value="highest">Highest Outstanding</option>
          <option value="lowest">Lowest Outstanding</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-8 text-center text-sm text-slate-500">
          No credits match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(({ credit, profile, state }) => (
            <div
              key={credit.id}
              className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold font-mono-num text-violet-600 dark:text-violet-400">
                    {credit.creditNumber}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {profile?.name || 'Unknown Profile'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Start {formatDateDDMMYYYY(credit.startDate)} · {state.activeInterestRate}% ({state.activeInterestPeriod})
                  </div>
                </div>
                <span className="text-xs font-semibold uppercase text-slate-500">{credit.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-white/5 text-xs">
                <div>
                  <div className="text-slate-500">Principal</div>
                  <div className="font-bold font-mono-num text-blue-600 dark:text-blue-400">
                    {formatINR(state.currentPrincipal, precision)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Interest</div>
                  <div className="font-bold font-mono-num text-amber-600 dark:text-amber-400">
                    {formatINR(state.totalInterest, precision)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Misradhan</div>
                  <div className="font-bold font-mono-num text-violet-600 dark:text-violet-400">
                    {formatINR(state.totalMisradhan, precision)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => navigate({ screen: 'daily_credit_update', creditId: credit.id })}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold"
                >
                  Daily Update
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ screen: 'credit_details', creditId: credit.id })}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold"
                >
                  Open Credit
                </button>
                {credit.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => navigate({ screen: 'add_payment', profileId: credit.profileId, creditId: credit.id })}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Add Payment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AddCreditScreen: React.FC<{ initialProfileId?: string }> = ({ initialProfileId }) => {
  const { profiles, credits, settings, nextCreditNumber, addCredit, navigate, goBack, showToast, t } = useApp();
  const activeProfiles = profiles.filter((p) => !p.archivedAt);

  const [profileId, setProfileId] = useState(initialProfileId || activeProfiles[0]?.id || '');
  const [creditNumber, setCreditNumber] = useState(nextCreditNumber());
  const [principalStr, setPrincipalStr] = useState('');
  const [rateStr, setRateStr] = useState('');
  const [interestPeriod, setInterestPeriod] = useState<InterestPeriod>(settings.financialPreferences.defaultInterestPeriod);
  const [interestMethod, setInterestMethod] = useState<InterestMethod>(settings.financialPreferences.defaultInterestMethod);
  const [startDate, setStartDate] = useState(todayISODate());
  const [note, setNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const precision = settings.financialPreferences.decimalPrecision;

  const principalNum = Number(principalStr);
  const rateNum = Number(rateStr);

  const oneMonthProjection = useMemo(() => {
    if (!(principalNum > 0) || !(rateNum >= 0)) return 0;
    const oneMonthLater = calculateInterest({
      principal: principalNum,
      rate: rateNum,
      interestPeriod,
      interestMethod,
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      precision,
    });
    return oneMonthLater.interest;
  }, [principalNum, rateNum, interestPeriod, interestMethod, precision]);

  const validate = () => {
    if (!profileId) return 'Please select a Loan Taker profile (or create one first).';
    if (!creditNumber.trim()) return 'Credit Number is required.';
    if (credits.some((c) => c.creditNumber.trim().toLowerCase() === creditNumber.trim().toLowerCase())) {
      return `Credit Number "${creditNumber}" already exists. Please use a unique number.`;
    }
    if (!Number.isFinite(principalNum) || principalNum <= 0) return 'Principal Amount must be a positive number.';
    if (!Number.isFinite(rateNum) || rateNum < 0) return 'Interest Rate must be 0 or positive.';
    if (!startDate) return 'Starting Date is required.';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const created = await addCredit({
      profileId,
      creditNumber: creditNumber.trim(),
      principal: principalNum,
      interestRate: rateNum,
      interestPeriod,
      interestMethod,
      startDate,
      note,
    });
    showToast(`Credit ${created.creditNumber} created`, 'success');
    navigate({ screen: 'daily_credit_update', creditId: created.id });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('addCredit')}</h1>

        {activeProfiles.length === 0 ? (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            <p className="text-amber-700 dark:text-amber-300">Create a Loan Taker profile before adding a credit.</p>
            <button
              type="button"
              onClick={() => navigate('add_profile')}
              className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              {t('addLoanTaker')}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="credit-profile" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Loan Taker <span className="text-red-500">*</span>
                </label>
                <select
                  id="credit-profile"
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

              <div>
                <label htmlFor="credit-number" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('creditNumber')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="credit-number"
                  type="text"
                  value={creditNumber}
                  onChange={(e) => {
                    setCreditNumber(e.target.value);
                    setError('');
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="credit-principal" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('principalAmount')} (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  id="credit-principal"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={principalStr}
                  onChange={(e) => {
                    setPrincipalStr(e.target.value);
                    setError('');
                  }}
                  placeholder="10000"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
                />
                {principalNum > 0 && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-mono-num">
                    {formatINR(principalNum, precision)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="credit-rate" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('interestRate')} (%) <span className="text-red-500">*</span>
                </label>
                <input
                  id="credit-rate"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={rateStr}
                  onChange={(e) => {
                    setRateStr(e.target.value);
                    setError('');
                  }}
                  placeholder="2"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('interestPeriod')}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0B18]">
                  {(['monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setInterestPeriod(p)}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                        interestPeriod === p ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {p === 'monthly' ? t('monthly') : t('yearly')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('interestMethod')}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0B18]">
                  {(['simple', 'compound'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setInterestMethod(m)}
                      className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                        interestMethod === m ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {m === 'simple' ? t('simpleInterest') : t('compoundInterest')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DateInput id="credit-start-date" label={t('startingDate')} value={startDate} onChange={setStartDate} required />

            <div>
              <label htmlFor="credit-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {t('notes')}
              </label>
              <textarea
                id="credit-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
              />
            </div>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            {/* Live Credit Summary Preview */}
            {showPreview && (
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 p-4 space-y-2 text-xs">
                <div className="font-bold text-violet-600 dark:text-violet-300">Credit Summary Preview</div>
                <div className="grid grid-cols-2 gap-2 font-mono-num">
                  <div>Loan Taker: {activeProfiles.find((p) => p.id === profileId)?.name}</div>
                  <div>Credit #: {creditNumber}</div>
                  <div>Principal: {formatINR(principalNum || 0, precision)}</div>
                  <div>Rate: {rateNum || 0}% ({interestPeriod})</div>
                  <div>Start Date: {formatDateDDMMYYYY(startDate)}</div>
                  <div>1 Month Est. Interest: {formatINR(oneMonthProjection, precision)}</div>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              {!showPreview ? (
                <button
                  type="button"
                  onClick={() => {
                    const err = validate();
                    if (err) setError(err);
                    else setShowPreview(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
                >
                  Preview Credit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  Confirm &amp; Save Credit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const DailyCreditUpdateScreen: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { credits, profiles, creditAdjustments, payments, settings, navigate, showToast, t } = useApp();
  const [calcDate, setCalcDate] = useState(todayISODate());
  const precision = settings.financialPreferences.decimalPrecision;

  const credit = credits.find((c) => c.id === creditId);
  const profile = credit ? profiles.find((p) => p.id === credit.profileId) : undefined;

  const state = useMemo(() => {
    if (!credit) return null;
    return reconstructCreditState(credit, creditAdjustments, payments, calcDate, precision);
  }, [credit, creditAdjustments, payments, calcDate, precision]);

  if (!credit || !profile || !state) {
    return <p className="text-sm text-slate-500">Credit not found.</p>;
  }

  const summaryText = [
    `CREDIT LOGGER — DAILY UPDATE`,
    `Profile: ${profile.name}`,
    `Credit Number: ${credit.creditNumber}`,
    `Original Principal: ${formatINR(state.originalPrincipal, precision)}`,
    `Current Principal: ${formatINR(state.currentPrincipal, precision)}`,
    `Interest Rate: ${state.activeInterestRate}% (${state.activeInterestPeriod}, ${state.activeInterestMethod})`,
    `Starting Date: ${formatDateDDMMYYYY(credit.startDate)}`,
    `Last Adjustment Date: ${formatDateDDMMYYYY(state.lastAdjustmentDate)}`,
    `Calculation Date: ${formatDateDDMMYYYY(calcDate)}`,
    `Duration: ${state.durationSinceStart.completedMonths} Calendar Months, ${state.durationSinceStart.remainingDays} Remaining Days (${state.durationSinceStart.totalDays} Total Days)`,
    `Total Interest: ${formatINR(state.totalInterest, precision)}`,
    `Total Misradhan: ${formatINR(state.totalMisradhan, precision)}`,
    `Total Paid: ${formatINR(state.totalPaidOnCredit, precision)}`,
    `Outstanding Amount: ${formatINR(state.outstandingAmount, precision)}`,
  ].join('\n');

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-[#15152B] via-[#1E1B4B] to-[#3B0764] text-white p-6 shadow-xl border border-violet-500/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">{t('dailyUpdate')}</div>
            <h1 className="mt-1 text-2xl font-extrabold font-mono-num">{credit.creditNumber}</h1>
            <p className="text-sm text-violet-200">{profile.name}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-violet-300">{t('totalMisradhan')}</div>
            <div data-testid="daily-misradhan" className="text-3xl font-extrabold font-mono-num text-white">
              {formatINR(state.totalMisradhan, precision)}
            </div>
            <div className="text-xs text-emerald-300 font-mono-num">
              Paid: {formatINR(state.totalPaidOnCredit, precision)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15">
          <div>
            <div className="text-[11px] text-violet-200/80">Original Principal</div>
            <div className="text-sm font-bold font-mono-num">{formatINR(state.originalPrincipal, precision)}</div>
          </div>
          <div>
            <div className="text-[11px] text-blue-300">Current Principal</div>
            <div data-testid="daily-principal" className="text-sm font-bold font-mono-num text-blue-300">
              {formatINR(state.currentPrincipal, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-amber-300">Total Interest</div>
            <div data-testid="daily-interest" className="text-sm font-bold font-mono-num text-amber-300">
              {formatINR(state.totalInterest, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-red-300">Outstanding</div>
            <div className="text-sm font-bold font-mono-num text-red-300">
              {formatINR(state.outstandingAmount, precision)}
            </div>
          </div>
        </div>
      </div>

      {/* Calculation Date & Calendar Breakdown */}
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <DateInput
          id="daily-calc-date"
          label={t('calculationDate')}
          value={calcDate}
          onChange={setCalcDate}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Starting Date</div>
            <div className="mt-1 font-bold font-mono-num">{formatDateDDMMYYYY(credit.startDate)}</div>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Last Adjustment Date</div>
            <div className="mt-1 font-bold font-mono-num">{formatDateDDMMYYYY(state.lastAdjustmentDate)}</div>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Interest Rate</div>
            <div className="mt-1 font-bold font-mono-num">
              {state.activeInterestRate}% / {state.activeInterestPeriod}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Total Calendar Months</div>
            <div className="mt-1 font-bold font-mono-num">{state.durationSinceStart.completedMonths} Months</div>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Remaining Days</div>
            <div className="mt-1 font-bold font-mono-num">{state.durationSinceStart.remainingDays} Days</div>
          </div>
          <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
            <div className="text-slate-500">Total Days</div>
            <div className="mt-1 font-bold font-mono-num">{state.durationSinceStart.totalDays} Days</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setCalcDate(todayISODate());
              showToast('Calculation refreshed to today', 'success');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('refreshCalculation')}
          </button>
          <button
            type="button"
            onClick={async () => {
              await copyToClipboard(summaryText);
              showToast('Summary copied', 'success');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> {t('copySummary')}
          </button>
          <button
            type="button"
            onClick={() => shareText(`${credit.creditNumber} Summary`, summaryText)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> {t('shareCredit')}
          </button>
          {credit.status === 'active' && (
            <>
              <button
                type="button"
                onClick={() => navigate({ screen: 'add_payment', profileId: profile.id, creditId: credit.id })}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                + {t('addPayment')}
              </button>
              <button
                type="button"
                onClick={() => navigate({ screen: 'main_credit_update', creditId: credit.id })}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
              >
                {t('mainUpdate')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const CreditDetailsScreen: React.FC<{ creditId: string }> = ({ creditId }) => {
  const {
    credits,
    profiles,
    creditAdjustments,
    payments,
    settings,
    navigate,
    closeCredit,
    reopenCredit,
    archiveCredit,
    deleteCredit,
    showToast,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const precision = settings.financialPreferences.decimalPrecision;

  const credit = credits.find((c) => c.id === creditId);
  const profile = credit ? profiles.find((p) => p.id === credit.profileId) : undefined;
  const state = useMemo(
    () => (credit ? reconstructCreditState(credit, creditAdjustments, payments, todayISODate(), precision) : null),
    [credit, creditAdjustments, payments, precision]
  );

  if (!credit || !profile || !state) {
    return <p className="text-sm text-slate-500">Credit not found.</p>;
  }

  const creditPayments = payments
    .filter((p) => p.creditId === credit.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const adjustments = creditAdjustments
    .filter((a) => a.creditId === credit.id)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold font-mono-num text-violet-600 dark:text-violet-400">
                {credit.creditNumber}
              </h1>
              <span className="text-xs font-semibold uppercase text-slate-500">· {credit.status}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate({ screen: 'profile_details', profileId: profile.id })}
              className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:underline"
            >
              {profile.name}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ screen: 'daily_credit_update', creditId: credit.id })}
              className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Daily Update
            </button>
            <button
              type="button"
              onClick={() => navigate({ screen: 'edit_credit', creditId: credit.id })}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => navigate({ screen: 'main_credit_update', creditId: credit.id })}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" /> Main Update
            </button>
            <button
              type="button"
              onClick={() => navigate({ screen: 'pdf_preview', pdfMode: 'credit', creditId: credit.id })}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> Statement
            </button>
            <button
              type="button"
              onClick={() => shareText(`${credit.creditNumber} Statement`, generateCreditStatement(profile, state, payments, precision))}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
          <div>
            <div className="text-[11px] text-slate-500">Original Principal</div>
            <div className="text-sm font-bold font-mono-num">{formatINR(state.originalPrincipal, precision)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Current Principal</div>
            <div className="text-sm font-bold font-mono-num text-blue-600 dark:text-blue-400">
              {formatINR(state.currentPrincipal, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Accrued Interest</div>
            <div className="text-sm font-bold font-mono-num text-amber-600 dark:text-amber-400">
              {formatINR(state.totalInterest, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Total Misradhan</div>
            <div className="text-sm font-bold font-mono-num text-violet-600 dark:text-violet-400">
              {formatINR(state.totalMisradhan, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Outstanding</div>
            <div className="text-sm font-bold font-mono-num text-red-500 dark:text-red-400">
              {formatINR(state.outstandingAmount, precision)}
            </div>
          </div>
        </div>

        {state.advanceBalance > 0 && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-mono-num">
            Advance Overpayment Balance: {formatINR(state.advanceBalance, precision)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {credit.status === 'active' && (
            <button
              type="button"
              onClick={() => navigate({ screen: 'add_payment', profileId: profile.id, creditId: credit.id })}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              + Add Credit Payment
            </button>
          )}
          {credit.status === 'active' ? (
            <button
              type="button"
              onClick={async () => {
                await closeCredit(credit.id);
                showToast('Credit closed', 'success');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Close Credit
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await reopenCredit(credit.id);
                showToast('Credit reopened', 'success');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-violet-500" /> Reopen Credit
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await archiveCredit(credit.id);
              showToast('Credit archived', 'info');
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
          >
            <Archive className="w-3.5 h-3.5 text-amber-500" /> Archive
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Individual Credit Payment History */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          Individual Credit Payment History ({creditPayments.length})
        </h2>
        {creditPayments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded on this credit yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {creditPayments.map((p) => (
              <div key={p.id} className="py-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate({ screen: 'payment_receipt', paymentId: p.id })}
                      className="text-sm font-bold font-mono-num text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      {p.receiptNumber} {p.reversed ? '· REVERSED' : ''}
                    </button>
                    <div className="text-xs text-slate-500">
                      {formatDateDDMMYYYY(p.paymentDate)} · {p.paymentMethod.toUpperCase()} ·{' '}
                      {p.allocationMode === 'principal_adjustment' ? 'Principal Adjustment' : 'Interest First'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                      {formatINR(p.amount, precision)}
                    </div>
                    <div className="text-xs font-mono-num text-slate-500">
                      {formatINR(p.previousMisradhan, precision)} → New Prin: {formatINR(p.newPrincipal, precision)}
                    </div>
                  </div>
                </div>
                {p.note && (
                  <pre className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap font-sans bg-slate-50 dark:bg-[#0B0B18] p-2.5 rounded-xl">
                    {p.note}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Effective-Dated Adjustments */}
      {adjustments.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
            Principal &amp; Rate Adjustment Events ({adjustments.length})
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {adjustments.map((adj) => (
              <div key={adj.id} className="py-3 text-xs flex justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Effective {formatDateDDMMYYYY(adj.effectiveDate)}
                  </div>
                  <div className="text-slate-500">{adj.note || 'Main Credit Update'}</div>
                </div>
                <div className="text-right font-mono-num">
                  <div>
                    Prin: {formatINR(adj.previousPrincipal, precision)} → {formatINR(adj.newPrincipal, precision)}
                  </div>
                  <div className="text-slate-500">
                    Rate: {adj.previousInterestRate}% → {adj.newInterestRate}% ({adj.newInterestPeriod})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmModal
        open={confirmDelete}
        danger
        title="Delete Credit Record?"
        message={`Deleting ${credit.creditNumber} will remove its payments and ledger adjustments. Prefer Archiving to retain financial audit history.`}
        confirmLabel="Delete Credit"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteCredit(credit.id);
          showToast('Credit deleted', 'info');
          navigate({ screen: 'profile_details', profileId: profile.id });
        }}
      />
    </div>
  );
};

export const EditCreditScreen: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { credits, updateCreditInfo, goBack, showToast } = useApp();
  const credit = credits.find((c) => c.id === creditId);

  const [creditNumber, setCreditNumber] = useState(credit?.creditNumber || '');
  const [startDate, setStartDate] = useState(credit?.startDate || todayISODate());
  const [note, setNote] = useState(credit?.note || '');
  const [error, setError] = useState('');

  if (!credit) return <p className="text-sm text-slate-500">Credit not found.</p>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditNumber.trim()) {
      setError('Credit Number is required.');
      return;
    }
    if (
      credits.some(
        (c) => c.id !== credit.id && c.creditNumber.trim().toLowerCase() === creditNumber.trim().toLowerCase()
      )
    ) {
      setError('Credit Number must be unique.');
      return;
    }
    await updateCreditInfo(credit.id, { creditNumber, startDate, note });
    showToast('Credit details updated', 'success');
    goBack();
  };

  return (
    <div className="max-w-xl mx-auto rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Edit Credit Info ({credit.creditNumber})</h1>
      <p className="mt-1 text-xs text-slate-500">
        For principal or interest rate changes, use Main Credit Update to preserve historical calculation periods.
      </p>
      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <div>
          <label htmlFor="edit-credit-num" className="block text-xs font-medium mb-1">
            Credit Number
          </label>
          <input
            id="edit-credit-num"
            type="text"
            value={creditNumber}
            onChange={(e) => setCreditNumber(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
          />
        </div>
        <DateInput label="Starting Date" value={startDate} onChange={setStartDate} />
        <div>
          <label htmlFor="edit-credit-note" className="block text-xs font-medium mb-1">
            Note
          </label>
          <textarea
            id="edit-credit-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={goBack} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export const MainCreditUpdateScreen: React.FC<{ creditId: string }> = ({ creditId }) => {
  const { credits, creditAdjustments, payments, settings, applyMainCreditUpdate, navigate, goBack, showToast } =
    useApp();
  const credit = credits.find((c) => c.id === creditId);
  const precision = settings.financialPreferences.decimalPrecision;

  const currentState = useMemo(
    () => (credit ? reconstructCreditState(credit, creditAdjustments, payments, todayISODate(), precision) : null),
    [credit, creditAdjustments, payments, precision]
  );

  const [newPrincipalStr, setNewPrincipalStr] = useState(String(currentState?.currentPrincipal ?? 0));
  const [newRateStr, setNewRateStr] = useState(String(currentState?.activeInterestRate ?? 0));
  const [newPeriod, setNewPeriod] = useState<InterestPeriod>(currentState?.activeInterestPeriod || 'monthly');
  const [effectiveDate, setEffectiveDate] = useState(todayISODate());
  const [note, setNote] = useState('');

  const preview = useMemo(() => {
    if (!credit) return null;
    return previewMainCreditUpdate({
      credit,
      adjustments: creditAdjustments,
      payments,
      newPrincipal: Number(newPrincipalStr) || 0,
      newRate: Number(newRateStr) || 0,
      newPeriod,
      effectiveDate,
      precision,
    });
  }, [credit, creditAdjustments, payments, newPrincipalStr, newRateStr, newPeriod, effectiveDate, precision]);

  if (!credit || !currentState || !preview) {
    return <p className="text-sm text-slate-500">Credit not found.</p>;
  }

  const handleConfirm = async () => {
    await applyMainCreditUpdate({
      creditId: credit.id,
      newPrincipal: Number(newPrincipalStr) || 0,
      newInterestRate: Number(newRateStr) || 0,
      newInterestPeriod: newPeriod,
      effectiveDate,
      note,
    });
    showToast('Main Credit Update recorded', 'success');
    navigate({ screen: 'credit_details', creditId: credit.id });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Main Credit Update — {credit.creditNumber}
        </h1>
        <p className="text-xs text-slate-500">
          Creates an effective-dated adjustment event. Historical interest accrued before {formatDateDDMMYYYY(effectiveDate)} stays intact.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="main-new-prin" className="block text-xs font-medium mb-1">
              New Principal Amount (₹)
            </label>
            <input
              id="main-new-prin"
              type="number"
              step="0.01"
              min="0"
              value={newPrincipalStr}
              onChange={(e) => setNewPrincipalStr(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
            />
          </div>
          <div>
            <label htmlFor="main-new-rate" className="block text-xs font-medium mb-1">
              New Interest Rate (%)
            </label>
            <input
              id="main-new-rate"
              type="number"
              step="0.0001"
              min="0"
              value={newRateStr}
              onChange={(e) => setNewRateStr(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0B18]">
          {(['monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setNewPeriod(p)}
              className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                newPeriod === p ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <DateInput label="Effective Date" value={effectiveDate} onChange={setEffectiveDate} required />

        <div>
          <label htmlFor="main-note" className="block text-xs font-medium mb-1">
            Note (Optional)
          </label>
          <input
            id="main-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for adjustment..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm"
          />
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 p-4 space-y-2 text-xs font-mono-num">
          <div className="font-bold text-violet-600 dark:text-violet-300 font-sans">Adjustment Preview</div>
          <div className="grid grid-cols-2 gap-2">
            <div>Old Principal: {formatINR(preview.oldPrincipal, precision)}</div>
            <div>New Principal: {formatINR(preview.newPrincipal, precision)}</div>
            <div>Old Rate: {preview.oldInterestRate}% ({preview.oldInterestPeriod})</div>
            <div>New Rate: {preview.newInterestRate}% ({preview.newInterestPeriod})</div>
            <div>Interest Accrued Until Date: {formatINR(preview.interestAccruedUntilEffectiveDate, precision)}</div>
            <div className="font-bold">New Misradhan: {formatINR(preview.newMisradhan, precision)}</div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={goBack} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold">
            Confirm Main Update
          </button>
        </div>
      </div>
    </div>
  );
};
