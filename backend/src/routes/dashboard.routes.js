/**
 * Dashboard routes — top-level endpoints for the main dashboard.
 * Mounted at /api/dashboard/* in index.js
 */
import { Router } from 'express';
import { getDashboardSummary } from '../controllers/parking.controller.js';

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', getDashboardSummary);

export default router;
