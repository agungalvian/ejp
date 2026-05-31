import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAccounts, createAccount, updateAccount,
  getTransactions, createManualTransaction,
  getGeneralLedger, getProfitLoss, getBalanceSheet,
  getJournalEntries,
} from '../controllers/ledger.controller';

const router = Router();
router.use(authenticate, authorize('Admin', 'Staf_Keuangan'));

// Chart of Accounts
router.get('/accounts', getAccounts);
router.post('/accounts', createAccount);
router.put('/accounts/:id', updateAccount);

// Transactions / General Ledger
router.get('/transactions', getTransactions);
router.post('/transactions', createManualTransaction);
router.get('/transactions/:id/entries', getJournalEntries);

// Reports
router.get('/general-ledger', getGeneralLedger);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);

export default router;
