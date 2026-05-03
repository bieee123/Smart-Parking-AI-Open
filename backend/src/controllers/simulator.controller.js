/**
 * Simulator Controller — Smart Parking Policy Simulator.
 *
 * Handles:
 *  - Input validation
 *  - Rule engine execution
 *  - Response formatting
 *  - Error catching
 *  - Mock output sanitization
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { simulatorEngine } from '../simulator/engine.js';

// ── GET /api/simulator/rules ────────────────────────────────────────────────

/**
 * Return current rule configuration.
 * Shows all thresholds, priority levels, and weights.
 *
 * @returns {Object} Rule config
 */
export const getRules = asyncHandler(async (_req, res) => {
  const result = simulatorEngine.getRules();
  res.json(result);
});

// ── POST /api/simulator/run ─────────────────────────────────────────────────

/**
 * Run the policy simulator on provided area data.
 *
 * Accepts single-area or multi-area input.
 *
 * Single-area body:
 *   { area, occupancy, traffic, violations, slot_details, capacity }
 *
 * Multi-area body:
 *   { areas: [{ area, occupancy_percent, capacity, ... }] }
 *
 * @returns {Object} Simulation result
 */
export const runSimulation = asyncHandler(async (req, res) => {
  const input = req.body;

  if (!input) {
    return res.status(400).json({
      success: false,
      error: 'Request body is required',
      hint: 'Provide { area, occupancy, traffic, violations } or { areas: [...] }',
    });
  }

  let result;

  // Detect single vs multi-area
  if (input.areas && Array.isArray(input.areas)) {
    result = simulatorEngine.runMultiArea(input);
  } else if (input.area) {
    result = simulatorEngine.runSingle(input);
  } else {
    return res.status(400).json({
      success: false,
      error: 'Either "area" (string) or "areas" (array) is required',
    });
  }

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// ── POST /api/simulator/policy-test ─────────────────────────────────────────

/**
 * Test a policy change via simulation.
 *
 * Body:
 *   {
 *     policy_type: "dynamic_pricing" | "time_limit" | "reserved_zones" |
 *                  "enforcement_boost" | "reroute_active",
 *     current_state: { occupancy_percent, traffic_volume, violations, capacity },
 *     policy_params: { ... }  // optional, type-specific
 *   }
 *
 * @returns {Object} Simulated policy outcome
 */
export const testPolicy = asyncHandler(async (req, res) => {
  const { policy_type, current_state, policy_params } = req.body;

  if (!policy_type) {
    return res.status(400).json({
      success: false,
      error: 'policy_type is required',
      valid_types: [
        'dynamic_pricing',
        'time_limit',
        'reserved_zones',
        'enforcement_boost',
        'reroute_active',
      ],
    });
  }

  if (!current_state) {
    return res.status(400).json({
      success: false,
      error: 'current_state is required',
      hint: 'Provide { occupancy_percent, traffic_volume, violations, capacity }',
    });
  }

  const result = simulatorEngine.testPolicy({
    policy_type,
    current_state,
    policy_params: policy_params || {},
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});
