/**
 * Executive Summary Controller.
 *
 * GET /api/analytics/executive-summary
 * Returns a complete automated executive summary.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { generateExecutiveSummary } from '../services/executiveSummary.js';

/**
 * @route   GET /api/analytics/executive-summary
 * @desc    Generate complete executive summary (occupancy, predictions, violations, recommendations)
 * @access  Public (read-only)
 */
export const getExecutiveSummary = asyncHandler(async (_req, res) => {
  const summary = generateExecutiveSummary();

  if (!summary.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
      details: summary.details || null,
      generated_at: summary.generated_at,
    });
  }

  res.json(summary);
});
