import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, FileDown, Plus, Share2, Trash2 } from 'lucide-react';
import { MonthlyCollectionChart, PrincipalVsInterestChart } from '../components/Charts';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import { calculateDashboardSummary, reconstructCreditState } from '../engine/finance';
import { scheduleReminderNotification } from '../services/platform';
import { createAnalyticsReportPdf } from '../services/pdf';
import { sharePdfDocument, shareText } from '../services/share';
import type { DateFilterPreset } from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const ReportsScreen: React.FC = () => {
  const { profiles, credits, creditAdjustments, payments, reminders, settings, showToast, t } = useApp();
  const [period, setPeriod] = useState<DateFilterPreset>('month');
  const [customStart, setCustomStart] = useState(todayISODate());
  const [customEnd, setCustomEnd] = useState(todayISODate());
  const precision = settings.financialPreferences.decimalPrecision;

  const reportSummary = useMemo(
    () =>
      calculateDashboardSummary(
        profiles,
        credits,
        creditAdjustments,
        payments,
        reminders,
        todayISODate(),
        { preset: period, startDate: customStart, endDate: customEnd },
        precision
      ),
    [profiles, credits, creditAdjustments, payments, reminders, period, customStart, customEnd, precision]
  );

  const creditStates = useMemo(
    () =>
      credits
        .filter((c) => c.status !== 'archived')
        .map((c) => ({
          profile: profiles.find((p) => p.id === c.profileId),
          state: reconstructCreditState(c, creditAdjustments, payments, todayISODate(), precision),
        })),
    [credits, profiles, creditAdjustments, payments, precision]
  );

  const handleExportPdf = async () => {
    const doc = createAnalyticsReportPdf(reportSummary, precision);
    await sharePdfDocument(doc, `credit-logger-report-${todayISODate()}.pdf`, 'CREDIT LOGGER Report');
    showToast('PDF report ready', 'success');
  };

  const handleShareReport = async () => {
    const text = [
      `CREDIT LOGGER — ANALYTICS REPORT (${formatDateDDMMYYYY(todayISODate())})`,
      `Total Given: ${formatINR(reportSummary.totalMoneyGiven, precision)}`,
      `Total Received: ${formatINR(reportSummary.totalMoneyReceived, precision)}`,
      `Current Principal: ${formatINR(reportSummary.totalPrincipal, precision)}`,
      `Current Interest: ${formatINR(reportSummary.totalInterest, precision)}`,
      `Total Misradhan: ${formatINR(reportSummary.totalMisradhan, precision)}`,
      `Current Outstanding: ${formatINR(reportSummary.currentOutstanding, precision)}`,
    ].join('\n');
    await shareText('CREDIT LOGGER Analytics Report', text);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('reportsAnalytics')}</h1>
          <p className="text-xs text-slate-500">Live collection reports, Principal vs Interest, and person-wise breakdowns</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareReport}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Report
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Period Filters */}
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'today', label: 'Daily Collection' },
                { id: 'week', label: 'Weekly Collection' },
                { id: 'month', label: 'Monthly Collection' },
                { id: 'year', label: 'Yearly Collection' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ] as { id: DateFilterPreset; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  period === opt.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-[#0B0B18] text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
            Period Collection: {formatINR(reportSummary.filteredCollectionTotal, precision)}
          </div>
        </div>
        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateInput label="Start Date" value={customStart} onChange={setCustomStart} />
            <DateInput label="End Date" value={customEnd} onChange={setCustomEnd} />
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
          <h2 className="text-base font-bold mb-3">Monthly Payment Chart</h2>
          <MonthlyCollectionChart data={reportSummary.monthlyCollections} precision={precision} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-4">
          <h2 className="text-base font-bold">Principal vs Interest vs Paid</h2>
          <PrincipalVsInterestChart
            principal={reportSummary.totalPrincipal}
            interest={reportSummary.totalInterest}
            paid={reportSummary.totalPaidAmount}
            precision={precision}
          />
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
              <div className="text-slate-500">Total Money Given</div>
              <div className="mt-1 text-sm font-bold font-mono-num text-blue-600 dark:text-blue-400">
                {formatINR(reportSummary.totalMoneyGiven, precision)}
              </div>
            </div>
            <div className="rounded-xl p-3 bg-slate-50 dark:bg-[#0B0B18]">
              <div className="text-slate-500">Total Money Received</div>
              <div className="mt-1 text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                {formatINR(reportSummary.totalMoneyReceived, precision)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Person-Wise Summary */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 overflow-x-auto">
        <h2 className="text-base font-bold mb-3">Person-Wise Summary</h2>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 px-3 text-right">Principal</th>
              <th className="py-2 px-3 text-right">Interest</th>
              <th className="py-2 px-3 text-right">Misradhan</th>
              <th className="py-2 px-3 text-right">Total Paid</th>
              <th className="py-2 pl-3 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono-num">
            {reportSummary.profileSummaries.map((ps) => (
              <tr key={ps.profile.id}>
                <td className="py-2.5 pr-4 font-sans font-semibold">{ps.profile.name}</td>
                <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">
                  {formatINR(ps.totalPrincipal, precision)}
                </td>
                <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                  {formatINR(ps.totalInterest, precision)}
                </td>
                <td className="py-2.5 px-3 text-right text-violet-600 dark:text-violet-400">
                  {formatINR(ps.totalMisradhan, precision)}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                  {formatINR(ps.totalPaidAmount, precision)}
                </td>
                <td className="py-2.5 pl-3 text-right font-bold text-red-500">
                  {formatINR(ps.currentOutstanding, precision)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Credit-Wise Summary */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 overflow-x-auto">
        <h2 className="text-base font-bold mb-3">Credit-Wise Summary</h2>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
              <th className="py-2 pr-4">Credit #</th>
              <th className="py-2 px-3">Loan Taker</th>
              <th className="py-2 px-3">Start</th>
              <th className="py-2 px-3 text-right">Principal</th>
              <th className="py-2 px-3 text-right">Interest</th>
              <th className="py-2 pl-3 text-right">Misradhan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono-num">
            {creditStates.map(({ profile, state }) => (
              <tr key={state.credit.id}>
                <td className="py-2.5 pr-4 font-bold text-violet-600 dark:text-violet-400">
                  {state.credit.creditNumber}
                </td>
                <td className="py-2.5 px-3 font-sans">{profile?.name}</td>
                <td className="py-2.5 px-3">{formatDateDDMMYYYY(state.credit.startDate)}</td>
                <td className="py-2.5 px-3 text-right">{formatINR(state.currentPrincipal, precision)}</td>
                <td className="py-2.5 px-3 text-right">{formatINR(state.totalInterest, precision)}</td>
                <td className="py-2.5 pl-3 text-right font-bold">{formatINR(state.totalMisradhan, precision)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export const RemindersScreen: React.FC = () => {
  const { reminders, profiles, credits, addReminder, updateReminder, deleteReminder, showToast, t } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');
  const [showAdd, setShowAdd] = useState(false);

  const [profileId, setProfileId] = useState(profiles[0]?.id || '');
  const [creditId, setCreditId] = useState('');
  const [reminderDate, setReminderDate] = useState(todayISODate());
  const [reminderTime, setReminderTime] = useState('10:00');
  const [note, setNote] = useState('');

  const today = todayISODate();
  const filtered = useMemo(() => {
    return reminders
      .filter((r) => {
        if (tab === 'completed') return r.status === 'completed';
        if (tab === 'overdue') return r.status === 'pending' && r.reminderDate < today;
        return r.status === 'pending' && r.reminderDate >= today;
      })
      .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
  }, [reminders, tab, today]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId) {
      showToast('Select a Loan Taker first', 'error');
      return;
    }
    await addReminder({
      profileId,
      creditId: creditId || null,
      reminderDate,
      reminderTime,
      note,
    });
    const prof = profiles.find((p) => p.id === profileId);
    await scheduleReminderNotification(
      `Reminder: ${prof?.name || 'Payment Due'}`,
      note || `Scheduled for ${formatDateDDMMYYYY(reminderDate)} ${reminderTime}`
    );
    setNote('');
    setShowAdd(false);
    showToast('Reminder added', 'success');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            <span>{t('reminders')}</span>
          </h1>
          <p className="text-xs text-slate-500">Manual due dates — independent of calendar interest calculations</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Reminder
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl bg-white dark:bg-[#15152B] border border-violet-500/30 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Loan Taker</label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Credit (Optional)</label>
              <select
                value={creditId}
                onChange={(e) => setCreditId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
              >
                <option value="">General Profile Reminder</option>
                {credits
                  .filter((c) => c.profileId === profileId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.creditNumber}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <DateInput label="Reminder Date" value={reminderDate} onChange={setReminderDate} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Reminder Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reminder Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Payment follow-up..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold">
              Save Reminder
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10">
        {(['upcoming', 'overdue', 'completed'] as const).map((tKey) => (
          <button
            key={tKey}
            type="button"
            onClick={() => setTab(tKey)}
            className={`py-2 rounded-lg text-xs font-semibold capitalize ${
              tab === tKey ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tKey}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No {tab} reminders.</p>
        ) : (
          filtered.map((rem) => {
            const prof = profiles.find((p) => p.id === rem.profileId);
            const cred = rem.creditId ? credits.find((c) => c.id === rem.creditId) : null;
            return (
              <div key={rem.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {prof?.name || 'Unknown'} {cred ? `· ${cred.creditNumber}` : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateDDMMYYYY(rem.reminderDate)} {rem.reminderTime} · {rem.note || 'Payment Reminder'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rem.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => updateReminder(rem.id, { status: 'completed', completedAt: new Date().toISOString() })}
                      aria-label="Mark reminder completed"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteReminder(rem.id)}
                    aria-label="Delete reminder"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-red-500/10 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
