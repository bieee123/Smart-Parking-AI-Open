/**
 * Parking Policy Simulator Engine — Main Orchestrator.
 *
 * Loads rules from rules.js, accepts input data,
 * runs simulation, and returns structured output.
 *
 * Accepts input like:
 *   {
 *     area: "A",
 *     occupancy: 83,
 *     traffic: 120,
 *     violations: 4,
 *     slot_details: [...]
 *   }
 *
 * Returns:
 *   {
 *     status: "ok",
 *     area: "A",
 *     analysis: { ... },
 *     suggestions: [ ... ],
 *     bottlenecks: [ ... ],
 *     efficiency_score: 0.71
 *   }
 *
 * TODO: This engine will be replaced by an ML-based policy optimizer
 *       when enough historical data is available.
 */

import { ruleEngine, RuleEngine } from './rules.js';

// ── Input Validation ─────────────────────────────────────────────────────────

/**
 * Validate simulator input object.
 * Returns { valid: boolean, errors: string[] }
 */
function validateInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be a non-null object'] };
  }

  // Single area input
  if (input.area !== undefined) {
    if (typeof input.area !== 'string' || input.area.trim().length === 0) {
      errors.push('area must be a non-empty string');
    }
    if (input.occupancy !== undefined && (typeof input.occupancy !== 'number' || input.occupancy < 0 || input.occupancy > 100)) {
      errors.push('occupancy must be a number between 0 and 100');
    }
    if (input.traffic !== undefined && (typeof input.traffic !== 'number' || input.traffic < 0)) {
      errors.push('traffic must be a non-negative number');
    }
    if (input.violations !== undefined && typeof input.violations !== 'number') {
      errors.push('violations must be a number');
    }
  }

  // Multi-area input
  if (input.areas !== undefined) {
    if (!Array.isArray(input.areas)) {
      errors.push('areas must be an array');
    } else if (input.areas.length === 0) {
      errors.push('areas array must not be empty');
    } else {
      input.areas.forEach((area, i) => {
        if (!area.area && !area.area_id) {
          errors.push(`areas[${i}] must have area or area_id`);
        }
        if (area.occupancy_percent !== undefined &&
            (typeof area.occupancy_percent !== 'number' || area.occupancy_percent < 0 || area.occupancy_percent > 100)) {
          errors.push(`areas[${i}].occupancy_percent must be 0-100`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Sanitize Output ──────────────────────────────────────────────────────────

/**
 * Sanitize simulation output for safe API response.
 * Removes any internal engine state and normalizes values.
 */
function sanitizeOutput(output) {
  // Ensure efficiency score is bounded
  if (output.efficiency_score !== undefined) {
    output.efficiency_score = Math.max(0, Math.min(1, output.efficiency_score));
  }

  // Ensure timestamps are ISO strings
  if (output.timestamp) {
    try {
      new Date(output.timestamp).toISOString();
    } catch {
      output.timestamp = new Date().toISOString();
    }
  }

  return output;
}

// ── Simulator Engine ─────────────────────────────────────────────────────────

class SimulatorEngine {
  constructor(options = {}) {
    this.ruleEngine = options.ruleEngine || ruleEngine;
  }

  /**
   * Run a single-area simulation.
   *
   * @param {Object} input
   * @param {string} input.area - Area identifier
   * @param {number} [input.occupancy] - Occupancy percentage (0-100)
   * @param {number} [input.traffic] - Traffic volume
   * @param {number} [input.violations] - Violation count
   * @param {Object[]} [input.slot_details] - Individual slot states
   * @param {number} [input.capacity] - Area capacity
   * @param {number} [input.avg_speed_kmh] - Average speed
   * @param {number} [input.vehicles_entering] - Vehicles entering
   * @param {number} [input.vehicles_leaving] - Vehicles leaving
   * @returns {Object} Simulation result
   */
  runSingle(input) {
    const validation = validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid input',
        details: validation.errors,
      };
    }

    const area = input.area;
    const occupancyPercent = input.occupancy || 0;
    const trafficVolume = input.traffic || 0;
    const violationCount = input.violations || 0;
    const capacity = input.capacity || 200;

    // Build area stats for rule engine
    const areaStats = {
      area,
      occupancy_percent: occupancyPercent,
      traffic_volume: trafficVolume,
      capacity,
      violations: {
        count: violationCount,
        window_minutes: 15,
      },
      avg_speed_kmh: input.avg_speed_kmh,
      vehicles_entering: input.vehicles_entering,
      vehicles_leaving: input.vehicles_leaving,
    };

    // Run rule evaluations
    const occupancyResult = this.ruleEngine.evaluateOccupancy(occupancyPercent);
    const bottleneckResult = this.ruleEngine.detectBottleneck(areaStats);
    const violationResult = this.ruleEngine.evaluateViolations({
      count: violationCount,
    });

    // Evaluate slots if provided
    let slotEvaluation = null;
    if (input.slot_details && input.slot_details.length > 0) {
      slotEvaluation = this.ruleEngine.evaluateParkingSlots(input.slot_details);
    }

    // Reroute suggestions
    const rerouteResult = this.ruleEngine.suggestAlternative(
      { area, occupancy_percent: occupancyPercent, capacity },
      input.alternative_areas || []
    );

    // Efficiency
    const efficiencyScore = this.ruleEngine.calculateEfficiency({
      occupancy_percent: occupancyPercent,
      traffic_volume: trafficVolume,
      max_traffic: capacity,
      violations: violationCount,
    });

    // Collect suggestions
    const suggestions = [];
    if (occupancyResult.action) suggestions.push(occupancyResult.message);
    if (bottleneckResult.detected) {
      suggestions.push(
        `Bottleneck detected: ${bottleneckResult.reasons.join('; ')}`
      );
    }
    if (violationResult.alert) {
      suggestions.push(...violationResult.actions);
    }
    if (rerouteResult.suggested) {
      suggestions.push(rerouteResult.message);
    }

    const result = {
      success: true,
      status: 'ok',
      area,
      timestamp: new Date().toISOString(),
      analysis: {
        occupancy_status: occupancyResult.status,
        occupancy_severity: occupancyResult.severity,
        occupancy_percent: occupancyPercent,
        traffic_status: bottleneckResult.level,
        traffic_volume: trafficVolume,
        violation_status: violationResult.severity,
        violation_count: violationCount,
      },
      bottlenecks: bottleneckResult.detected
        ? [
            {
              area,
              level: bottleneckResult.level,
              reasons: bottleneckResult.reasons,
              traffic_ratio: bottleneckResult.traffic_ratio,
            },
          ]
        : [],
      suggestions,
      reroute: rerouteResult.suggested
        ? {
            action: rerouteResult.action,
            alternatives: rerouteResult.alternatives,
          }
        : null,
      slot_evaluation: slotEvaluation,
      efficiency_score: efficiencyScore,
      priority: Math.min(
        violationResult.priority,
        bottleneckResult.priority,
        occupancyResult.priority
      ),
    };

    return sanitizeOutput(result);
  }

  /**
   * Run a multi-area simulation.
   *
   * @param {Object} input
   * @param {Object[]} input.areas - Array of area stats
   * @param {Object[]} [input.slots] - Optional slot data
   * @returns {Object} Multi-area simulation result
   */
  runMultiArea(input) {
    const validation = validateInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid input',
        details: validation.errors,
      };
    }

    const result = this.ruleEngine.runSimulation({
      areas: input.areas,
      slots: input.slots,
    });

    return sanitizeOutput({ success: true, ...result });
  }

  /**
   * Test a policy change via simulation.
   *
   * @param {Object} input
   * @param {string} input.policy_type - Policy to test
   * @param {Object} input.current_state - Current system state
   * @param {Object} [input.policy_params] - Policy parameters
   * @returns {Object} Simulation of policy outcome
   */
  testPolicy(input) {
    if (!input || !input.policy_type || !input.current_state) {
      return {
        success: false,
        error: 'policy_type and current_state are required',
      };
    }

    const result = this.ruleEngine.simulatePolicy({
      policy_type: input.policy_type,
      current_state: input.current_state,
      policy_params: input.policy_params || {},
    });

    return sanitizeOutput({ success: true, ...result });
  }

  /**
   * Get current rule configuration (for GET /rules endpoint).
   *
   * @returns {Object} Rule configuration
   */
  getRules() {
    return {
      success: true,
      rules: this.ruleEngine.config,
      priority_levels: {
        1: 'Safety — illegal parking, blocking, fire lane violations',
        2: 'Congestion — bottleneck detection, overflow, rerouting',
        3: 'Efficiency — load balancing, underutilization, pricing',
      },
    };
  }
}

// ── Singleton instance ───────────────────────────────────────────────────────

export const simulatorEngine = new SimulatorEngine();
export { SimulatorEngine, validateInput, sanitizeOutput };
