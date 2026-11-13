import React, { useMemo } from 'react';
import {
  ArrowRight,
  Bell,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { MonthlyCollectionChart } from '../components/Charts';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import { reconstructCreditState } from '../engine/finance';
import type { DateFilterPreset } from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const DashboardScreen: React.FC = () => {
  const {
    profiles,
    credits,
    payments,
    creditAdjustments,
    transactions,
    reminders,
    dashboard,
    dateFilter,
    setDateFilter,
    globalSearch,
    setGlobalSearch,
    navigate,
    settings,
    loadDemoData,
    t,
  } = useApp();

  const precision = settings.financialPreferences.decimalPrecision;

  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;
    const matchedProfiles = profiles.filter(
      (p) => !p.archivedAt && (p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q))
    );
    const matchedCredits = credits.filter((c) => c.creditNumber.toLowerCase().includes(q));
    const matchedPayments = payments.filter(
      (p) => p.receiptNumber.toLowerCase().includes(q) || p.note.toLowerCase().includes(q)
    );
    const matchedTx = transactions.filter(
      (tx) =>
        tx.id.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        (tx.receiptNumber || '').toLowerCase().includes(q)
    );
    return { matchedProfiles, matchedCredits, matchedPayments, matchedTx };
  }, [globalSearch, profiles, credits, payments, transactions]);

  const recentCredits = useMemo(() => {
    return [...credits]
      .filter((c) => c.status !== 'archived')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((c) => {
        const profile = profiles.find((p) => p.id === c.profileId);
        const state = reconstructCreditState(c, creditAdjustments, payments, todayISODate(), precision);
        return { credit: c, profile, state };
      });
  }, [credits, profiles, creditAdjustments, payments, precision]);

  const outstandingCredits = useMemo(() => {
    return credits
      .filter((c) => c.status === 'active')
      .map((c) => {
        const profile = profiles.find((p) => p.id === c.profileId);
        const state = reconstructCreditState(c, creditAdjustments, payments, todayISODate(), precision);
        return { credit: c, profile, state };
      })
      .filter((x) => x.state.outstandingAmount > 0)
      .sort((a, b) => b.state.outstandingAmount - a.state.outstandingAmount)
      .slice(0, 5);
  }, [credits, profiles, creditAdjustments, payments, precision]);

  const recentPayments = useMemo(() => {
    return [...payments]
      .filter((p) => !p.reversed)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((p) => ({
        payment: p,
        profile: profiles.find((pr) => pr.id === p.profileId),
        credit: p.creditId ? credits.find((c) => c.id === p.creditId) : null,
      }));
  }, [payments, profiles, credits]);

  const upcomingReminders = useMemo(() => {
    return [...reminders]
      .filter((r) => r.status === 'pending')
      .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate))
      .slice(0, 4)
      .map((r) => ({
        reminder: r,
        profile: profiles.find((p) => p.id === r.profileId),
      }));
  }, [reminders, profiles]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((tx) => ({
        tx,
        profile: profiles.find((p) => p.id === tx.profileId),
      }));
  }, [transactions, profiles]);

  const isEmpty = profiles.length === 0 && credits.length === 0;

  return (
    <div className="space-y-6">
      {/* Search & Quick Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15152B] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('add_profile')}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-500/40 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4 text-violet-500" />
            <span>{t('addLoanTaker')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('add_credit')}
            className="px-3.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addCredit')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('add_payment')}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            <span>{t('addPayment')}</span>
          </button>
        </div>
      </div>

      {/* Live Global Search Results */}
      {searchResults && (
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-violet-500/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Search Results for &ldquo;{globalSearch}&rdquo;
            </h2>
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              className="text-xs text-violet-600 dark:text-violet-400 font-medium"
            >
              Clear
            </button>
          </div>
          {searchResults.matchedProfiles.length === 0 &&
          searchResults.matchedCredits.length === 0 &&
          searchResults.matchedPayments.length === 0 &&
          searchResults.matchedTx.length === 0 ? (
            <p className="text-sm text-slate-500">No matching profiles, credits, receipts, or transactions found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.matchedProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate({ screen: 'profile_details', profileId: p.id })}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 text-left hover:border-violet-500/50"
                >
                  <div className="text-xs text-violet-500 font-medium">Profile</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</div>
                  {p.phone && <div className="text-xs text-slate-500 font-mono-num">{p.phone}</div>}
                </button>
              ))}
              {searchResults.matchedCredits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate({ screen: 'credit_details', creditId: c.id })}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 text-left hover:border-violet-500/50"
                >
                  <div className="text-xs text-blue-500 font-medium">Credit</div>
                  <div className="text-sm font-semibold font-mono-num text-slate-900 dark:text-white">
                    {c.creditNumber}
                  </div>
                  <div className="text-xs text-slate-500">{formatINR(c.currentPrincipal, precision)}</div>
                </button>
              ))}
              {searchResults.matchedPayments.map((pay) => (
                <button
                  key={pay.id}
                  type="button"
                  onClick={() => navigate({ screen: 'payment_receipt', paymentId: pay.id })}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 text-left hover:border-violet-500/50"
                >
                  <div className="text-xs text-emerald-500 font-medium">Receipt</div>
                  <div className="text-sm font-semibold font-mono-num text-slate-900 dark:text-white">
                    {pay.receiptNumber}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatINR(pay.amount, precision)} · {formatDateDDMMYYYY(pay.paymentDate)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty State Onboarding Banner */}
      {isEmpty && (
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 sm:p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-600/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{t('noRecordsYet')}</h1>
          <p className="mt-2 max-w-lg mx-auto text-sm text-slate-600 dark:text-slate-300">
            {t('emptyDashboardHint')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('add_profile')}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
            >
              {t('addLoanTaker')}
            </button>
            <button
              type="button"
              onClick={loadDemoData}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-semibold"
            >
              {t('loadSampleData')}
            </button>
          </div>
        </section>
      )}

      {/* Primary 4 Financial Summary Cards */}
      <section aria-label="Primary Financial Totals" className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 sm:p-5">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">{t('totalPrincipal')}</div>
          <div
            data-testid="dash-total-principal"
            className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-num text-blue-600 dark:text-blue-400 truncate"
          >
            {formatINR(dashboard.totalPrincipal, precision)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            {dashboard.totalActiveCredits} {t('activeCredits')}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 sm:p-5">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{t('totalInterest')}</div>
          <div
            data-testid="dash-total-interest"
            className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-num text-amber-600 dark:text-amber-400 truncate"
          >
            {formatINR(dashboard.totalInterest, precision)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
            {t('todaysInterest')}: {formatINR(dashboard.todayInterestAccrued, precision)}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 sm:p-5">
          <div className="text-xs font-semibold text-violet-600 dark:text-violet-400">{t('totalMisradhan')}</div>
          <div
            data-testid="dash-total-misradhan"
            className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-num text-violet-600 dark:text-violet-400 truncate"
          >
            {formatINR(dashboard.totalMisradhan, precision)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-red-500 dark:text-red-400 font-mono-num truncate">
            {t('currentOutstanding')}: {formatINR(dashboard.currentOutstanding, precision)}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 sm:p-5">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('totalPaidAmount')}</div>
          <div
            data-testid="dash-total-paid"
            className="mt-1.5 text-xl sm:text-2xl font-extrabold font-mono-num text-emerald-600 dark:text-emerald-400 truncate"
          >
            {formatINR(dashboard.totalPaidAmount, precision)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
            Credit: {formatINR(dashboard.totalCreditPaid, 0)} · Normal: {formatINR(dashboard.totalNormalPaid, 0)}
          </div>
        </div>
      </section>

      {/* Secondary Portfolio Counters */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('totalLoanTakers'), value: String(dashboard.totalLoanTakers), color: 'text-slate-900 dark:text-white' },
          { label: t('activeCredits'), value: String(dashboard.totalActiveCredits), color: 'text-blue-600 dark:text-blue-400' },
          { label: t('closedCredits'), value: String(dashboard.totalClosedCredits), color: 'text-slate-600 dark:text-slate-300' },
          { label: t('totalCreditRecords'), value: String(dashboard.totalCreditRecords), color: 'text-violet-600 dark:text-violet-400' },
          { label: t('totalMoneyGiven'), value: formatINR(dashboard.totalMoneyGiven, precision), color: 'text-blue-600 dark:text-blue-400' },
          { label: t('totalMoneyReceived'), value: formatINR(dashboard.totalMoneyReceived, precision), color: 'text-emerald-600 dark:text-emerald-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 px-4 py-3"
          >
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{stat.label}</div>
            <div className={`mt-1 text-base font-bold font-mono-num ${stat.color} truncate`}>{stat.value}</div>
          </div>
        ))}
      </section>

      {/* Date Filter & Monthly Collection Chart */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>{t('monthlyCollection')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num">
              Filtered Period Received: {formatINR(dashboard.filteredCollectionTotal, precision)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0B0B18] rounded-xl">
            {(
              [
                { id: 'all', label: t('allTime') },
                { id: 'today', label: t('today') },
                { id: 'week', label: t('thisWeek') },
                { id: 'month', label: t('thisMonth') },
                { id: 'year', label: t('thisYear') },
                { id: 'custom', label: t('customRange') },
              ] as { id: DateFilterPreset; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateFilter({ ...dateFilter, preset: opt.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  dateFilter.preset === opt.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter.preset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
            <DateInput
              label="From Date"
              value={dateFilter.startDate || todayISODate()}
              onChange={(d) => setDateFilter({ ...dateFilter, startDate: d })}
            />
            <DateInput
              label="To Date"
              value={dateFilter.endDate || todayISODate()}
              onChange={(d) => setDateFilter({ ...dateFilter, endDate: d })}
            />
          </div>
        )}

        <MonthlyCollectionChart data={dashboard.monthlyCollections} precision={precision} />
      </section>

      {/* Main Dashboard Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Loan Takers */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />
              <span>{t('recentLoanTakers')}</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('profiles')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {dashboard.profileSummaries.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No loan takers added yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {dashboard.profileSummaries.slice(0, 5).map((ps) => (
                <button
                  key={ps.profile.id}
                  type="button"
                  onClick={() => navigate({ screen: 'profile_details', profileId: ps.profile.id })}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {ps.profile.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ps.activeCreditCount} Active · Paid {formatINR(ps.totalPaidAmount, precision)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-red-500 dark:text-red-400">
                      {formatINR(ps.currentOutstanding, precision)}
                    </div>
                    <div className="text-[11px] text-slate-400">Outstanding</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Outstanding Credits */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('outstandingCredits')}</h2>
            <button
              type="button"
              onClick={() => navigate('credit_list')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"
            >
              All Credits <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {outstandingCredits.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No active outstanding credits.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {outstandingCredits.map(({ credit, profile, state }) => (
                <button
                  key={credit.id}
                  type="button"
                  onClick={() => navigate({ screen: 'credit_details', creditId: credit.id })}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      <span className="font-mono-num text-violet-600 dark:text-violet-400">{credit.creditNumber}</span>
                      {' · '}
                      {profile?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono-num">
                      Prin: {formatINR(state.currentPrincipal, precision)} · Int: {formatINR(state.totalInterest, precision)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-violet-600 dark:text-violet-400">
                      {formatINR(state.totalMisradhan, precision)}
                    </div>
                    <div className="text-[11px] text-slate-400">Misradhan</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Credit Records */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('recentCredits')}</h2>
            <button
              type="button"
              onClick={() => navigate('add_credit')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              + New
            </button>
          </div>
          {recentCredits.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No credit records yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {recentCredits.map(({ credit, profile, state }) => (
                <button
                  key={credit.id}
                  type="button"
                  onClick={() => navigate({ screen: 'daily_credit_update', creditId: credit.id })}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {credit.creditNumber} · {profile?.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateDDMMYYYY(credit.startDate)} · {credit.interestRate}% ({credit.interestPeriod})
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-blue-600 dark:text-blue-400">
                      {formatINR(state.currentPrincipal, precision)}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">{credit.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Payments */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('recentPayments')}</h2>
            <button
              type="button"
              onClick={() => navigate('transactions')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"
            >
              History <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {recentPayments.map(({ payment, profile, credit }) => (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() => navigate({ screen: 'payment_receipt', paymentId: payment.id })}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {profile?.name || 'Unknown'} · {payment.receiptNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateDDMMYYYY(payment.paymentDate)} ·{' '}
                      {credit ? `Credit ${credit.creditNumber}` : 'Normal Payment'}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{formatINR(payment.amount, precision)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Reminders */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>{t('upcomingReminders')}</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('reminders')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Manage
            </button>
          </div>
          {upcomingReminders.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No upcoming reminders.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {upcomingReminders.map(({ reminder, profile }) => (
                <div key={reminder.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {profile?.name || 'Reminder'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{reminder.note || 'Follow-up due'}</div>
                  </div>
                  <div className="text-xs font-mono-num text-amber-600 dark:text-amber-400 shrink-0">
                    {formatDateDDMMYYYY(reminder.reminderDate)} {reminder.reminderTime}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('recentTransactions')}</h2>
            <button
              type="button"
              onClick={() => navigate('transactions')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Full Ledger
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No ledger transactions yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {recentTransactions.map(({ tx, profile }) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => navigate({ screen: 'transaction_details', transactionId: tx.id })}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {tx.description}
                    </div>
                    <div className="text-xs text-slate-500">
                      {profile?.name} · {formatDateDDMMYYYY(tx.effectiveDate)}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono-num text-slate-700 dark:text-slate-200 shrink-0">
                    {formatINR(tx.amount, precision)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
