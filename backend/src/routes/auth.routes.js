import { Router } from 'express';
import { 
  register, login, getProfile, 
  setup2FA, verify2FASetup, authenticate2FA,
  update2FAMethod, resend2FACode 
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);

// 2FA Routes
router.post('/2fa/setup', authMiddleware, setup2FA);
router.post('/2fa/verify', authMiddleware, verify2FASetup);
router.post('/2fa/authenticate', authenticate2FA);
router.post('/2fa/resend', resend2FACode);
router.patch('/2fa/method', authMiddleware, update2FAMethod);

export default router;
