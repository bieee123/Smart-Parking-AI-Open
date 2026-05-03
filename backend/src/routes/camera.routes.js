import { Router } from 'express';
import {
  getCameraLogs,
  createCameraLog,
  updateCameraStatus,
  getCameraStatus,
  getCameraStatusById,
} from '../controllers/camera.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public read
router.get('/status/:cameraId', getCameraStatusById);

// Protected routes
router.use(authMiddleware);
router.get('/logs', getCameraLogs);
router.post('/logs', createCameraLog);
router.put('/logs/:id', updateCameraStatus);
router.get('/status', getCameraStatus);

export default router;
