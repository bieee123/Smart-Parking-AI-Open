import { Router } from 'express';
import {
  getOccupancyTrends,
  getTrafficCorrelation,
  getViolationHotspots,
  getBottlenecks,
  getEfficiency,
  getSlotEfficiencyController,
  getExecutiveSummary,
} from '../controllers/analytics.controller.js';

const router = Router();

/**
 * @route   GET /api/analytics/occupancy/trends
 * @desc    Time-series parking occupancy trends per area
 * @query   range  - 1d | 7d | 30d (default: 7d)
 * @query   areaId - filter by specific area (optional)
 * @query   slotId - filter by specific slot (optional)
 * @access  Public (read-only)
 */
router.get('/occupancy/trends', getOccupancyTrends);

/**
 * @route   GET /api/analytics/traffic/correlation
 * @desc    Correlation between traffic volume and parking demand
 * @query   range - 7d | 30d (default: 7d)
 * @access  Public (read-only)
 */
router.get('/traffic/correlation', getTrafficCorrelation);

/**
 * @route   GET /api/analytics/violation/hotspots
 * @desc    Top zones with illegal parking or violations
 * @query   limit - max zones to return (default: 10, max: 50)
 * @access  Public (read-only)
 */
router.get('/violation/hotspots', getViolationHotspots);

/**
 * @route   GET /api/analytics/bottlenecks
 * @desc    Predicted or known bottleneck areas
 * @access  Public (read-only)
 */
router.get('/bottlenecks', getBottlenecks);

/**
 * @route   GET /api/analytics/efficiency
 * @desc    System efficiency: slot usage, peak patterns, turnover
 * @access  Public (read-only)
 */
router.get('/efficiency', getEfficiency);

/**
 * @route   GET /api/analytics/efficiency/slots
 * @desc    Rule-based slot efficiency from live data (occupancy, duration, turnover, utilization)
 * @access  Public (read-only)
 */
router.get('/efficiency/slots', getSlotEfficiencyController);

/**
 * @route   GET /api/analytics/executive-summary
 * @desc    Complete automated executive summary (occupancy, predictions, violations, recommendations)
 * @access  Public (read-only)
 */
router.get('/executive-summary', getExecutiveSummary);

export default router;
