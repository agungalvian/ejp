import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getContacts, createContact, getContactById, updateContact, deleteContact,
} from '../controllers/contacts.controller';

const router = Router();
router.use(authenticate);

router.get('/', getContacts);
router.post('/', authorize('Admin', 'Staf_Keuangan', 'Manajer_Proyek'), createContact);
router.get('/:id', getContactById);
router.put('/:id', authorize('Admin', 'Staf_Keuangan', 'Manajer_Proyek'), updateContact);
router.delete('/:id', authorize('Admin'), deleteContact);

export default router;
