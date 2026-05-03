/**
 * Logs routes — top-level endpoints for parking logs.
 * Mounted at /api/logs/* in index.js.
 *
 * NOTE: Most log routes live under /api/parking/logs (parking.routes.js).
 * This file only contains routes that the dashboard expects at /api/logs/*.
 */
import { Router } from 'express';
import { getRecentLogs } from '../controllers/parking.controller.js';

const router = Router();

// GET /api/logs/recent — used by Dashboard.jsx
router.get('/recent', getRecentLogs);

export default router;
