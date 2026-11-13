import { jsPDF } from 'jspdf';
import type {
  ComputedCreditState,
  ComputedDashboardSummary,
  ComputedProfileSummary,
  Credit,
  Payment,
  Profile,
} from '../types';
import { formatDateDDMMYYYY, todayISODate } from '../utils/format';

function pdfINR(amount: number, precision: 0 | 2 = 2): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = precision === 0 ? Math.round(safe) : Math.round((safe + Number.EPSILON) * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: precision === 0 ? 0 : isWhole ? 0 : 2,
    maximumFractionDigits: precision,
  }).format(rounded);
  return `Rs. ${formatted}`;
}

function drawPdfHeader(doc: jsPDF, subtitle: string): number {
  doc.setFillColor(21, 21, 43); // #15152B
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(124, 58, 237); // #7C3AED
  doc.rect(0, 30, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CREDIT LOGGER', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text(subtitle, 14, 23);

  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(`Date: ${formatDateDDMMYYYY(todayISODate())}`, 196, 15, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  return 42;
}

function addKeyValueRow(doc: jsPDF, y: number, label: string, value: string, bold = false): number {
  if (y > 275) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(label, 14, y);
  doc.setTextColor(15, 23, 42);
  doc.text(value, 196, y, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 2.5, 196, y + 2.5);
  return y + 8;
}

export function createCreditStatementPdf(
  profile: Profile,
  state: ComputedCreditState,
  payments: Payment[],
  precision: 0 | 2 = 2
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawPdfHeader(doc, `Credit Statement - ${state.credit.creditNumber}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Account & Credit Details', 14, y);
  y += 7;

  y = addKeyValueRow(doc, y, 'Loan Taker', `${profile.name}${profile.phone ? ` (${profile.phone})` : ''}`);
  y = addKeyValueRow(doc, y, 'Credit Number', state.credit.creditNumber, true);
  y = addKeyValueRow(doc, y, 'Status', state.credit.status.toUpperCase());
  y = addKeyValueRow(doc, y, 'Start Date', formatDateDDMMYYYY(state.credit.startDate));
  y = addKeyValueRow(doc, y, 'Calculation Date', formatDateDDMMYYYY(state.asOfDate));
  y = addKeyValueRow(
    doc,
    y,
    'Duration',
    `${state.durationSinceStart.completedMonths} Months, ${state.durationSinceStart.remainingDays} Days (${state.durationSinceStart.totalDays} Days)`
  );
  y = addKeyValueRow(
    doc,
    y,
    'Interest Rate',
    `${state.activeInterestRate}% (${state.activeInterestPeriod}, ${state.activeInterestMethod})`
  );
  y = addKeyValueRow(doc, y, 'Original Principal', pdfINR(state.originalPrincipal, precision));
  y = addKeyValueRow(doc, y, 'Current Principal', pdfINR(state.currentPrincipal, precision), true);
  y = addKeyValueRow(doc, y, 'Total Interest Accrued', pdfINR(state.totalInterest, precision));
  y = addKeyValueRow(doc, y, 'Total Misradhan', pdfINR(state.totalMisradhan, precision), true);
  y = addKeyValueRow(doc, y, 'Total Paid on Credit', pdfINR(state.totalPaidOnCredit, precision));
  y = addKeyValueRow(doc, y, 'Current Outstanding', pdfINR(state.outstandingAmount, precision), true);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payment History', 14, y);
  y += 7;

  const creditPayments = payments
    .filter((p) => p.creditId === state.credit.id && !p.reversed)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  if (creditPayments.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No payments recorded for this credit.', 14, y);
  } else {
    for (const p of creditPayments) {
      y = addKeyValueRow(
        doc,
        y,
        `${formatDateDDMMYYYY(p.paymentDate)} | ${p.receiptNumber} (${p.paymentMethod.toUpperCase()})`,
        `${pdfINR(p.amount, precision)} -> New Prin: ${pdfINR(p.newPrincipal, precision)}`
      );
    }
  }

  return doc;
}

export function createPaymentReceiptPdf(
  profile: Profile,
  credit: Credit | null,
  payment: Payment,
  precision: 0 | 2 = 2
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawPdfHeader(doc, `Payment Receipt - ${payment.receiptNumber}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Receipt Summary', 14, y);
  y += 8;

  y = addKeyValueRow(doc, y, 'Receipt Number', payment.receiptNumber, true);
  y = addKeyValueRow(doc, y, 'Customer Name', profile.name);
  y = addKeyValueRow(
    doc,
    y,
    'Credit Number',
    credit ? credit.creditNumber : 'Normal Payment (Non-Credit)'
  );
  y = addKeyValueRow(doc, y, 'Payment Date', formatDateDDMMYYYY(payment.paymentDate));
  y = addKeyValueRow(doc, y, 'Payment Method', payment.paymentMethod.toUpperCase());
  y = addKeyValueRow(doc, y, 'Payment Amount', pdfINR(payment.amount, precision), true);

  if (credit) {
    y += 4;
    y = addKeyValueRow(doc, y, 'Previous Principal', pdfINR(payment.previousPrincipal, precision));
    y = addKeyValueRow(doc, y, 'Previous Interest', pdfINR(payment.previousInterest, precision));
    y = addKeyValueRow(doc, y, 'Previous Misradhan', pdfINR(payment.previousMisradhan, precision));
    y = addKeyValueRow(doc, y, 'New Principal', pdfINR(payment.newPrincipal, precision), true);
  }

  if (payment.note) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Note:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(payment.note.replace(/₹/g, 'Rs. '), 180);
    doc.text(split, 14, y);
  }

  return doc;
}

export function createProfileStatementPdf(
  summary: ComputedProfileSummary,
  payments: Payment[],
  precision: 0 | 2 = 2
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawPdfHeader(doc, `Complete Profile Statement - ${summary.profile.name}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Profile Financial Summary', 14, y);
  y += 7;

  y = addKeyValueRow(doc, y, 'Full Name', summary.profile.name, true);
  if (summary.profile.phone) y = addKeyValueRow(doc, y, 'Phone', summary.profile.phone);
  if (summary.profile.address) y = addKeyValueRow(doc, y, 'Address', summary.profile.address);
  y = addKeyValueRow(doc, y, 'Total Principal', pdfINR(summary.totalPrincipal, precision));
  y = addKeyValueRow(doc, y, 'Total Interest', pdfINR(summary.totalInterest, precision));
  y = addKeyValueRow(doc, y, 'Total Misradhan', pdfINR(summary.totalMisradhan, precision), true);
  y = addKeyValueRow(doc, y, 'Total Credit Paid', pdfINR(summary.totalCreditPaid, precision));
  y = addKeyValueRow(doc, y, 'Total Normal Paid', pdfINR(summary.totalNormalPaid, precision));
  y = addKeyValueRow(doc, y, 'Total Paid Amount', pdfINR(summary.totalPaidAmount, precision));
  y = addKeyValueRow(doc, y, 'Current Outstanding', pdfINR(summary.currentOutstanding, precision), true);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Credits (${summary.creditStates.length})`, 14, y);
  y += 7;

  for (const cs of summary.creditStates) {
    y = addKeyValueRow(
      doc,
      y,
      `${cs.credit.creditNumber} [${cs.credit.status.toUpperCase()}] (${formatDateDDMMYYYY(cs.credit.startDate)})`,
      `Prin: ${pdfINR(cs.currentPrincipal, precision)} | Int: ${pdfINR(cs.totalInterest, precision)} | Out: ${pdfINR(cs.outstandingAmount, precision)}`
    );
  }

  const profilePayments = payments
    .filter((p) => p.profileId === summary.profile.id && !p.reversed)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`All Payments (${profilePayments.length})`, 14, y);
  y += 7;

  for (const p of profilePayments) {
    const typeLabel = p.paymentType === 'normal_payment' ? 'Normal' : 'Credit';
    y = addKeyValueRow(
      doc,
      y,
      `${formatDateDDMMYYYY(p.paymentDate)} | ${p.receiptNumber} | ${typeLabel}`,
      pdfINR(p.amount, precision)
    );
  }

  return doc;
}

export function createAnalyticsReportPdf(
  dashboard: ComputedDashboardSummary,
  precision: 0 | 2 = 2
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawPdfHeader(doc, 'Portfolio Analytics & Summary Report');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Global Portfolio Totals', 14, y);
  y += 7;

  y = addKeyValueRow(doc, y, 'Total Loan Takers', String(dashboard.totalLoanTakers));
  y = addKeyValueRow(doc, y, 'Active Credits', String(dashboard.totalActiveCredits));
  y = addKeyValueRow(doc, y, 'Closed Credits', String(dashboard.totalClosedCredits));
  y = addKeyValueRow(doc, y, 'Total Money Given', pdfINR(dashboard.totalMoneyGiven, precision));
  y = addKeyValueRow(doc, y, 'Total Money Received', pdfINR(dashboard.totalMoneyReceived, precision));
  y = addKeyValueRow(doc, y, 'Current Total Principal', pdfINR(dashboard.totalPrincipal, precision));
  y = addKeyValueRow(doc, y, 'Current Total Interest', pdfINR(dashboard.totalInterest, precision));
  y = addKeyValueRow(doc, y, 'Current Total Misradhan', pdfINR(dashboard.totalMisradhan, precision), true);
  y = addKeyValueRow(doc, y, 'Current Outstanding', pdfINR(dashboard.currentOutstanding, precision), true);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Person-Wise Summary', 14, y);
  y += 7;

  for (const ps of dashboard.profileSummaries) {
    y = addKeyValueRow(
      doc,
      y,
      `${ps.profile.name} (${ps.activeCreditCount} active)`,
      `Out: ${pdfINR(ps.currentOutstanding, precision)} | Paid: ${pdfINR(ps.totalPaidAmount, precision)}`
    );
  }

  return doc;
}
