import { Router } from 'express';
import { getAllUsers, createUser, updateUser, deleteUser } from '../controllers/admin.controller.js';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.js';

const router = Router();

// All admin routes are protected by auth and admin role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router;
