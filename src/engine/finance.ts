import Decimal from 'decimal.js';
import type {
  CalendarDuration,
  ComputedCreditState,
  ComputedDashboardSummary,
  ComputedProfileSummary,
  Credit,
  CreditAdjustment,
  DateFilterRange,
  InterestMethod,
  InterestPeriod,
  Payment,
  PaymentAllocationMode,
  Profile,
  Reminder,
} from '../types';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export function roundMoney(value: Decimal.Value, precision: 0 | 2 = 2): number {
  return new Decimal(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toNumber();
}

export function daysInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

function parseISOParts(iso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function toUTCDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatPartsToISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarMonths(startIso: string, monthsToAdd: number): string {
  const { year, month, day } = parseISOParts(startIso);
  const zeroBased = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, maxDay);
  return formatPartsToISO(targetYear, targetMonth, targetDay);
}

export function calculateTotalDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso || endIso <= startIso) return 0;
  const s = parseISOParts(startIso);
  const e = parseISOParts(endIso);
  const msPerDay = 86400000;
  const diff = toUTCDate(e.year, e.month, e.day).getTime() - toUTCDate(s.year, s.month, s.day).getTime();
  return Math.max(0, Math.round(diff / msPerDay));
}

export function calculateCalendarMonths(startIso: string, endIso: string): CalendarDuration {
  if (!startIso || !endIso || endIso <= startIso) {
    return { completedMonths: 0, remainingDays: 0, totalDays: 0, cycleDays: 30 };
  }
  const totalDays = calculateTotalDays(startIso, endIso);
  let completedMonths = 0;
  let lastAnniversary = startIso;

  while (true) {
    const nextAnniversary = addCalendarMonths(startIso, completedMonths + 1);
    if (nextAnniversary <= endIso) {
      completedMonths += 1;
      lastAnniversary = nextAnniversary;
    } else {
      const remainingDays = calculateTotalDays(lastAnniversary, endIso);
      const cycleDays = Math.max(1, calculateTotalDays(lastAnniversary, nextAnniversary));
      return {
        completedMonths,
        remainingDays,
        totalDays,
        cycleDays,
      };
    }
  }
}

export function calculateRemainingDays(startIso: string, endIso: string): number {
  return calculateCalendarMonths(startIso, endIso).remainingDays;
}

export function calculateInterest(params: {
  principal: number;
  rate: number;
  interestPeriod: InterestPeriod;
  interestMethod: InterestMethod;
  startDate: string;
  endDate: string;
  precision?: 0 | 2;
}): { interest: number; rawInterest: Decimal; duration: CalendarDuration } {
  const { principal, rate, interestPeriod, interestMethod, startDate, endDate, precision = 2 } = params;
  const duration = calculateCalendarMonths(startDate, endDate);
  const p = new Decimal(Math.max(0, principal));
  const r = new Decimal(Math.max(0, rate));

  if (p.lte(0) || r.lte(0) || duration.totalDays <= 0) {
    return { interest: 0, rawInterest: new Decimal(0), duration };
  }

  const monthlyFraction = new Decimal(duration.completedMonths).plus(
    new Decimal(duration.remainingDays).div(duration.cycleDays)
  );

  let rawInterest = new Decimal(0);

  if (interestPeriod === 'monthly') {
    const monthlyRate = r.div(100);
    if (interestMethod === 'simple') {
      rawInterest = p.mul(monthlyRate).mul(monthlyFraction);
    } else {
      const onePlusR = new Decimal(1).plus(monthlyRate);
      const compounded = p.mul(onePlusR.pow(duration.completedMonths));
      const partialFactor = new Decimal(1).plus(
        monthlyRate.mul(new Decimal(duration.remainingDays).div(duration.cycleDays))
      );
      rawInterest = compounded.mul(partialFactor).minus(p);
    }
  } else {
    const yearlyRate = r.div(100);
    if (interestMethod === 'simple') {
      rawInterest = p.mul(yearlyRate).mul(monthlyFraction.div(12));
    } else {
      const fullYears = Math.floor(duration.completedMonths / 12);
      const remMonths = duration.completedMonths % 12;
      const remYearFraction = new Decimal(remMonths)
        .plus(new Decimal(duration.remainingDays).div(duration.cycleDays))
        .div(12);
      const onePlusY = new Decimal(1).plus(yearlyRate);
      const compounded = p.mul(onePlusY.pow(fullYears));
      const partialFactor = new Decimal(1).plus(yearlyRate.mul(remYearFraction));
      rawInterest = compounded.mul(partialFactor).minus(p);
    }
  }

  return {
    interest: roundMoney(rawInterest, precision),
    rawInterest,
    duration,
  };
}

export function calculateMisradhan(principal: number, interest: number, precision: 0 | 2 = 2): number {
  return roundMoney(new Decimal(principal).plus(interest), precision);
}

interface LedgerEvent {
  date: string;
  createdAt: string;
  kind: 'adjustment' | 'payment';
  adjustment?: CreditAdjustment;
  payment?: Payment;
}

export interface PaymentAllocationResult {
  previousPrincipal: number;
  accruedInterest: number;
  previousMisradhan: number;
  paymentAmount: number;
  newPrincipal: number;
  carriedUnpaidInterest: number;
  advanceAdded: number;
  newOutstanding: number;
  shouldOfferClose: boolean;
}

export function calculatePaymentAllocation(params: {
  currentPrincipal: number;
  accruedInterest: number;
  paymentAmount: number;
  allocationMode: PaymentAllocationMode;
  precision?: 0 | 2;
}): PaymentAllocationResult {
  const { currentPrincipal, accruedInterest, paymentAmount, allocationMode, precision = 2 } = params;
  const p = new Decimal(Math.max(0, currentPrincipal));
  const i = new Decimal(Math.max(0, accruedInterest));
  const pay = new Decimal(Math.max(0, paymentAmount));
  const misradhan = p.plus(i);

  let newPrincipalDec = p;
  let carriedInterestDec = new Decimal(0);
  let advanceDec = new Decimal(0);

  if (allocationMode === 'principal_adjustment') {
    if (pay.gte(misradhan)) {
      newPrincipalDec = new Decimal(0);
      carriedInterestDec = new Decimal(0);
      advanceDec = pay.minus(misradhan);
    } else {
      newPrincipalDec = misradhan.minus(pay);
      carriedInterestDec = new Decimal(0);
      advanceDec = new Decimal(0);
    }
  } else {
    // Interest First Mode
    const paidToInterest = Decimal.min(pay, i);
    carriedInterestDec = i.minus(paidToInterest);
    const rem = pay.minus(paidToInterest);
    const paidToPrincipal = Decimal.min(rem, p);
    newPrincipalDec = p.minus(paidToPrincipal);
    advanceDec = rem.minus(paidToPrincipal);
  }

  const newPrincipal = roundMoney(newPrincipalDec, precision);
  const carriedUnpaidInterest = roundMoney(carriedInterestDec, precision);
  const advanceAdded = roundMoney(advanceDec, precision);
  const newOutstanding = roundMoney(newPrincipalDec.plus(carriedInterestDec), precision);

  return {
    previousPrincipal: roundMoney(p, precision),
    accruedInterest: roundMoney(i, precision),
    previousMisradhan: roundMoney(misradhan, precision),
    paymentAmount: roundMoney(pay, precision),
    newPrincipal,
    carriedUnpaidInterest,
    advanceAdded,
    newOutstanding,
    shouldOfferClose: newPrincipal <= 0 && carriedUnpaidInterest <= 0,
  };
}

export function reconstructCreditState(
  credit: Credit,
  adjustments: CreditAdjustment[],
  payments: Payment[],
  asOfDate: string = todayISODate(),
  precision: 0 | 2 = 2
): ComputedCreditState {
  const effectiveEnd =
    credit.status === 'closed' && credit.closedDate && credit.closedDate < asOfDate
      ? credit.closedDate
      : asOfDate;

  const creditAdjustments = adjustments.filter((a) => a.creditId === credit.id);
  const creditPayments = payments.filter(
    (p) => p.creditId === credit.id && p.paymentType === 'credit_payment' && !p.reversed
  );

  const events: LedgerEvent[] = [
    ...creditAdjustments.map((a) => ({
      date: a.effectiveDate,
      createdAt: a.createdAt,
      kind: 'adjustment' as const,
      adjustment: a,
    })),
    ...creditPayments.map((p) => ({
      date: p.paymentDate,
      createdAt: p.createdAt,
      kind: 'payment' as const,
      payment: p,
    })),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    // Adjustments before payments on identical timestamp
    return a.kind === b.kind ? 0 : a.kind === 'adjustment' ? -1 : 1;
  });

  let currentPrincipal = new Decimal(credit.originalPrincipal);
  let carriedUnpaidInterest = new Decimal(0);
  let advanceBalance = new Decimal(0);
  let periodStartDate = credit.startDate;
  let activeRate = credit.interestRate;
  let activePeriod = credit.interestPeriod;
  const activeMethod = credit.interestMethod;
  let lastAdjustmentDate = credit.startDate;
  let totalPaidOnCredit = new Decimal(0);

  for (const ev of events) {
    if (ev.date > effectiveEnd) break;

    if (ev.date > periodStartDate && currentPrincipal.gt(0)) {
      const { rawInterest } = calculateInterest({
        principal: currentPrincipal.toNumber(),
        rate: activeRate,
        interestPeriod: activePeriod,
        interestMethod: activeMethod,
        startDate: periodStartDate,
        endDate: ev.date,
        precision,
      });
      carriedUnpaidInterest = carriedUnpaidInterest.plus(rawInterest);
    }

    if (ev.kind === 'adjustment' && ev.adjustment) {
      currentPrincipal = new Decimal(Math.max(0, ev.adjustment.newPrincipal));
      activeRate = ev.adjustment.newInterestRate;
      activePeriod = ev.adjustment.newInterestPeriod;
      if (ev.date >= periodStartDate) {
        periodStartDate = ev.date;
        lastAdjustmentDate = ev.date;
      }
    } else if (ev.kind === 'payment' && ev.payment) {
      const mode: PaymentAllocationMode = ev.payment.allocationMode || 'principal_adjustment';
      const roundedAccrued = roundMoney(carriedUnpaidInterest, precision);
      const alloc = calculatePaymentAllocation({
        currentPrincipal: currentPrincipal.toNumber(),
        accruedInterest: roundedAccrued,
        paymentAmount: ev.payment.amount,
        allocationMode: mode,
        precision,
      });
      currentPrincipal = new Decimal(alloc.newPrincipal);
      carriedUnpaidInterest = new Decimal(alloc.carriedUnpaidInterest);
      advanceBalance = advanceBalance.plus(alloc.advanceAdded);
      totalPaidOnCredit = totalPaidOnCredit.plus(ev.payment.amount);
      if (ev.date >= periodStartDate) {
        periodStartDate = ev.date;
        lastAdjustmentDate = ev.date;
      }
    }
  }

  let currentPeriodInterestDec = new Decimal(0);
  let durationCurrentPeriod: CalendarDuration = {
    completedMonths: 0,
    remainingDays: 0,
    totalDays: 0,
    cycleDays: 30,
  };

  if (effectiveEnd > periodStartDate && currentPrincipal.gt(0) && credit.status !== 'closed') {
    const calc = calculateInterest({
      principal: currentPrincipal.toNumber(),
      rate: activeRate,
      interestPeriod: activePeriod,
      interestMethod: activeMethod,
      startDate: periodStartDate,
      endDate: effectiveEnd,
      precision,
    });
    currentPeriodInterestDec = calc.rawInterest;
    durationCurrentPeriod = calc.duration;
  }

  // Calculate today's single-day accrued interest if active
  let todayInterestAccrued = 0;
  if (credit.status === 'active' && currentPrincipal.gt(0)) {
    const yesterday = addDaysISO(effectiveEnd, -1);
    const upToYesterday =
      yesterday > periodStartDate
        ? calculateInterest({
            principal: currentPrincipal.toNumber(),
            rate: activeRate,
            interestPeriod: activePeriod,
            interestMethod: activeMethod,
            startDate: periodStartDate,
            endDate: yesterday,
            precision,
          }).rawInterest
        : new Decimal(0);
    const upToToday =
      effectiveEnd > periodStartDate
        ? currentPeriodInterestDec
        : new Decimal(0);
    todayInterestAccrued = roundMoney(Decimal.max(0, upToToday.minus(upToYesterday)), precision);
  }

  const totalInterest = roundMoney(carriedUnpaidInterest.plus(currentPeriodInterestDec), precision);
  const roundedPrincipal = roundMoney(currentPrincipal, precision);
  const totalMisradhan = roundMoney(new Decimal(roundedPrincipal).plus(totalInterest), precision);
  const outstandingAmount = credit.status === 'closed' ? 0 : totalMisradhan;

  return {
    credit,
    originalPrincipal: roundMoney(credit.originalPrincipal, precision),
    currentPrincipal: roundedPrincipal,
    activeInterestRate: activeRate,
    activeInterestPeriod: activePeriod,
    activeInterestMethod: activeMethod,
    lastAdjustmentDate,
    asOfDate: effectiveEnd,
    durationSinceStart: calculateCalendarMonths(credit.startDate, effectiveEnd),
    durationCurrentPeriod,
    currentPeriodInterest: roundMoney(currentPeriodInterestDec, precision),
    carriedUnpaidInterest: roundMoney(carriedUnpaidInterest, precision),
    totalInterest,
    totalMisradhan,
    totalPaidOnCredit: roundMoney(totalPaidOnCredit, precision),
    advanceBalance: roundMoney(advanceBalance, precision),
    outstandingAmount,
    todayInterestAccrued,
  };
}

export function addDaysISO(iso: string, deltaDays: number): string {
  const { year, month, day } = parseISOParts(iso);
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return formatPartsToISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function previewCreditPayment(params: {
  credit: Credit;
  adjustments: CreditAdjustment[];
  payments: Payment[];
  amount: number;
  paymentDate: string;
  allocationMode: PaymentAllocationMode;
  precision?: 0 | 2;
}): PaymentAllocationResult {
  const { credit, adjustments, payments, amount, paymentDate, allocationMode, precision = 2 } = params;
  const priorPayments = payments.filter((p) => p.paymentDate <= paymentDate);
  const stateAtDate = reconstructCreditState(credit, adjustments, priorPayments, paymentDate, precision);
  return calculatePaymentAllocation({
    currentPrincipal: stateAtDate.currentPrincipal,
    accruedInterest: stateAtDate.totalInterest,
    paymentAmount: amount,
    allocationMode,
    precision,
  });
}

export function previewMainCreditUpdate(params: {
  credit: Credit;
  adjustments: CreditAdjustment[];
  payments: Payment[];
  newPrincipal: number;
  newRate: number;
  newPeriod: InterestPeriod;
  effectiveDate: string;
  precision?: 0 | 2;
}) {
  const { credit, adjustments, payments, newPrincipal, newRate, newPeriod, effectiveDate, precision = 2 } = params;
  const stateAtDate = reconstructCreditState(credit, adjustments, payments, effectiveDate, precision);
  const newPrincipalRounded = roundMoney(Math.max(0, newPrincipal), precision);
  return {
    oldPrincipal: stateAtDate.currentPrincipal,
    newPrincipal: newPrincipalRounded,
    oldInterestRate: stateAtDate.activeInterestRate,
    oldInterestPeriod: stateAtDate.activeInterestPeriod,
    newInterestRate: newRate,
    newInterestPeriod: newPeriod,
    interestAccruedUntilEffectiveDate: stateAtDate.totalInterest,
    newMisradhan: calculateMisradhan(newPrincipalRounded, stateAtDate.totalInterest, precision),
  };
}

export function previewHistoricalPaymentEdit(params: {
  credit: Credit;
  adjustments: CreditAdjustment[];
  payments: Payment[];
  editedPaymentId: string;
  newAmount: number;
  newPaymentDate: string;
  newAllocationMode: PaymentAllocationMode;
  asOfDate?: string;
  precision?: 0 | 2;
}) {
  const {
    credit,
    adjustments,
    payments,
    editedPaymentId,
    newAmount,
    newPaymentDate,
    newAllocationMode,
    asOfDate = todayISODate(),
    precision = 2,
  } = params;

  const beforeState = reconstructCreditState(credit, adjustments, payments, asOfDate, precision);
  const updatedPayments = payments.map((p) =>
    p.id === editedPaymentId
      ? {
          ...p,
          amount: newAmount,
          paymentDate: newPaymentDate,
          allocationMode: newAllocationMode,
        }
      : p
  );
  const afterState = reconstructCreditState(credit, adjustments, updatedPayments, asOfDate, precision);

  return {
    before: {
      currentPrincipal: beforeState.currentPrincipal,
      totalInterest: beforeState.totalInterest,
      totalMisradhan: beforeState.totalMisradhan,
      outstandingAmount: beforeState.outstandingAmount,
    },
    after: {
      currentPrincipal: afterState.currentPrincipal,
      totalInterest: afterState.totalInterest,
      totalMisradhan: afterState.totalMisradhan,
      outstandingAmount: afterState.outstandingAmount,
    },
    principalDelta: roundMoney(afterState.currentPrincipal - beforeState.currentPrincipal, precision),
    interestDelta: roundMoney(afterState.totalInterest - beforeState.totalInterest, precision),
    outstandingDelta: roundMoney(afterState.outstandingAmount - beforeState.outstandingAmount, precision),
  };
}

export function calculateCreditOutstanding(
  credit: Credit,
  adjustments: CreditAdjustment[],
  payments: Payment[],
  asOfDate: string = todayISODate(),
  precision: 0 | 2 = 2
): number {
  return reconstructCreditState(credit, adjustments, payments, asOfDate, precision).outstandingAmount;
}

export function calculateProfileSummary(
  profile: Profile,
  credits: Credit[],
  adjustments: CreditAdjustment[],
  payments: Payment[],
  asOfDate: string = todayISODate(),
  precision: 0 | 2 = 2
): ComputedProfileSummary {
  const profileCredits = credits.filter((c) => c.profileId === profile.id);
  const creditStates = profileCredits.map((c) =>
    reconstructCreditState(c, adjustments, payments, asOfDate, precision)
  );

  let totalPrincipal = new Decimal(0);
  let totalInterest = new Decimal(0);
  let totalMisradhan = new Decimal(0);
  let totalAdvance = new Decimal(0);
  let activeCreditCount = 0;
  let closedCreditCount = 0;

  for (const st of creditStates) {
    if (st.credit.status === 'active') {
      activeCreditCount += 1;
      totalPrincipal = totalPrincipal.plus(st.currentPrincipal);
      totalInterest = totalInterest.plus(st.totalInterest);
      totalMisradhan = totalMisradhan.plus(st.totalMisradhan);
      totalAdvance = totalAdvance.plus(st.advanceBalance);
    } else if (st.credit.status === 'closed') {
      closedCreditCount += 1;
    }
  }

  const validProfilePayments = payments.filter((p) => p.profileId === profile.id && !p.reversed);
  let totalCreditPaid = new Decimal(0);
  let totalNormalPaid = new Decimal(0);
  let latestPaymentDate: string | null = null;

  for (const p of validProfilePayments) {
    if (p.paymentType === 'credit_payment') {
      totalCreditPaid = totalCreditPaid.plus(p.amount);
    } else {
      totalNormalPaid = totalNormalPaid.plus(p.amount);
    }
    if (!latestPaymentDate || p.paymentDate > latestPaymentDate) {
      latestPaymentDate = p.paymentDate;
    }
  }

  return {
    profile,
    totalPrincipal: roundMoney(totalPrincipal, precision),
    totalInterest: roundMoney(totalInterest, precision),
    totalMisradhan: roundMoney(totalMisradhan, precision),
    totalCreditPaid: roundMoney(totalCreditPaid, precision),
    totalNormalPaid: roundMoney(totalNormalPaid, precision),
    totalPaidAmount: roundMoney(totalCreditPaid.plus(totalNormalPaid), precision),
    currentOutstanding: roundMoney(totalMisradhan, precision),
    totalAdvance: roundMoney(totalAdvance, precision),
    activeCreditCount,
    closedCreditCount,
    totalCreditCount: profileCredits.length,
    latestPaymentDate,
    creditStates,
  };
}

export function resolveDateFilterRange(filter: DateFilterRange, refDate: string = todayISODate()): {
  startDate: string | null;
  endDate: string | null;
} {
  if (filter.preset === 'all') return { startDate: null, endDate: null };
  if (filter.preset === 'today') return { startDate: refDate, endDate: refDate };
  if (filter.preset === 'week') {
    return { startDate: addDaysISO(refDate, -6), endDate: refDate };
  }
  if (filter.preset === 'month') {
    const { year, month } = parseISOParts(refDate);
    return { startDate: formatPartsToISO(year, month, 1), endDate: refDate };
  }
  if (filter.preset === 'year') {
    const { year } = parseISOParts(refDate);
    return { startDate: `${year}-01-01`, endDate: refDate };
  }
  return {
    startDate: filter.startDate || null,
    endDate: filter.endDate || null,
  };
}

export function calculateDashboardSummary(
  profiles: Profile[],
  credits: Credit[],
  adjustments: CreditAdjustment[],
  payments: Payment[],
  _reminders: Reminder[],
  asOfDate: string = todayISODate(),
  dateFilter: DateFilterRange = { preset: 'all' },
  precision: 0 | 2 = 2
): ComputedDashboardSummary {
  const activeProfiles = profiles.filter((p) => !p.archivedAt);
  const profileSummaries = activeProfiles.map((p) =>
    calculateProfileSummary(p, credits, adjustments, payments, asOfDate, precision)
  );

  let totalPrincipal = new Decimal(0);
  let totalInterest = new Decimal(0);
  let totalMisradhan = new Decimal(0);
  let totalActiveCredits = 0;
  let totalClosedCredits = 0;
  let todayInterestAccrued = new Decimal(0);

  for (const ps of profileSummaries) {
    totalPrincipal = totalPrincipal.plus(ps.totalPrincipal);
    totalInterest = totalInterest.plus(ps.totalInterest);
    totalMisradhan = totalMisradhan.plus(ps.totalMisradhan);
    totalActiveCredits += ps.activeCreditCount;
    totalClosedCredits += ps.closedCreditCount;
    for (const cs of ps.creditStates) {
      todayInterestAccrued = todayInterestAccrued.plus(cs.todayInterestAccrued);
    }
  }

  let totalMoneyGiven = new Decimal(0);
  for (const c of credits) {
    if (c.status !== 'archived') {
      totalMoneyGiven = totalMoneyGiven.plus(c.originalPrincipal);
    }
  }

  const validPayments = payments.filter((p) => !p.reversed);
  let totalCreditPaid = new Decimal(0);
  let totalNormalPaid = new Decimal(0);

  const { startDate, endDate } = resolveDateFilterRange(dateFilter, asOfDate);
  let filteredCollectionTotal = new Decimal(0);

  const monthMap = new Map<string, { creditPaid: Decimal; normalPaid: Decimal }>();
  // Initialize last 6 months for chart continuity
  const refParts = parseISOParts(asOfDate);
  for (let i = 5; i >= 0; i--) {
    const zeroBased = refParts.year * 12 + (refParts.month - 1) - i;
    const y = Math.floor(zeroBased / 12);
    const m = (zeroBased % 12) + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    monthMap.set(key, { creditPaid: new Decimal(0), normalPaid: new Decimal(0) });
  }

  for (const p of validPayments) {
    if (p.paymentType === 'credit_payment') {
      totalCreditPaid = totalCreditPaid.plus(p.amount);
    } else {
      totalNormalPaid = totalNormalPaid.plus(p.amount);
    }

    const inRange = (!startDate || p.paymentDate >= startDate) && (!endDate || p.paymentDate <= endDate);
    if (inRange) {
      filteredCollectionTotal = filteredCollectionTotal.plus(p.amount);
    }

    const mk = p.paymentDate.slice(0, 7);
    const bucket = monthMap.get(mk);
    if (bucket) {
      if (p.paymentType === 'credit_payment') {
        bucket.creditPaid = bucket.creditPaid.plus(p.amount);
      } else {
        bucket.normalPaid = bucket.normalPaid.plus(p.amount);
      }
    }
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyCollections = Array.from(monthMap.entries()).map(([monthKey, val]) => {
    const [y, m] = monthKey.split('-');
    const label = `${monthNames[Number(m) - 1]} ${y.slice(2)}`;
    const cp = roundMoney(val.creditPaid, precision);
    const np = roundMoney(val.normalPaid, precision);
    return {
      monthKey,
      label,
      creditPaid: cp,
      normalPaid: np,
      total: roundMoney(val.creditPaid.plus(val.normalPaid), precision),
    };
  });

  const totalPaidAmount = roundMoney(totalCreditPaid.plus(totalNormalPaid), precision);

  return {
    totalPrincipal: roundMoney(totalPrincipal, precision),
    totalInterest: roundMoney(totalInterest, precision),
    totalMisradhan: roundMoney(totalMisradhan, precision),
    totalPaidAmount,
    totalCreditPaid: roundMoney(totalCreditPaid, precision),
    totalNormalPaid: roundMoney(totalNormalPaid, precision),
    totalLoanTakers: activeProfiles.length,
    totalActiveCredits,
    totalClosedCredits,
    totalCreditRecords: credits.filter((c) => c.status !== 'archived').length,
    totalMoneyGiven: roundMoney(totalMoneyGiven, precision),
    totalMoneyReceived: totalPaidAmount,
    todayInterestAccrued: roundMoney(todayInterestAccrued, precision),
    currentOutstanding: roundMoney(totalMisradhan, precision),
    filteredCollectionTotal: roundMoney(filteredCollectionTotal, precision),
    monthlyCollections,
    profileSummaries,
  };
}

export function generateAutoPaymentNote(params: {
  creditNumber: string;
  paymentAmount: number;
  paymentDate: string;
  allocation: PaymentAllocationResult;
  allocationMode: PaymentAllocationMode;
  precision?: 0 | 2;
}): string {
  const { creditNumber, paymentAmount, paymentDate, allocation, allocationMode, precision = 2 } = params;
  const dateStr = formatDateDDMMYYYY(paymentDate);
  const modeLabel =
    allocationMode === 'principal_adjustment'
      ? 'Principal Adjustment (Misradhan Less)'
      : 'Interest First';
  return [
    `Credit Number: ${creditNumber}`,
    `Allocation Mode: ${modeLabel}`,
    `Payment Received: ${formatINR(paymentAmount, precision)}`,
    `Payment Date: ${dateStr}`,
    `Previous Principal: ${formatINR(allocation.previousPrincipal, precision)}`,
    `Previous Interest: ${formatINR(allocation.accruedInterest, precision)}`,
    `Previous Misradhan: ${formatINR(allocation.previousMisradhan, precision)}`,
    `Paid Amount: ${formatINR(paymentAmount, precision)}`,
    `New Principal: ${formatINR(allocation.newPrincipal, precision)}`,
    `Interest Calculation Restarted: ${dateStr}`,
    `Future interest will be calculated on ${formatINR(allocation.newPrincipal, precision)}.`,
  ].join('\n');
}

export function generateCreditStatement(
  profile: Profile,
  state: ComputedCreditState,
  payments: Payment[],
  precision: 0 | 2 = 2
): string {
  const creditPayments = payments
    .filter((p) => p.creditId === state.credit.id && !p.reversed)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  const lines = [
    `CREDIT LOGGER — CREDIT STATEMENT`,
    `========================================`,
    `Loan Taker: ${profile.name}${profile.phone ? ` (${profile.phone})` : ''}`,
    `Credit Number: ${state.credit.creditNumber}`,
    `Status: ${state.credit.status.toUpperCase()}`,
    `Original Principal: ${formatINR(state.originalPrincipal, precision)}`,
    `Current Principal: ${formatINR(state.currentPrincipal, precision)}`,
    `Interest Rate: ${state.activeInterestRate}% (${state.activeInterestPeriod}, ${state.activeInterestMethod})`,
    `Start Date: ${formatDateDDMMYYYY(state.credit.startDate)}`,
    `Calculation Date: ${formatDateDDMMYYYY(state.asOfDate)}`,
    `Duration: ${state.durationSinceStart.completedMonths} Months ${state.durationSinceStart.remainingDays} Days (${state.durationSinceStart.totalDays} Days)`,
    `Total Interest Accrued: ${formatINR(state.totalInterest, precision)}`,
    `Total Misradhan: ${formatINR(state.totalMisradhan, precision)}`,
    `Total Paid: ${formatINR(state.totalPaidOnCredit, precision)}`,
    `Current Outstanding: ${formatINR(state.outstandingAmount, precision)}`,
    ``,
    `PAYMENT HISTORY (${creditPayments.length})`,
    `----------------------------------------`,
    ...(creditPayments.length === 0
      ? ['No payments recorded yet.']
      : creditPayments.map(
          (p) =>
            `${formatDateDDMMYYYY(p.paymentDate)} | ${p.receiptNumber} | ${formatINR(p.amount, precision)} | ${p.paymentMethod.toUpperCase()} | New Principal: ${formatINR(p.newPrincipal, precision)}`
        )),
    ...(state.credit.note ? [``, `Note: ${state.credit.note}`] : []),
    `========================================`,
    `Generated on: ${formatDateDDMMYYYY(todayISODate())}`,
  ];
  return lines.join('\n');
}

export function generatePaymentReceipt(
  profile: Profile,
  credit: Credit | null,
  payment: Payment,
  precision: 0 | 2 = 2
): string {
  const lines = [
    `CREDIT LOGGER — PAYMENT RECEIPT`,
    `========================================`,
    `Receipt Number: ${payment.receiptNumber}`,
    `Customer Name: ${profile.name}`,
    ...(credit ? [`Credit Number: ${credit.creditNumber}`] : [`Payment Type: Normal Payment (Non-Credit)`]),
    `Payment Amount: ${formatINR(payment.amount, precision)}`,
    `Payment Date: ${formatDateDDMMYYYY(payment.paymentDate)}`,
    `Payment Method: ${payment.paymentMethod.toUpperCase()}`,
    ...(credit
      ? [
          `Previous Principal: ${formatINR(payment.previousPrincipal, precision)}`,
          `Previous Interest: ${formatINR(payment.previousInterest, precision)}`,
          `Previous Misradhan: ${formatINR(payment.previousMisradhan, precision)}`,
          `New Principal: ${formatINR(payment.newPrincipal, precision)}`,
        ]
      : []),
    ...(payment.note ? [``, `Note:`, payment.note] : []),
    `========================================`,
  ];
  return lines.join('\n');
}

export function generateProfileStatement(
  summary: ComputedProfileSummary,
  payments: Payment[],
  precision: 0 | 2 = 2
): string {
  const creditPayments = payments.filter(
    (p) => p.profileId === summary.profile.id && p.paymentType === 'credit_payment' && !p.reversed
  );
  const normalPayments = payments.filter(
    (p) => p.profileId === summary.profile.id && p.paymentType === 'normal_payment' && !p.reversed
  );

  const lines = [
    `CREDIT LOGGER — COMPLETE PROFILE STATEMENT`,
    `========================================`,
    `Name: ${summary.profile.name}`,
    ...(summary.profile.phone ? [`Phone: ${summary.profile.phone}`] : []),
    ...(summary.profile.address ? [`Address: ${summary.profile.address}`] : []),
    `Statement Date: ${formatDateDDMMYYYY(todayISODate())}`,
    ``,
    `FINANCIAL SUMMARY`,
    `Total Principal: ${formatINR(summary.totalPrincipal, precision)}`,
    `Total Interest: ${formatINR(summary.totalInterest, precision)}`,
    `Total Misradhan: ${formatINR(summary.totalMisradhan, precision)}`,
    `Total Credit Payments: ${formatINR(summary.totalCreditPaid, precision)}`,
    `Total Normal Payments: ${formatINR(summary.totalNormalPaid, precision)}`,
    `Total Paid Amount: ${formatINR(summary.totalPaidAmount, precision)}`,
    `Current Outstanding: ${formatINR(summary.currentOutstanding, precision)}`,
    ``,
    `CREDITS (${summary.creditStates.length})`,
    `----------------------------------------`,
    ...(summary.creditStates.length === 0
      ? ['No credits recorded.']
      : summary.creditStates.map(
          (cs) =>
            `${cs.credit.creditNumber} [${cs.credit.status.toUpperCase()}] | Start: ${formatDateDDMMYYYY(cs.credit.startDate)} | Principal: ${formatINR(cs.currentPrincipal, precision)} | Interest: ${formatINR(cs.totalInterest, precision)} | Misradhan: ${formatINR(cs.totalMisradhan, precision)}`
        )),
    ``,
    `CREDIT PAYMENTS (${creditPayments.length})`,
    `----------------------------------------`,
    ...(creditPayments.length === 0
      ? ['No credit payments.']
      : creditPayments.map(
          (p) => `${formatDateDDMMYYYY(p.paymentDate)} | ${p.receiptNumber} | ${formatINR(p.amount, precision)}`
        )),
    ``,
    `NORMAL PAYMENTS (${normalPayments.length})`,
    `----------------------------------------`,
    ...(normalPayments.length === 0
      ? ['No normal payments.']
      : normalPayments.map(
          (p) => `${formatDateDDMMYYYY(p.paymentDate)} | ${p.receiptNumber} | ${formatINR(p.amount, precision)}`
        )),
    `========================================`,
  ];
  return lines.join('\n');
}
