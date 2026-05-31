import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getUsers, createUser, getUserById, updateUser, deleteUser,
  getRoles, createRole, updateRole, deleteRole, getUnlinkedEmployees,
} from '../controllers/users.controller';

const router = Router();

// Secure all user/role management endpoints to administrators
router.use(authenticate, authorize('Admin'));

// Users
router.get('/', getUsers);
router.post('/', createUser);
router.get('/unlinked-employees', getUnlinkedEmployees);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

// Roles
router.get('/roles', getRoles);
router.post('/roles', createRole);
router.put('/roles/:id', updateRole);
router.delete('/roles/:id', deleteRole);

export default router;
