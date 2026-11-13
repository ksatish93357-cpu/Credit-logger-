import React, { useMemo, useState } from 'react';
import { Calculator as CalcIcon, Copy, Delete, RotateCcw } from 'lucide-react';
import { DateInput } from '../components/DateInput';
import { useApp } from '../context/AppContext';
import { evaluateExpression } from '../engine/calculator';
import { calculateInterest, calculateMisradhan } from '../engine/finance';
import { copyToClipboard } from '../services/share';
import type { InterestMethod, InterestPeriod } from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const CalculatorScreen: React.FC<{ initialTab?: 'loan' | 'normal' }> = ({ initialTab = 'loan' }) => {
  const { settings, showToast, t } = useApp();
  const [tab, setTab] = useState<'loan' | 'normal'>(initialTab);
  const precision = settings.financialPreferences.decimalPrecision;

  // Tab 1: Loan Calculator state
  const [principalStr, setPrincipalStr] = useState('1000');
  const [rateStr, setRateStr] = useState('8.3333');
  const [period, setPeriod] = useState<InterestPeriod>('monthly');
  const [method, setMethod] = useState<InterestMethod>('simple');
  const [startDate, setStartDate] = useState('2026-01-13');
  const [calcDate, setCalcDate] = useState('2026-07-13');
  const [calculated, setCalculated] = useState(true);

  const loanResult = useMemo(() => {
    const p = Number(principalStr);
    const r = Number(rateStr);
    if (!calculated || !(p > 0) || !(r >= 0) || !startDate || !calcDate) return null;
    const res = calculateInterest({
      principal: p,
      rate: r,
      interestPeriod: period,
      interestMethod: method,
      startDate,
      endDate: calcDate,
      precision,
    });
    const misradhan = calculateMisradhan(p, res.interest, precision);
    return { principal: p, ...res, misradhan };
  }, [calculated, principalStr, rateStr, period, method, startDate, calcDate, precision]);

  // Tab 2: Normal Calculator state
  const [expr, setExpr] = useState('');
  const [normalOutput, setNormalOutput] = useState<{ result: number; formattedEquation: string } | null>(null);
  const [normalError, setNormalError] = useState('');

  const appendToken = (tok: string) => {
    setNormalError('');
    setNormalOutput(null);
    setExpr((prev) => prev + tok);
  };

  const handleEvaluate = () => {
    if (!expr.trim()) return;
    try {
      const evaluated = evaluateExpression(expr);
      setNormalOutput(evaluated);
      setNormalError('');
    } catch (err) {
      setNormalError(err instanceof Error ? err.message : 'Invalid expression');
    }
  };

  const handleCopyNormal = async () => {
    if (!expr.trim()) return;
    try {
      const evaluated = normalOutput || evaluateExpression(expr);
      setNormalOutput(evaluated);
      await copyToClipboard(evaluated.formattedEquation);
      showToast(`Copied: ${evaluated.formattedEquation}`, 'success');
    } catch {
      await copyToClipboard(expr);
      showToast('Copied expression', 'info');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalcIcon className="w-5 h-5 text-violet-500" />
          <span>{t('calculator')}</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setTab('loan')}
          className={`py-2.5 rounded-lg text-xs font-semibold transition ${
            tab === 'loan' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {t('loanCalculator')}
        </button>
        <button
          type="button"
          onClick={() => setTab('normal')}
          className={`py-2.5 rounded-lg text-xs font-semibold transition ${
            tab === 'normal' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {t('normalCalculator')}
        </button>
      </div>

      {tab === 'loan' ? (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="calc-principal" className="block text-xs font-medium mb-1">
                {t('principalAmount')} (₹)
              </label>
              <input
                id="calc-principal"
                type="number"
                step="0.01"
                value={principalStr}
                onChange={(e) => setPrincipalStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
              />
            </div>
            <div>
              <label htmlFor="calc-rate" className="block text-xs font-medium mb-1">
                {t('interestRate')} (%)
              </label>
              <input
                id="calc-rate"
                type="number"
                step="0.0001"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0B18]">
              {(['monthly', 'yearly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                    period === p ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0B18]">
              {(['simple', 'compound'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize ${
                    method === m ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <DateInput label={t('startingDate')} value={startDate} onChange={setStartDate} />
          <DateInput label={t('calculationDate')} value={calcDate} onChange={setCalcDate} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCalculated(true)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              {t('calculate')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPrincipalStr('');
                setRateStr('');
                setStartDate(todayISODate());
                setCalcDate(todayISODate());
                setCalculated(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t('clear')}
            </button>
          </div>

          {loanResult && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Principal</div>
                  <div className="text-sm font-bold font-mono-num text-blue-600 dark:text-blue-400">
                    {formatINR(loanResult.principal, precision)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Calendar Duration</div>
                  <div className="text-sm font-bold font-mono-num">
                    {loanResult.duration.completedMonths}m {loanResult.duration.remainingDays}d
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Total Days</div>
                  <div className="text-sm font-bold font-mono-num">{loanResult.duration.totalDays} Days</div>
                </div>
                <div>
                  <div className="text-slate-500">Total Interest</div>
                  <div data-testid="calc-interest" className="text-base font-extrabold font-mono-num text-amber-600 dark:text-amber-400">
                    {formatINR(loanResult.interest, precision)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500">Total Misradhan</div>
                  <div data-testid="calc-misradhan" className="text-lg font-extrabold font-mono-num text-violet-600 dark:text-violet-400">
                    {formatINR(loanResult.misradhan, precision)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard(
                      `Interest: ${formatINR(loanResult.interest, precision)} | Misradhan: ${formatINR(loanResult.misradhan, precision)}`
                    );
                    showToast('Result copied', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> {t('copyResult')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const full = [
                      `Principal: ${formatINR(loanResult.principal, precision)}`,
                      `Rate: ${rateStr}% (${period}, ${method})`,
                      `Period: ${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(calcDate)}`,
                      `Duration: ${loanResult.duration.completedMonths} Months ${loanResult.duration.remainingDays} Days (${loanResult.duration.totalDays} Days)`,
                      `Total Interest: ${formatINR(loanResult.interest, precision)}`,
                      `Total Misradhan: ${formatINR(loanResult.misradhan, precision)}`,
                    ].join('\n');
                    await copyToClipboard(full);
                    showToast('Full calculation copied', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> {t('copyFullCalculation')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-[#0B0B18] border border-slate-200 dark:border-white/10 p-4 space-y-2">
            <input
              type="text"
              aria-label="Calculator expression"
              value={expr}
              onChange={(e) => {
                setExpr(e.target.value);
                setNormalOutput(null);
                setNormalError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEvaluate();
              }}
              placeholder="e.g. 2 + 2 + 2 + 2 + 2"
              className="w-full bg-transparent text-right text-lg font-mono-num text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="text-right text-2xl font-extrabold font-mono-num text-violet-600 dark:text-violet-400 min-h-[32px]">
              {normalOutput ? `= ${normalOutput.result}` : ''}
            </div>
            {normalError && <p className="text-right text-xs text-red-500">{normalError}</p>}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopyNormal}
              className="px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Full Expression
            </button>
            <span className="text-[11px] text-slate-500 font-mono-num">
              {normalOutput ? normalOutput.formattedEquation : 'Copies e.g. 2 + 2 + 2 = 6'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {['(', ')', '%', ' / ', '7', '8', '9', ' * ', '4', '5', '6', ' - ', '1', '2', '3', ' + '].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => appendToken(btn)}
                className="h-12 rounded-xl bg-slate-100 dark:bg-[#0B0B18] hover:bg-violet-500/15 font-mono-num text-base font-semibold border border-slate-200 dark:border-white/10"
              >
                {btn.trim()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setExpr('');
                setNormalOutput(null);
                setNormalError('');
              }}
              className="h-12 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 font-semibold text-sm"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => appendToken('0')}
              className="h-12 rounded-xl bg-slate-100 dark:bg-[#0B0B18] font-mono-num text-base font-semibold border border-slate-200 dark:border-white/10"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => appendToken('.')}
              className="h-12 rounded-xl bg-slate-100 dark:bg-[#0B0B18] font-mono-num text-base font-semibold border border-slate-200 dark:border-white/10"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => setExpr((prev) => prev.trimEnd().slice(0, -1))}
              aria-label="Backspace"
              className="h-12 rounded-xl bg-slate-100 dark:bg-[#0B0B18] flex items-center justify-center border border-slate-200 dark:border-white/10"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleEvaluate}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
          >
            =
          </button>
        </div>
      )}
    </div>
  );
};
