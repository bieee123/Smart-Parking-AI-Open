/**
 * AI pass-through routes.
 * Allows the frontend to call the AI microservice through the backend.
 * These are PUBLIC endpoints (no auth required) since AI health and prediction
 * are read-only operations.
 */
import { Router } from 'express';
import { aiHealth, predictDemand } from '../services/ai.js';
import {
  predictDemand as predictDemandV2,
  predictDaily,
  predictWeekly,
  predictionHealth,
} from '../services/prediction_service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// ── Legacy endpoints (backward compatible) ───────────────────────────────────

// GET /api/ai/health
router.get('/health', asyncHandler(async (_req, res) => {
  const health = await aiHealth();
  res.json({ success: true, data: health });
}));

// POST /api/ai/predict
router.post('/predict', asyncHandler(async (req, res) => {
  const { hour, horizon } = req.body;

  if (hour === undefined || typeof hour !== 'number') {
    return res.status(400).json({ success: false, error: 'hour (number, 0-23) is required' });
  }
  if (hour < 0 || hour > 23) {
    return res.status(400).json({ success: false, error: 'hour must be between 0 and 23' });
  }

  const h = horizon && typeof horizon === 'number' ? horizon : 5;
  const result = await predictDemand(hour, h);

  res.json({ success: true, data: result });
}));

// ── New prediction endpoints ─────────────────────────────────────────────────

/**
 * @route   GET /api/ai/demand/health
 * @desc    Check prediction service health
 * @access  Public
 */
router.get('/demand/health', asyncHandler(async (_req, res) => {
  const health = await predictionHealth();
  res.json({ success: true, data: health });
}));

/**
 * @route   POST /api/ai/demand/predict
 * @desc    Predict parking demand for next N hours
 * @body    { current_hour: number, horizon?: number, history?: object }
 * @access  Public
 */
router.post('/demand/predict', asyncHandler(async (req, res) => {
  const { current_hour, horizon = 5, history = {} } = req.body;

  if (current_hour === undefined || typeof current_hour !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'current_hour (number, 0-23) is required',
    });
  }
  if (current_hour < 0 || current_hour > 23) {
    return res.status(400).json({
      success: false,
      error: 'current_hour must be between 0 and 23',
    });
  }

  const result = await predictDemandV2({ current_hour, horizon, history });
  res.json({ success: true, data: result });
}));

/**
 * @route   POST /api/ai/demand/predict/daily
 * @desc    Predict parking demand for next 24 hours
 * @access  Public
 */
router.post('/demand/predict/daily', asyncHandler(async (_req, res) => {
  const result = await predictDaily();
  res.json({ success: true, data: result });
}));

/**
 * @route   POST /api/ai/demand/predict/weekly
 * @desc    Predict daily average occupancy for next 7 days
 * @access  Public
 */
router.post('/demand/predict/weekly', asyncHandler(async (_req, res) => {
  const result = await predictWeekly();
  res.json({ success: true, data: result });
}));

export default router;
