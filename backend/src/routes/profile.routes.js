import { Router } from 'express';
import { getMyProfile, updateProfile, changePassword, getMyActivities, deleteAccount, revokeAllSessions } from '../controllers/profile.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// All profile routes are protected
router.use(authMiddleware);

router.get('/', getMyProfile);
router.patch('/', updateProfile);
router.post('/password', changePassword);
router.get('/activities', getMyActivities);
router.delete('/', deleteAccount);
router.post('/revoke-sessions', revokeAllSessions);

export default router;
