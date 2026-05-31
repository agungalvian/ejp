import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getEquipment, createEquipment, getEquipmentById, updateEquipment,
  getRentalLogs, createRentalLog, closeRentalLog,
  getDepreciations, runDepreciation,
} from '../controllers/equipment.controller';

const router = Router();
router.use(authenticate);

router.get('/', getEquipment);
router.post('/', authorize('Admin', 'Staf_Keuangan'), createEquipment);
router.get('/:id', getEquipmentById);
router.put('/:id', authorize('Admin', 'Staf_Keuangan'), updateEquipment);

// Rental logs
router.get('/:id/rentals', getRentalLogs);
router.post('/:id/rentals', authorize('Admin', 'Manajer_Proyek'), createRentalLog);
router.patch('/:id/rentals/:logId/close', authorize('Admin', 'Manajer_Proyek'), closeRentalLog);

// Depreciation
router.get('/:id/depreciation', getDepreciations);
router.post('/depreciation/run', authorize('Admin', 'Staf_Keuangan'), runDepreciation);

export default router;
