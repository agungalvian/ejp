import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getInvoices, createInvoice, getInvoiceById, updateInvoiceStatus, deleteInvoice,
  getTaxParameters, createTaxParameter, updateTaxParameter,
} from '../controllers/invoices.controller';

const router = Router();
router.use(authenticate);

router.get('/', getInvoices);
router.post('/', authorize('Admin', 'Staf_Keuangan'), createInvoice);
// Tax parameters
router.get('/tax-params', getTaxParameters);
router.post('/tax-params', authorize('Admin'), createTaxParameter);
router.put('/tax-params/:taxId', authorize('Admin'), updateTaxParameter);

router.get('/:id', getInvoiceById);
router.patch('/:id/status', authorize('Admin', 'Staf_Keuangan'), upload.single('evidence'), updateInvoiceStatus);
router.delete('/:id', authorize('Admin'), deleteInvoice);

export default router;
