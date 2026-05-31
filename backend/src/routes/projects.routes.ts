import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getProjects, createProject, getProjectById, updateProject, deleteProject,
  getRabBudgets, createRabBudget, updateRabBudget, deleteRabBudget,
} from '../controllers/projects.controller';

const router = Router();
router.use(authenticate);

router.get('/', getProjects);
router.post('/', authorize('Admin', 'Manajer_Proyek'), createProject);
router.get('/:id', getProjectById);
router.put('/:id', authorize('Admin', 'Manajer_Proyek'), updateProject);
router.delete('/:id', authorize('Admin'), deleteProject);

// RAB Budgets
router.get('/:id/rab', getRabBudgets);
router.post('/:id/rab', authorize('Admin', 'Manajer_Proyek'), createRabBudget);
router.put('/:id/rab/:rabId', authorize('Admin', 'Manajer_Proyek'), updateRabBudget);
router.delete('/:id/rab/:rabId', authorize('Admin'), deleteRabBudget);

export default router;
