import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
} from '../controllers/contracts.controller';

const router = Router();
router.use(authenticate);

// Helper middleware to specify destination folder in upload middleware
const setUploadType = (type: string) => (req: any, _res: any, next: any) => {
  req.params.uploadType = type;
  next();
};

router.get('/', getContracts);
router.get('/:id', getContractById);

router.post(
  '/',
  authorize('Admin', 'Staf_Keuangan', 'Manajer_Proyek'),
  setUploadType('contracts'),
  upload.single('document'),
  createContract
);

router.put(
  '/:id',
  authorize('Admin', 'Staf_Keuangan', 'Manajer_Proyek'),
  setUploadType('contracts'),
  upload.single('document'),
  updateContract
);

router.delete('/:id', authorize('Admin'), deleteContract);

export default router;
