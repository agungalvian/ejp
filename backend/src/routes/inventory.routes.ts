import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getMaterials, createMaterial, updateMaterial,
  getWarehouses, createWarehouse,
  getStocks, createTransaction, getTransactions,
} from '../controllers/inventory.controller';

const router = Router();
router.use(authenticate);

// Materials
router.get('/materials', getMaterials);
router.post('/materials', authorize('Admin', 'Staf_Keuangan'), createMaterial);
router.put('/materials/:id', authorize('Admin', 'Staf_Keuangan'), updateMaterial);

// Warehouses
router.get('/warehouses', getWarehouses);
router.post('/warehouses', authorize('Admin'), createWarehouse);

// Stocks
router.get('/stocks', getStocks);

// Transactions (Stock In/Out/Transfer)
router.get('/transactions', getTransactions);
router.post(
  '/transactions',
  authorize('Admin', 'Manajer_Proyek', 'Lapangan'),
  upload.single('evidence'),
  createTransaction
);

export default router;
