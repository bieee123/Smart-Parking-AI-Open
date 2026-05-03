import { Router } from 'express';
import {
  getAllSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  getLogs,
  createLog,
  completeLog,
  detectVehicle,
  getDashboardSummary,
  getRecentLogs,
} from '../controllers/parking.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public read routes
router.get('/slots', getAllSlots);
router.get('/slots/:id', getSlotById);
router.get('/logs', getLogs);
router.get('/logs/recent', getRecentLogs);

// Dashboard summary (public read)
router.get('/dashboard/summary', getDashboardSummary);

// AI detection route (protected — requires auth)
router.post('/detect', authMiddleware, detectVehicle);

// Protected write routes
router.put('/slots/:id', authMiddleware, updateSlot);
router.delete('/slots/:id', authMiddleware, deleteSlot);
router.post('/logs', authMiddleware, createLog);
router.put('/logs/:id/complete', authMiddleware, completeLog);

export default router;
