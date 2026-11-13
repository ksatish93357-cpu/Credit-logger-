import React from 'react';
import { formatINR } from '../utils/format';

interface MonthlyChartProps {
  data: { monthKey: string; label: string; creditPaid: number; normalPaid: number; total: number }[];
  precision?: 0 | 2;
}

export const MonthlyCollectionChart: React.FC<MonthlyChartProps> = ({ data, precision = 2 }) => {
  const maxVal = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="w-full" data-testid="monthly-collection-chart">
      <div className="flex items-end justify-between gap-2 sm:gap-4 h-48 pt-6 pb-2 px-1">
        {data.map((item) => {
          const totalHeightPct = Math.max(4, Math.round((item.total / maxVal) * 100));
          const creditSharePct = item.total > 0 ? Math.round((item.creditPaid / item.total) * 100) : 100;
          return (
            <div key={item.monthKey} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 opacity-90 truncate max-w-full">
                {item.total > 0 ? formatINR(item.total, 0) : '₹0'}
              </div>
              <div className="w-full max-w-[44px] h-32 rounded-t-xl bg-slate-100 dark:bg-white/5 flex flex-col justify-end overflow-hidden border border-slate-200/70 dark:border-white/5">
                <div
                  style={{ height: `${item.total === 0 ? 4 : totalHeightPct}%` }}
                  className="w-full flex flex-col justify-end transition-all duration-300"
                  title={`${item.label}: Credit ${formatINR(item.creditPaid, precision)}, Normal ${formatINR(item.normalPaid, precision)}`}
                >
                  {item.normalPaid > 0 && (
                    <div
                      style={{ height: `${100 - creditSharePct}%` }}
                      className="w-full bg-violet-500/80"
                    />
                  )}
                  <div
                    style={{ height: `${item.total === 0 ? 100 : creditSharePct}%` }}
                    className={`w-full ${
                      item.total === 0
                        ? 'bg-slate-300/50 dark:bg-white/10'
                        : 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                    }`}
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Credit Payments
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" /> Normal Payments
        </span>
      </div>
    </div>
  );
};

export const PrincipalVsInterestChart: React.FC<{
  principal: number;
  interest: number;
  paid: number;
  precision?: 0 | 2;
}> = ({ principal, interest, paid, precision = 2 }) => {
  const total = Math.max(1, principal + interest + paid);
  const pPct = (principal / total) * 100;
  const iPct = (interest / total) * 100;
  const paidPct = (paid / total) * 100;

  return (
    <div className="space-y-4">
      <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-white/5">
        <div style={{ width: `${pPct}%` }} className="bg-blue-600 h-full transition-all" />
        <div style={{ width: `${iPct}%` }} className="bg-amber-500 h-full transition-all" />
        <div style={{ width: `${paidPct}%` }} className="bg-emerald-600 h-full transition-all" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl p-3 bg-blue-500/10 border border-blue-500/20">
          <div className="text-blue-600 dark:text-blue-400 font-medium">Principal</div>
          <div className="mt-1 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
            {formatINR(principal, precision)}
          </div>
        </div>
        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20">
          <div className="text-amber-600 dark:text-amber-400 font-medium">Interest</div>
          <div className="mt-1 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
            {formatINR(interest, precision)}
          </div>
        </div>
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-emerald-600 dark:text-emerald-400 font-medium">Total Paid</div>
          <div className="mt-1 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
            {formatINR(paid, precision)}
          </div>
        </div>
      </div>
    </div>
  );
};
