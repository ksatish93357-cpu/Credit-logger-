import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCalendarMonths,
  calculateDashboardSummary,
  calculateInterest,
  calculateProfileSummary,
  previewCreditPayment,
  previewHistoricalPaymentEdit,
  reconstructCreditState,
} from './finance';
import { evaluateExpression } from './calculator';
import { formatDateDDMMYYYY, formatINR, parseDDMMYYYYToISO } from '../utils/format';
import type { Credit, CreditAdjustment, Payment, Profile } from '../types';

const baseProfile: Profile = {
  id: 'prof_rahul',
  name: 'Rahul',
  phone: '9876543210',
  address: 'Jaipur',
  photo: '',
  note: '',
  createdAt: '2026-01-13T00:00:00.000Z',
  updatedAt: '2026-01-13T00:00:00.000Z',
  archivedAt: null,
};

const baseCredit: Credit = {
  id: 'cred_1',
  profileId: 'prof_rahul',
  creditNumber: 'CL-0001',
  originalPrincipal: 1000,
  currentPrincipal: 1000,
  interestRate: 8.3333,
  interestPeriod: 'monthly',
  interestMethod: 'simple',
  startDate: '2026-01-13',
  status: 'active',
  closedDate: null,
  note: '',
  createdAt: '2026-01-13T00:00:00.000Z',
  updatedAt: '2026-01-13T00:00:00.000Z',
};

test('TEST 1: Rahul ₹1,000 @ 8.3333% monthly from 13/01/2026 to 13/07/2026 yields ~₹500 interest and ~₹1,500 Misradhan', () => {
  const duration = calculateCalendarMonths('2026-01-13', '2026-07-13');
  assert.equal(duration.completedMonths, 6);
  assert.equal(duration.remainingDays, 0);

  const state = reconstructCreditState(baseCredit, [], [], '2026-07-13');
  assert.equal(state.currentPrincipal, 1000);
  assert.equal(state.totalInterest, 500);
  assert.equal(state.totalMisradhan, 1500);
});

test('TEST 2 & 3: Principal Adjustment payment of ₹1,000 sets New Principal to ₹500 and future interest calculates on ₹500', () => {
  const preview = previewCreditPayment({
    credit: baseCredit,
    adjustments: [],
    payments: [],
    amount: 1000,
    paymentDate: '2026-07-13',
    allocationMode: 'principal_adjustment',
  });

  assert.equal(preview.previousPrincipal, 1000);
  assert.equal(preview.accruedInterest, 500);
  assert.equal(preview.previousMisradhan, 1500);
  assert.equal(preview.newPrincipal, 500);

  const payment: Payment = {
    id: 'pay_1',
    profileId: 'prof_rahul',
    creditId: 'cred_1',
    paymentType: 'credit_payment',
    amount: 1000,
    paymentDate: '2026-07-13',
    paymentMethod: 'cash',
    allocationMode: 'principal_adjustment',
    previousPrincipal: 1000,
    previousInterest: 500,
    previousMisradhan: 1500,
    newPrincipal: 500,
    note: '',
    receiptNumber: 'RCP-0001',
    createdAt: '2026-07-13T10:00:00.000Z',
  };

  // On payment date itself, no double-counted interest
  const stateOnPaymentDate = reconstructCreditState(baseCredit, [], [payment], '2026-07-13');
  assert.equal(stateOnPaymentDate.currentPrincipal, 500);
  assert.equal(stateOnPaymentDate.totalInterest, 0);
  assert.equal(stateOnPaymentDate.totalMisradhan, 500);

  // 1 calendar month later (13/08/2026), interest accrues strictly on ₹500 (500 * 8.3333% = 41.67)
  const stateOneMonthAfter = reconstructCreditState(baseCredit, [], [payment], '2026-08-13');
  assert.equal(stateOneMonthAfter.currentPrincipal, 500);
  assert.equal(stateOneMonthAfter.totalInterest, 41.67);
  assert.equal(stateOneMonthAfter.totalMisradhan, 541.67);
});

test('TEST 4: Normal payment increases profile/global total paid without changing credit principal or interest', () => {
  const normalPay: Payment = {
    id: 'pay_norm_1',
    profileId: 'prof_rahul',
    creditId: null,
    paymentType: 'normal_payment',
    amount: 500,
    paymentDate: '2026-07-13',
    paymentMethod: 'upi',
    allocationMode: null,
    previousPrincipal: 0,
    previousInterest: 0,
    previousMisradhan: 0,
    newPrincipal: 0,
    note: 'General payment',
    receiptNumber: 'NRM-0001',
    createdAt: '2026-07-13T11:00:00.000Z',
  };

  const summary = calculateProfileSummary(baseProfile, [baseCredit], [], [normalPay], '2026-07-13');
  assert.equal(summary.totalPrincipal, 1000);
  assert.equal(summary.totalInterest, 500);
  assert.equal(summary.totalMisradhan, 1500);
  assert.equal(summary.totalNormalPaid, 500);
  assert.equal(summary.totalPaidAmount, 500);

  const dash = calculateDashboardSummary([baseProfile], [baseCredit], [], [normalPay], [], '2026-07-13');
  assert.equal(dash.totalPaidAmount, 500);
  assert.equal(dash.totalPrincipal, 1000);
});

test('TEST 5: Multiple independent credits under one profile maintain separate balances', () => {
  const credit2: Credit = {
    ...baseCredit,
    id: 'cred_2',
    creditNumber: 'CL-0002',
    originalPrincipal: 2000,
    currentPrincipal: 2000,
    interestRate: 2,
    startDate: '2026-06-13',
  };

  const summary = calculateProfileSummary(baseProfile, [baseCredit, credit2], [], [], '2026-07-13');
  assert.equal(summary.activeCreditCount, 2);
  assert.equal(summary.totalPrincipal, 3000);
  assert.equal(summary.totalInterest, 540); // 500 + (2000 * 2% * 1)
  assert.equal(summary.totalMisradhan, 3540);
});

test('TEST 6 & 7: Historical payment edit preview and payment reversal recalculate safely', () => {
  const payment: Payment = {
    id: 'pay_1',
    profileId: 'prof_rahul',
    creditId: 'cred_1',
    paymentType: 'credit_payment',
    amount: 1000,
    paymentDate: '2026-07-13',
    paymentMethod: 'cash',
    allocationMode: 'principal_adjustment',
    previousPrincipal: 1000,
    previousInterest: 500,
    previousMisradhan: 1500,
    newPrincipal: 500,
    note: '',
    receiptNumber: 'RCP-0001',
    createdAt: '2026-07-13T10:00:00.000Z',
  };

  const editPreview = previewHistoricalPaymentEdit({
    credit: baseCredit,
    adjustments: [],
    payments: [payment],
    editedPaymentId: 'pay_1',
    newAmount: 500,
    newPaymentDate: '2026-07-13',
    newAllocationMode: 'principal_adjustment',
    asOfDate: '2026-08-13',
  });

  assert.equal(editPreview.before.currentPrincipal, 500);
  assert.equal(editPreview.after.currentPrincipal, 1000);
  assert.equal(editPreview.principalDelta, 500);

  // Reversal restores principal and interest
  const reversedPayment = { ...payment, reversed: true };
  const reversedState = reconstructCreditState(baseCredit, [], [reversedPayment], '2026-07-13');
  assert.equal(reversedState.currentPrincipal, 1000);
  assert.equal(reversedState.totalInterest, 500);
});

test('TEST 9: Leap year February (29 days) vs Non-leap February (28 days) & month-end dates', () => {
  // Leap year Feb 2024 has 29 days
  const leapHalfMonth = calculateInterest({
    principal: 2900,
    rate: 10,
    interestPeriod: 'monthly',
    interestMethod: 'simple',
    startDate: '2024-02-01',
    endDate: '2024-02-15', // 14 days out of 29
  });
  assert.equal(leapHalfMonth.duration.cycleDays, 29);
  assert.equal(leapHalfMonth.duration.remainingDays, 14);
  assert.equal(leapHalfMonth.interest, 140); // 290 * 14 / 29 = 140

  // Non-leap Feb 2025 has 28 days
  const nonLeapHalfMonth = calculateInterest({
    principal: 2800,
    rate: 10,
    interestPeriod: 'monthly',
    interestMethod: 'simple',
    startDate: '2025-02-01',
    endDate: '2025-02-15', // 14 days out of 28
  });
  assert.equal(nonLeapHalfMonth.duration.cycleDays, 28);
  assert.equal(nonLeapHalfMonth.interest, 140); // 280 * 14 / 28 = 140

  // Month-end Jan 31 -> Feb 28 (non-leap) = 1 full month
  const monthEnd = calculateCalendarMonths('2025-01-31', '2025-02-28');
  assert.equal(monthEnd.completedMonths, 1);
  assert.equal(monthEnd.remainingDays, 0);
});

test('TEST 11: Partial, full, overpayment, Interest First mode, and Main Credit Update', () => {
  // Overpayment
  const over = previewCreditPayment({
    credit: baseCredit,
    adjustments: [],
    payments: [],
    amount: 1700,
    paymentDate: '2026-07-13',
    allocationMode: 'principal_adjustment',
  });
  assert.equal(over.newPrincipal, 0);
  assert.equal(over.advanceAdded, 200);
  assert.equal(over.shouldOfferClose, true);

  // Interest First partial (pays ₹300 against ₹500 interest -> principal stays ₹1000, unpaid interest ₹200)
  const intFirst = previewCreditPayment({
    credit: baseCredit,
    adjustments: [],
    payments: [],
    amount: 300,
    paymentDate: '2026-07-13',
    allocationMode: 'interest_first',
  });
  assert.equal(intFirst.newPrincipal, 1000);
  assert.equal(intFirst.carriedUnpaidInterest, 200);

  // Effective-dated rate & principal adjustment preserves prior interest
  const adj: CreditAdjustment = {
    id: 'adj_1',
    creditId: 'cred_1',
    previousPrincipal: 1000,
    newPrincipal: 2000,
    previousInterestRate: 8.3333,
    newInterestRate: 2,
    previousInterestPeriod: 'monthly',
    newInterestPeriod: 'monthly',
    effectiveDate: '2026-07-13',
    note: 'Top up',
    createdAt: '2026-07-13T10:00:00.000Z',
  };
  const adjState = reconstructCreditState(baseCredit, [adj], [], '2026-08-13');
  // Prior 6 months interest (500) + 1 month on 2000 @ 2% (40) = 540
  assert.equal(adjState.currentPrincipal, 2000);
  assert.equal(adjState.totalInterest, 540);
});

test('Formatting and Normal Calculator expression evaluation', () => {
  assert.equal(formatINR(100000, 0), '₹1,00,000');
  assert.equal(formatDateDDMMYYYY('2026-07-13'), '13/07/2026');
  assert.equal(parseDDMMYYYYToISO('13/07/2026'), '2026-07-13');
  assert.equal(parseDDMMYYYYToISO('30/02/2026'), null);

  const calc = evaluateExpression('2 + 2 + 2 + 2 + 2');
  assert.equal(calc.result, 10);
  assert.equal(calc.formattedEquation, '2 + 2 + 2 + 2 + 2 = 10');

  const pct = evaluateExpression('(1000 * 10%) + 50');
  assert.equal(pct.result, 150);
});
