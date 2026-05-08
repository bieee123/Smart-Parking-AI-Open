import { Router } from 'express';
import {
  getPublicSlots,
  createReservation,
  getMyReservations,
  cancelReservation,
  getTariff,
  checkinReservation,
  getAllReservations,
} from '../controllers/reservation.controller.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// Public (no auth needed)
router.get('/public/slots', getPublicSlots);
router.get('/reservations/tariff', getTariff);

// Protected (viewer/admin/operator)
router.post('/reservations', authMiddleware, createReservation);
router.get('/reservations/my', authMiddleware, getMyReservations);
router.patch('/reservations/:id/checkin', authMiddleware, checkinReservation);
router.delete('/reservations/:id', authMiddleware, cancelReservation);

// Admin/Operator only
router.get('/reservations/all', authMiddleware, getAllReservations);

export default router;
