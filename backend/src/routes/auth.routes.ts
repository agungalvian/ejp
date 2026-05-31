import { Router } from 'express';
import { login, logout, me, refreshToken } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.post('/refresh', authenticate, refreshToken);

export default router;
