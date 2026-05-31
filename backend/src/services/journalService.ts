import prisma from '../config/prisma';
import { TransactionSource } from '@prisma/client';

// ── Account code constants (matches seed CoA) ─────────────────────────────────
const COA = {
  ACCOUNTS_RECEIVABLE: '1-2000',
  CASH_BANK: '1-1200',
  INVENTORY: '1-3000',
  REVENUE_CONSTRUCTION: '4-1000',
  COGS_MATERIAL: '5-1100',
  SALARIES_EXPENSE: '5-2000',
  SALARIES_PAYABLE: '2-2000',
  DEPRECIATION_EXPENSE: '5-3000',
  ACCUMULATED_DEPRECIATION: '1-4100',
  PPN_OUTPUT: '2-3100',
};

async function getAccountId(code: string): Promise<string> {
  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) throw new Error(`Account with code '${code}' not found in Chart of Accounts`);
  return account.id;
}

// ── Helper: create a balanced transaction + journal entries ───────────────────
interface JournalLine {
  accountCode: string;
  debit?: number;
  credit?: number;
  notes?: string;
}

interface CreateJournalOptions {
  date: Date;
  description: string;
  reference_no?: string;
  evidence_file_path?: string;
  source_type: TransactionSource;
  source_id?: string;
  created_by_user_id?: string;
  lines: JournalLine[];
}

export async function createJournal(opts: CreateJournalOptions) {
  // Validate balance: sum(debits) must equal sum(credits)
  const totalDebit = opts.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = opts.lines.reduce((s, l) => s + (l.credit || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(`Journal not balanced: debits=${totalDebit}, credits=${totalCredit}`);
  }

  const accountIds = await Promise.all(opts.lines.map((l) => getAccountId(l.accountCode)));

  return prisma.transaction.create({
    data: {
      date: opts.date,
      description: opts.description,
      reference_no: opts.reference_no,
      evidence_file_path: opts.evidence_file_path,
      source_type: opts.source_type,
      source_id: opts.source_id,
      created_by_user_id: opts.created_by_user_id,
      journal_entries: {
        create: opts.lines.map((line, idx) => ({
          account_id: accountIds[idx],
          debit: line.debit || 0,
          credit: line.credit || 0,
          notes: line.notes,
        })),
      },
    },
    include: { journal_entries: true },
  });
}

// =============================================================================
// INVOICE PAID — Double-Entry Journal
// =============================================================================
/**
 * When a Project Invoice is marked 'Paid':
 *   DR  Cash/Bank           (amount received)
 *   CR  Accounts Receivable (clear the receivable)
 *   CR  PPN Output          (tax portion, if any)
 *
 * Note: When the invoice was first SENT, AR was debited and Revenue credited.
 * This function handles the PAYMENT leg (AR → Cash).
 */
export async function journalForInvoicePaid(invoiceId: string, userId?: string) {
  const invoice = await prisma.projectInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: true },
  });

  const baseAmount = Number(invoice.amount);
  const taxAmount = Number(invoice.tax_total);
  const totalAmount = Number(invoice.total_amount);

  await createJournal({
    date: invoice.paid_date || new Date(),
    description: `Payment received: ${invoice.invoice_number} — ${invoice.project.name}`,
    reference_no: `PAY-${invoice.invoice_number}`,
    evidence_file_path: invoice.evidence_file_path || undefined,
    source_type: 'Invoice',
    source_id: invoiceId,
    created_by_user_id: userId,
    lines: [
      // DR: Cash/Bank for full amount received
      { accountCode: COA.CASH_BANK, debit: totalAmount, notes: 'Payment received' },
      // CR: Clear Accounts Receivable for base amount
      { accountCode: COA.ACCOUNTS_RECEIVABLE, credit: baseAmount, notes: `AR cleared: ${invoice.invoice_number}` },
      // CR: PPN Output (tax collected on behalf of government)
      ...(taxAmount > 0 ? [{ accountCode: COA.PPN_OUTPUT, credit: taxAmount, notes: 'PPN 11%' }] : []),
    ],
  });

  // Also create the Revenue recognition entry (Invoice Sent leg)
  // DR: Accounts Receivable, CR: Revenue
  await createJournal({
    date: invoice.paid_date || new Date(),
    description: `Revenue recognized: ${invoice.invoice_number} — ${invoice.project.name}`,
    reference_no: `REV-${invoice.invoice_number}`,
    source_type: 'Invoice',
    source_id: invoiceId,
    created_by_user_id: userId,
    lines: [
      { accountCode: COA.ACCOUNTS_RECEIVABLE, debit: baseAmount, notes: 'Revenue recognition' },
      { accountCode: COA.REVENUE_CONSTRUCTION, credit: baseAmount, notes: `Project: ${invoice.project.name}` },
    ],
  });
}

// =============================================================================
// STOCK OUT — Double-Entry Journal
// =============================================================================
/**
 * When materials are issued from warehouse (Stock_Out):
 *   DR  COGS / Project Cost  (materials consumed)
 *   CR  Inventory Asset      (reduce stock value)
 */
export async function journalForStockOut(materialTransactionId: string, userId?: string) {
  const tx = await prisma.materialTransaction.findUniqueOrThrow({
    where: { id: materialTransactionId },
    include: {
      details: { include: { material: true } },
      project: true,
    },
  });

  const totalValue = tx.details.reduce(
    (sum, d) => sum + Number(d.quantity) * Number(d.unit_cost),
    0
  );

  const description = tx.project
    ? `Material Stock-Out → Proyek: ${tx.project.name}`
    : `Material Stock-Out (${materialTransactionId})`;

  await createJournal({
    date: tx.date,
    description,
    reference_no: `SO-${materialTransactionId.slice(0, 8).toUpperCase()}`,
    source_type: 'StockOut',
    source_id: materialTransactionId,
    created_by_user_id: userId,
    lines: [
      { accountCode: COA.COGS_MATERIAL, debit: totalValue, notes: 'Material consumption' },
      { accountCode: COA.INVENTORY, credit: totalValue, notes: 'Inventory reduction' },
    ],
  });
}

// =============================================================================
// PAYROLL PROCESSED — Double-Entry Journal
// =============================================================================
/**
 * When a Payroll Period is marked 'Processed':
 *   DR  Salaries Expense   (gross payroll)
 *   CR  Salaries Payable   (net salary owed to employees)
 *   CR  BPJS Payable / PPh21 Payable (deductions owed to government)
 */
export async function journalForPayrollProcessed(payrollPeriodId: string, userId?: string) {
  const period = await prisma.payrollPeriod.findUniqueOrThrow({
    where: { id: payrollPeriodId },
    include: { payroll_details: true },
  });

  const totals = period.payroll_details.reduce(
    (acc, d) => ({
      gross: acc.gross + Number(d.gross_salary),
      net: acc.net + Number(d.net_salary),
      deductions: acc.deductions + Number(d.total_deductions),
    }),
    { gross: 0, net: 0, deductions: 0 }
  );

  const periodLabel = `${period.period_month.toString().padStart(2, '0')}/${period.period_year}`;

  await createJournal({
    date: new Date(),
    description: `Payroll Processed — Period ${periodLabel}`,
    reference_no: `PAY-${period.period_year}${period.period_month.toString().padStart(2, '0')}`,
    source_type: 'Payroll',
    source_id: payrollPeriodId,
    created_by_user_id: userId,
    lines: [
      // DR: Total gross salary expense
      { accountCode: COA.SALARIES_EXPENSE, debit: totals.gross, notes: `Gross payroll ${periodLabel}` },
      // CR: Net salaries payable to employees
      { accountCode: COA.SALARIES_PAYABLE, credit: totals.net, notes: `Net salaries payable ${periodLabel}` },
      // CR: Deductions payable (BPJS + PPh21 combined for simplicity)
      ...(totals.deductions > 0
        ? [{ accountCode: COA.SALARIES_PAYABLE, credit: totals.deductions, notes: `Deductions (BPJS/PPh21) ${periodLabel}` }]
        : []),
    ],
  });
}

// =============================================================================
// ASSET DEPRECIATION — Double-Entry Journal
// =============================================================================
/**
 * Monthly depreciation:
 *   DR  Depreciation Expense
 *   CR  Accumulated Depreciation
 */
export async function journalForDepreciation(
  equipmentId: string,
  amount: number,
  month: number,
  year: number,
  userId?: string
) {
  const equipment = await prisma.heavyEquipment.findUniqueOrThrow({ where: { id: equipmentId } });
  const periodLabel = `${month.toString().padStart(2, '0')}/${year}`;

  await createJournal({
    date: new Date(year, month - 1, 1),
    description: `Depreciation: ${equipment.name} — ${periodLabel}`,
    reference_no: `DEP-${equipment.asset_code}-${year}${month.toString().padStart(2, '0')}`,
    source_type: 'Depreciation',
    source_id: equipmentId,
    created_by_user_id: userId,
    lines: [
      { accountCode: COA.DEPRECIATION_EXPENSE, debit: amount, notes: `Depreciation ${periodLabel}` },
      { accountCode: COA.ACCUMULATED_DEPRECIATION, credit: amount, notes: `Accumulated: ${equipment.name}` },
    ],
  });
}
