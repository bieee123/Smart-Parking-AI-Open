import { Router } from 'express';
import {
  getCameraLogs,
  createCameraLog,
  updateCameraStatus,
  getCameraStatus,
  getCameraStatusById,
  getAllCameras,
  updateCameraPersistentStatus,
} from '../controllers/camera.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public read routes
router.get('/status', getCameraStatus);
router.get('/', getAllCameras);
router.get('/status/:cameraId', getCameraStatusById);

// Camera status toggle — public so LiveCamera UI can persist without auth token
router.put('/:id/status', updateCameraPersistentStatus);

// Protected routes (write/delete)
router.use(authMiddleware);
router.get('/logs', getCameraLogs);
router.post('/logs', createCameraLog);
router.put('/logs/:id', updateCameraStatus);

export default router;
