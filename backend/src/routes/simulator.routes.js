/**
 * Simulator Routes — Smart Parking Policy Simulator.
 *
 * Endpoints:
 *   GET  POST /api/simulator/run          — Run simulation
 *   POST /api/simulator/policy-test       — Test a policy change
 *   GET  /api/simulator/rules             — View rule configuration
 *
 * All endpoints are public (read-only simulation).
 */

import { Router } from 'express';
import {
  getRules,
  runSimulation,
  testPolicy,
} from '../controllers/simulator.controller.js';

const router = Router();

/**
 * @route   GET /api/simulator/rules
 * @desc    View current rule configuration (thresholds, weights, priorities)
 * @access  Public
 */
router.get('/rules', getRules);

/**
 * @route   POST /api/simulator/run
 * @desc    Run the policy simulator on area data (single or multi-area)
 * @body    { area, occupancy, traffic, violations } or { areas: [...] }
 * @access  Public
 */
router.post('/run', runSimulation);

/**
 * @route   POST /api/simulator/policy-test
 * @desc    Simulate the effect of a policy change
 * @body    { policy_type, current_state, policy_params? }
 * @access  Public
 */
router.post('/policy-test', testPolicy);

export default router;
