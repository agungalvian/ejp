import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AccountType } from '@prisma/client';
import { createJournal } from '../services/journalService';
import { AuthRequest } from '../middleware/auth';

// ── Chart of Accounts ─────────────────────────────────────────────────────────
export const getAccounts = async (req: Request, res: Response) => {
  const { type } = req.query;
  const accounts = await prisma.account.findMany({
    where: {
      is_active: true,
      ...(type ? { type: type as AccountType } : {}),
    },
    include: { children: { where: { is_active: true } } },
    orderBy: { code: 'asc' },
  });
  res.json({ success: true, data: accounts });
};

export const createAccount = async (req: Request, res: Response) => {
  const account = await prisma.account.create({ data: req.body });
  res.status(201).json({ success: true, data: account });
};

export const updateAccount = async (req: Request, res: Response) => {
  const account = await prisma.account.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: account });
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = async (req: Request, res: Response) => {
  const { from_date, to_date, source_type } = req.query;
  const transactions = await prisma.transaction.findMany({
    where: {
      ...(source_type ? { source_type: source_type as any } : {}),
      ...(from_date || to_date
        ? { date: { ...(from_date ? { gte: new Date(String(from_date)) } : {}), ...(to_date ? { lte: new Date(String(to_date)) } : {}) } }
        : {}),
    },
    include: {
      journal_entries: { include: { account: { select: { code: true, name: true } } } },
      created_by: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json({ success: true, data: transactions });
};

export const createManualTransaction = async (req: AuthRequest, res: Response) => {
  const { date, description, reference_no, lines } = req.body;
  const tx = await createJournal({
    date: new Date(date),
    description,
    reference_no,
    source_type: 'Manual',
    created_by_user_id: req.user?.id,
    lines,
  });
  res.status(201).json({ success: true, data: tx });
};

export const getJournalEntries = async (req: Request, res: Response) => {
  const entries = await prisma.journalEntry.findMany({
    where: { transaction_id: req.params.id },
    include: { account: { select: { code: true, name: true, type: true } } },
    orderBy: { debit: 'desc' },
  });
  res.json({ success: true, data: entries });
};

// ── General Ledger ────────────────────────────────────────────────────────────
export const getGeneralLedger = async (req: Request, res: Response) => {
  const { account_id, from_date, to_date } = req.query;

  const entries = await prisma.journalEntry.findMany({
    where: {
      ...(account_id ? { account_id: String(account_id) } : {}),
      transaction: {
        date: {
          ...(from_date ? { gte: new Date(String(from_date)) } : {}),
          ...(to_date ? { lte: new Date(String(to_date)) } : {}),
        },
      },
    },
    include: {
      account: { select: { code: true, name: true, type: true } },
      transaction: { select: { date: true, description: true, reference_no: true } },
    },
    orderBy: { transaction: { date: 'asc' } },
  });

  // Compute running balance
  let runningBalance = 0;
  const ledgerData = entries.map((e) => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, running_balance: runningBalance };
  });

  res.json({ success: true, data: ledgerData });
};

// ── Profit & Loss ─────────────────────────────────────────────────────────────
export const getProfitLoss = async (req: Request, res: Response) => {
  const { from_date, to_date } = req.query;

  const dateFilter = {
    transaction: {
      date: {
        ...(from_date ? { gte: new Date(String(from_date)) } : {}),
        ...(to_date ? { lte: new Date(String(to_date)) } : {}),
      },
    },
  };

  // Aggregate by account type
  const revenueEntries = await prisma.journalEntry.findMany({
    where: { account: { type: 'Revenue' }, ...dateFilter },
    include: { account: { select: { code: true, name: true } } },
  });

  const expenseEntries = await prisma.journalEntry.findMany({
    where: { account: { type: 'Expense' }, ...dateFilter },
    include: { account: { select: { code: true, name: true } } },
  });

  // Group by account
  const groupByAccount = (entries: typeof revenueEntries) => {
    const map = new Map<string, { code: string; name: string; total: number }>();
    for (const e of entries) {
      const key = e.account_id;
      if (!map.has(key)) map.set(key, { code: e.account.code, name: e.account.name, total: 0 });
      map.get(key)!.total += Number(e.credit) - Number(e.debit);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  };

  const revenues = groupByAccount(revenueEntries);
  const expenses = groupByAccount(expenseEntries).map((e) => ({ ...e, total: -e.total }));

  const totalRevenue = revenues.reduce((s, r) => s + r.total, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.total, 0);
  const netIncome = totalRevenue - totalExpense;

  res.json({
    success: true,
    data: {
      revenues,
      expenses,
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_income: netIncome,
      period: { from_date, to_date },
    },
  });
};

// ── Balance Sheet ─────────────────────────────────────────────────────────────
export const getBalanceSheet = async (req: Request, res: Response) => {
  const { as_of_date } = req.query;
  const dateFilter = as_of_date
    ? { transaction: { date: { lte: new Date(String(as_of_date)) } } }
    : {};

  const allEntries = await prisma.journalEntry.findMany({
    where: dateFilter,
    include: { account: { select: { code: true, name: true, type: true } } },
  });

  const balances = new Map<string, { code: string; name: string; type: string; balance: number }>();

  for (const e of allEntries) {
    const key = e.account_id;
    if (!balances.has(key)) {
      balances.set(key, { code: e.account.code, name: e.account.name, type: e.account.type, balance: 0 });
    }
    const entry = balances.get(key)!;
    // Normal balance: Assets/Expense = Debit normal; Liability/Equity/Revenue = Credit normal
    if (['Asset', 'Expense'].includes(e.account.type)) {
      entry.balance += Number(e.debit) - Number(e.credit);
    } else {
      entry.balance += Number(e.credit) - Number(e.debit);
    }
  }

  const byType = (type: string) =>
    Array.from(balances.values()).filter((b) => b.type === type && b.balance !== 0);

  const assets = byType('Asset');
  const liabilities = byType('Liability');
  const equity = byType('Equity');

  res.json({
    success: true,
    data: {
      assets,
      liabilities,
      equity,
      total_assets: assets.reduce((s, a) => s + a.balance, 0),
      total_liabilities: liabilities.reduce((s, l) => s + l.balance, 0),
      total_equity: equity.reduce((s, e) => s + e.balance, 0),
      as_of_date,
    },
  });
};
