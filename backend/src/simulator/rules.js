/**
 * Parking Policy Rule Engine — Smart Parking Simulator.
 *
 * Rule-based decision engine for:
 *  - Occupancy thresholds
 *  - Bottleneck detection
 *  - Rerouting logic
 *  - Area balancing
 *  - Violation escalation
 *
 * Priority Levels:
 *  Level 1 — Safety       (illegal parking, fire lanes, disabled abuse)
 *  Level 2 — Congestion   (bottleneck, overflow, entry/exit queues)
 *  Level 3 — Efficiency   (load balancing, underutilization, pricing)
 *
 * TODO: This rule engine will be replaced by an ML policy optimizer
 *       once enough historical data is collected.
 */

// ── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  // Occupancy thresholds (percentage)
  occupancy: {
    risk_high: 85,
    full: 95,
    underutilized: 50,
    optimal_min: 60,
    optimal_max: 80,
  },

  // Traffic thresholds
  traffic: {
    bottleneck_risk_ratio: 0.8,    // vehicles_entering / capacity ratio
    overflow_threshold: 1.0,        // vehicles > capacity = overflow
    congestion_speed_kmh: 15,       // avg speed below this = congested
  },

  // Violation thresholds
  violations: {
    enforcement_alert_count: 3,     // violations in window
    enforcement_window_minutes: 15, // time window for counting
    patrol_suggest_threshold: 2,    // illegal parking triggers patrol
  },

  // Efficiency scoring weights
  efficiency: {
    weight_occupancy: 0.3,
    weight_traffic: 0.4,
    weight_violations: 0.3,
  },

  // Rerouting
  reroute: {
    suggest_threshold: 80,          // occupancy % to trigger reroute
    max_suggestions: 3,             // max alternative areas to suggest
  },
};

// ── Rule Engine ──────────────────────────────────────────────────────────────

class RuleEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 1. OCCUPANCY RULES (Priority Level 3 → 2)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Evaluate occupancy status for an area.
   *
   * @param {number} occupancyPercent - Current occupancy percentage (0-100)
   * @returns {{ status: string, level: number, action: string|null }}
   */
  evaluateOccupancy(occupancyPercent) {
    const { risk_high, full, underutilized, optimal_min, optimal_max } =
      this.config.occupancy;

    if (occupancyPercent >= full) {
      return {
        status: 'full',
        severity: 'critical',
        priority: 2, // Level 2 — Congestion
        action: 'reroute_immediately',
        message: `Area is ${occupancyPercent}% full — immediate reroute required`,
      };
    }

    if (occupancyPercent >= risk_high) {
      return {
        status: 'high',
        severity: 'high',
        priority: 2, // Level 2 — Congestion
        action: 'prepare_reroute',
        message: `Area at ${occupancyPercent}% — approaching capacity, prepare rerouting`,
      };
    }

    if (occupancyPercent >= optimal_min && occupancyPercent <= optimal_max) {
      return {
        status: 'optimal',
        severity: 'low',
        priority: 3, // Level 3 — Efficiency
        action: null,
        message: `Area at ${occupancyPercent}% — operating in optimal range`,
      };
    }

    if (occupancyPercent >= underutilized) {
      return {
        status: 'moderate',
        severity: 'low',
        priority: 3, // Level 3 — Efficiency
        action: 'monitor',
        message: `Area at ${occupancyPercent}% — moderate usage, no action needed`,
      };
    }

    // Below underutilized threshold
    return {
      status: 'underutilized',
      severity: 'info',
      priority: 3, // Level 3 — Efficiency
      action: 'suggest_load_shift',
      message: `Area at ${occupancyPercent}% — underutilized, consider redirecting traffic here`,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. BOTTLENECK DETECTION (Priority Level 2)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Detect bottleneck risk for an area based on traffic flow.
   *
   * @param {Object} area - Area stats
   * @param {number} area.traffic_volume - Vehicles in area
   * @param {number} area.capacity - Total capacity
   * @param {number} area.occupancy_percent - Current occupancy %
   * @param {number} [area.avg_speed_kmh] - Average vehicle speed
   * @param {number} [area.vehicles_entering] - Vehicles entering in last interval
   * @param {number} [area.vehicles_leaving] - Vehicles leaving in last interval
   * @returns {{ detected: boolean, level: string, reason: string }}
   */
  detectBottleneck(area) {
    const { bottleneck_risk_ratio, overflow_threshold, congestion_speed_kmh } =
      this.config.traffic;

    const capacity = area.capacity || 100;
    const trafficRatio = area.traffic_volume / capacity;
    const inflowOutflowDiff =
      (area.vehicles_entering || 0) - (area.vehicles_leaving || 0);

    const reasons = [];
    let level = 'none';

    // Rule: inflow significantly exceeds outflow
    if (inflowOutflowDiff > capacity * 0.1) {
      reasons.push(`Inflow exceeds outflow by ${inflowOutflowDiff} vehicles`);
      level = 'warning';
    }

    // Rule: traffic ratio approaching capacity
    if (trafficRatio >= bottleneck_risk_ratio) {
      reasons.push(`Traffic volume at ${(trafficRatio * 100).toFixed(0)}% of capacity`);
      level = level === 'none' ? 'warning' : 'high';
    }

    // Rule: low average speed = congestion
    if (area.avg_speed_kmh !== undefined && area.avg_speed_kmh < congestion_speed_kmh) {
      reasons.push(`Average speed ${area.avg_speed_kmh} km/h below threshold (${congestion_speed_kmh})`);
      level = 'critical';
    }

    // Rule: occupancy above risk threshold
    if (area.occupancy_percent >= this.config.occupancy.risk_high) {
      reasons.push(`Occupancy at ${area.occupancy_percent}% — risk zone`);
      if (level !== 'critical') level = 'high';
    }

    const detected = reasons.length > 0;

    return {
      detected,
      level, // 'none' | 'warning' | 'high' | 'critical'
      area: area.area || area.area_id || 'unknown',
      reasons,
      traffic_ratio: parseFloat(trafficRatio.toFixed(4)),
      inflow_outflow_diff: inflowOutflowDiff,
      priority: 2, // Level 2 — Congestion
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 3. VIOLATION ESCALATION (Priority Level 1)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Evaluate violation patterns and suggest enforcement actions.
   *
   * @param {Object} violationStats
   * @param {number} violationStats.count - Violations in recent window
   * @param {number} [violationStats.illegal_parking] - Illegal parking count
   * @param {number} [violationStats.blocking] - Blocking count
   * @param {number} [violationStats.overtime] - Overtime count
   * @param {number} [violationStats.window_minutes] - Time window
   * @returns {{ alert: boolean, actions: string[], severity: string }}
   */
  evaluateViolations(violationStats) {
    const { enforcement_alert_count, enforcement_window_minutes, patrol_suggest_threshold } =
      this.config.violations;

    const count = violationStats.count || 0;
    const window = violationStats.window_minutes || enforcement_window_minutes;
    const illegalCount = violationStats.illegal_parking || 0;
    const blockingCount = violationStats.blocking || 0;

    const actions = [];
    let severity = 'low';
    let alert = false;

    // Rule: enforcement alert threshold
    if (count >= enforcement_alert_count) {
      alert = true;
      severity = 'high';
      actions.push(
        `Enforcement alert: ${count} violations in ${window} minutes`
      );
    }

    // Rule: illegal parking → suggest patrol (Priority Level 1 — Safety)
    if (illegalCount >= patrol_suggest_threshold) {
      severity = 'critical';
      alert = true;
      actions.push(
        `Patrol required: ${illegalCount} illegal parking incidents detected`
      );
    }

    // Rule: blocking incidents → immediate attention (Priority Level 1 — Safety)
    if (blockingCount > 0) {
      severity = severity === 'low' ? 'medium' : severity;
      actions.push(
        `Blocking incidents: ${blockingCount} — dispatch officer to clear`
      );
    }

    // Rule: overtime violations → suggest dynamic pricing (Priority Level 3)
    if (violationStats.overtime > 5) {
      actions.push('Consider dynamic pricing to reduce long-term parking');
    }

    return {
      alert,
      severity,
      actions,
      violation_count: count,
      window_minutes: window,
      priority: 1, // Level 1 — Safety
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 4. REROUTE LOGIC (Priority Level 2)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Suggest alternative parking areas when current area is overloaded.
   *
   * @param {Object} currentArea - The overloaded area
   * @param {Object[]} allAreas - All available areas with their stats
   * @returns {{ suggested: boolean, alternatives: Array<{area: string, occupancy: number, distance: string}>, action: string }}
   */
  suggestAlternative(currentArea, allAreas) {
    const { suggest_threshold, max_suggestions } = this.config.reroute;

    const currentOccupancy = currentArea.occupancy_percent || 0;

    // No reroute needed
    if (currentOccupancy < suggest_threshold) {
      return {
        suggested: false,
        alternatives: [],
        action: 'no_reroute_needed',
        message: `Area at ${currentOccupancy}% — no reroute required`,
        priority: 3,
      };
    }

    // Find alternative areas sorted by lowest occupancy
    const alternatives = allAreas
      .filter(
        (a) =>
          a.area !== currentArea.area &&
          a.area !== currentArea.area_id &&
          (a.occupancy_percent || 0) < suggest_threshold
      )
      .sort((a, b) => (a.occupancy_percent || 0) - (b.occupancy_percent || 0))
      .slice(0, max_suggestions)
      .map((a) => ({
        area: a.area || a.area_id || 'unknown',
        occupancy: a.occupancy_percent || 0,
        available_slots: a.available_slots || a.capacity - Math.round((a.occupancy_percent || 0) * a.capacity / 100),
        distance: a.distance || 'nearby',
        recommendation:
          a.occupancy_percent < 50
            ? 'recommended'
            : a.occupancy_percent < 70
            ? 'available'
            : 'limited_space',
      }));

    const action =
      currentOccupancy >= this.config.occupancy.full
        ? 'reroute_immediately'
        : 'suggest_alternative';

    return {
      suggested: alternatives.length > 0,
      alternatives,
      action,
      message:
        alternatives.length > 0
          ? `${currentArea.area || 'Area'} at ${currentOccupancy}% — redirect to: ${alternatives.map((a) => a.area).join(', ')}`
          : `${currentArea.area || 'Area'} at ${currentOccupancy}% — no available alternatives`,
      priority: 2, // Level 2 — Congestion
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 5. AREA BALANCING (Priority Level 3)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Analyze load distribution across all areas and suggest balancing.
   *
   * @param {Object[]} allAreas - All areas with occupancy stats
   * @returns {{ balanced: boolean, imbalance_score: number, suggestions: string[] }}
   */
  evaluateAreaBalance(allAreas) {
    if (allAreas.length < 2) {
      return {
        balanced: true,
        imbalance_score: 0,
        suggestions: [],
        message: 'Insufficient areas for balancing analysis',
      };
    }

    const occupancies = allAreas.map((a) => a.occupancy_percent || 0);
    const avgOccupancy = occupancies.reduce((s, v) => s + v, 0) / occupancies.length;
    const maxOccupancy = Math.max(...occupancies);
    const minOccupancy = Math.min(...occupancies);
    const spread = maxOccupancy - minOccupancy;

    // Imbalance score: 0 = perfectly balanced, 1 = completely imbalanced
    const imbalanceScore = spread / 100;

    const suggestions = [];

    // Rule: large spread indicates imbalance
    if (spread > 40) {
      const overloaded = allAreas.filter(
        (a) => (a.occupancy_percent || 0) > this.config.occupancy.risk_high
      );
      const underloaded = allAreas.filter(
        (a) => (a.occupancy_percent || 0) < this.config.occupancy.underutilized
      );

      overloaded.forEach((o) => {
        underloaded.forEach((u) => {
          suggestions.push(
            `Redirect traffic from ${o.area || o.area_id} (${o.occupancy_percent}%) → ${u.area || u.area_id} (${u.occupancy_percent}%)`
          );
        });
      });
    }

    return {
      balanced: spread <= 30,
      imbalance_score: parseFloat(imbalanceScore.toFixed(4)),
      average_occupancy: parseFloat(avgOccupancy.toFixed(1)),
      spread: parseFloat(spread.toFixed(1)),
      suggestions,
      priority: 3, // Level 3 — Efficiency
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 6. EFFICIENCY SCORE (Composite)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Calculate overall system efficiency using rule-based formula.
   *
   * Formula:
   *   efficiency = (1 - occupancy/100) * 0.3
   *              + (1 - traffic/maxTraffic) * 0.4
   *              + (1 - violations/maxViolation) * 0.3
   *
   * Higher score = better efficiency.
   *
   * @param {Object} metrics
   * @param {number} metrics.occupancy_percent - 0-100
   * @param {number} metrics.traffic_volume - Current traffic
   * @param {number} metrics.max_traffic - Maximum expected traffic
   * @param {number} metrics.violations - Violation count
   * @param {number} [metrics.max_violations] - Maximum expected violations
   * @returns {number} Efficiency score (0-1)
   */
  calculateEfficiency(metrics) {
    const { weight_occupancy, weight_traffic, weight_violations } =
      this.config.efficiency;

    const occupancy = Math.min(metrics.occupancy_percent || 0, 100);
    const traffic = Math.min(
      metrics.traffic_volume || 0,
      metrics.max_traffic || 200
    );
    const maxTraffic = metrics.max_traffic || 200;
    const violations = metrics.violations || 0;
    const maxViolations = metrics.max_violations || 10;

    const occupancyScore = 1 - occupancy / 100;
    const trafficScore = 1 - traffic / maxTraffic;
    const violationScore = 1 - Math.min(violations / maxViolations, 1);

    const efficiency =
      occupancyScore * weight_occupancy +
      trafficScore * weight_traffic +
      violationScore * weight_violations;

    return parseFloat(Math.max(0, Math.min(1, efficiency)).toFixed(4));
  }

  // ────────────────────────────────────────────────────────────────────────
  // 7. FULL AREA EVALUATION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Run all rule evaluations for a single area.
   *
   * @param {Object} areaStats
   * @returns {Object} Complete evaluation result
   */
  evaluateArea(areaStats) {
    const occupancyResult = this.evaluateOccupancy(
      areaStats.occupancy_percent || 0
    );
    const bottleneckResult = this.detectBottleneck(areaStats);
    const violationResult = this.evaluateViolations(
      areaStats.violations || { count: 0 }
    );
    const efficiencyScore = this.calculateEfficiency({
      occupancy_percent: areaStats.occupancy_percent || 0,
      traffic_volume: areaStats.traffic_volume || 0,
      max_traffic: areaStats.capacity || 200,
      violations: (areaStats.violations && areaStats.violations.count) || 0,
      max_violations: 10,
    });

    // Determine overall priority (lowest number = highest priority)
    const priorities = [
      violationResult.priority,
      bottleneckResult.priority,
      occupancyResult.priority,
    ];
    const highestPriority = Math.min(...priorities);

    // Collect all suggestions
    const suggestions = [];
    if (occupancyResult.action) suggestions.push(occupancyResult.message);
    if (bottleneckResult.detected) {
      suggestions.push(`Bottleneck detected: ${bottleneckResult.reasons.join('; ')}`);
    }
    if (violationResult.alert) {
      suggestions.push(...violationResult.actions);
    }

    return {
      area: areaStats.area || areaStats.area_id || 'unknown',
      timestamp: new Date().toISOString(),
      analysis: {
        occupancy_status: occupancyResult.status,
        occupancy_severity: occupancyResult.severity,
        traffic_status: bottleneckResult.level,
        violation_status: violationResult.severity,
      },
      bottlenecks: bottleneckResult.detected
        ? [
            {
              area: bottleneckResult.area,
              level: bottleneckResult.level,
              reasons: bottleneckResult.reasons,
            },
          ]
        : [],
      suggestions,
      efficiency_score: efficiencyScore,
      priority: highestPriority,
    };
  }

  /**
   * Run full evaluation across all parking slots in an area.
   *
   * @param {Object[]} slotStats - Array of individual slot states
   * @returns {Object} Slot-level evaluation
   */
  evaluateParkingSlots(slotStats) {
    if (!slotStats || slotStats.length === 0) {
      return {
        total_slots: 0,
        occupied_slots: 0,
        occupancy_percent: 0,
        status: 'no_data',
        action: null,
      };
    }

    const total = slotStats.length;
    const occupied = slotStats.filter((s) => s.is_occupied).length;
    const percent = Math.round((occupied / total) * 100);

    const occupancyResult = this.evaluateOccupancy(percent);

    return {
      total_slots: total,
      occupied_slots: occupied,
      available_slots: total - occupied,
      occupancy_percent: percent,
      status: occupancyResult.status,
      severity: occupancyResult.severity,
      action: occupancyResult.action,
      vehicle_breakdown: this._countVehicleTypes(slotStats),
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 8. POLICY SIMULATION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Simulate the effect of a policy change on parking system.
   *
   * @param {Object} policyInput
   * @param {string} policyInput.policy_type - Type of policy to test
   * @param {Object} policyInput.current_state - Current system state
   * @param {Object} [policyInput.policy_params] - Policy parameters
   * @returns {Object} Simulated outcome
   */
  simulatePolicy(policyInput) {
    const { policy_type, current_state, policy_params = {} } = policyInput;

    // Simulate occupancy change based on policy
    let simulatedOccupancy = current_state.occupancy_percent || 0;
    let simulatedTraffic = current_state.traffic_volume || 0;
    let simulatedViolations = current_state.violations?.count || 0;
    const actions = [];

    switch (policy_type) {
      case 'dynamic_pricing': {
        // Higher price reduces demand by estimated factor
        const priceIncrease = policy_params.price_increase_percent || 20;
        const demandReduction = priceIncrease * 0.3; // elasticity assumption
        simulatedOccupancy = Math.max(
          0,
          simulatedOccupancy - demandReduction
        );
        simulatedViolations = Math.max(0, simulatedViolations - Math.round(demandReduction * 0.1));
        actions.push(
          `Dynamic pricing (+${priceIncrease}%) → estimated ${demandReduction.toFixed(0)}% demand reduction`
        );
        break;
      }

      case 'time_limit': {
        const maxDuration = policy_params.max_duration_minutes || 120;
        const turnoverBoost = maxDuration < 120 ? 15 : 5;
        simulatedOccupancy = Math.max(0, simulatedOccupancy - turnoverBoost);
        simulatedTraffic = Math.round(simulatedTraffic * 1.1); // more turnover
        actions.push(
          `Time limit (${maxDuration}min) → estimated ${turnoverBoost}% occupancy reduction, higher turnover`
        );
        break;
      }

      case 'reserved_zones': {
        const reservedPercent = policy_params.reserved_percent || 10;
        const effectiveCapacity =
          current_state.capacity * (1 - reservedPercent / 100);
        simulatedOccupancy = Math.min(
          100,
          (simulatedOccupancy / 100) * current_state.capacity / effectiveCapacity * 100
        );
        actions.push(
          `Reserved zones (${reservedPercent}%) → effective capacity ${Math.round(effectiveCapacity)}, occupancy recalculated`
        );
        break;
      }

      case 'enforcement_boost': {
        const patrolIncrease = policy_params.patrol_increase_percent || 50;
        simulatedViolations = Math.max(
          0,
          Math.round(simulatedViolations * (1 - patrolIncrease / 200))
        );
        actions.push(
          `Enforcement boost (+${patrolIncrease}%) → estimated ${Math.round(patrolIncrease / 2)}% violation reduction`
        );
        break;
      }

      case 'reroute_active': {
        const reroutePercent = policy_params.reroute_percent || 15;
        simulatedOccupancy = Math.max(0, simulatedOccupancy - reroutePercent);
        simulatedTraffic = Math.round(simulatedTraffic * 0.85);
        actions.push(
          `Active reroute (${reroutePercent}% redirected) → occupancy and traffic reduced`
        );
        break;
      }

      default:
        actions.push(`Unknown policy type: ${policy_type} — no simulation applied`);
    }

    const efficiencyScore = this.calculateEfficiency({
      occupancy_percent: simulatedOccupancy,
      traffic_volume: simulatedTraffic,
      max_traffic: current_state.capacity || 200,
      violations: simulatedViolations,
      max_violations: 10,
    });

    const occupancyResult = this.evaluateOccupancy(simulatedOccupancy);

    return {
      policy_type,
      policy_params,
      current_state: {
        occupancy_percent: current_state.occupancy_percent,
        traffic_volume: current_state.traffic_volume,
        violations: current_state.violations?.count || 0,
      },
      simulated_state: {
        occupancy_percent: parseFloat(simulatedOccupancy.toFixed(1)),
        traffic_volume: simulatedTraffic,
        violations: simulatedViolations,
        occupancy_status: occupancyResult.status,
      },
      efficiency_score: efficiencyScore,
      efficiency_change: parseFloat(
        (
          efficiencyScore -
          this.calculateEfficiency({
            occupancy_percent: current_state.occupancy_percent || 0,
            traffic_volume: current_state.traffic_volume || 0,
            max_traffic: current_state.capacity || 200,
            violations: current_state.violations?.count || 0,
            max_violations: 10,
          })
        ).toFixed(4)
      ),
      actions,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // 9. MULTI-AREA SIMULATION
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Run full simulation across all areas with cross-area analysis.
   *
   * @param {Object} input
   * @param {Object[]} input.areas - All area stats
   * @param {Object[]} [input.slots] - Optional slot-level data
   * @returns {Object} Complete simulation output
   */
  runSimulation(input) {
    const areas = input.areas || [];
    const results = areas.map((area) => this.evaluateArea(area));

    // Cross-area analysis
    const balanceResult = this.evaluateAreaBalance(areas);

    // Collect reroute suggestions for overloaded areas
    const rerouteSuggestions = [];
    for (const area of areas) {
      if ((area.occupancy_percent || 0) >= this.config.reroute.suggest_threshold) {
        const suggestion = this.suggestAlternative(area, areas);
        if (suggestion.suggested) {
          rerouteSuggestions.push(suggestion);
        }
      }
    }

    // Collect all bottlenecks
    const allBottlenecks = results
      .filter((r) => r.bottlenecks.length > 0)
      .flatMap((r) => r.bottlenecks);

    // Overall efficiency (average across areas)
    const overallEfficiency =
      results.length > 0
        ? parseFloat(
            (
              results.reduce((sum, r) => sum + r.efficiency_score, 0) /
              results.length
            ).toFixed(4)
          )
        : 0;

    // Determine system-wide status
    const criticalAreas = results.filter(
      (r) => r.analysis.occupancy_status === 'full'
    );
    const highRiskAreas = results.filter(
      (r) => r.analysis.occupancy_status === 'high'
    );

    let systemStatus = 'healthy';
    if (criticalAreas.length > 0) systemStatus = 'critical';
    else if (highRiskAreas.length > areas.length * 0.5)
      systemStatus = 'warning';
    else if (balanceResult.imbalance_score > 0.4) systemStatus = 'imbalanced';

    return {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      areas_analyzed: areas.length,
      summary: {
        total_areas: areas.length,
        critical_count: criticalAreas.length,
        high_risk_count: highRiskAreas.length,
        balanced: balanceResult.balanced,
        imbalance_score: balanceResult.imbalance_score,
      },
      area_results: results,
      bottlenecks: allBottlenecks,
      reroute_suggestions: rerouteSuggestions,
      balance: {
        balanced: balanceResult.balanced,
        imbalance_score: balanceResult.imbalance_score,
        suggestions: balanceResult.suggestions,
      },
      efficiency_score: overallEfficiency,
      system_flags: this._generateSystemFlags(results, balanceResult),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Count vehicle types from slot data */
  _countVehicleTypes(slots) {
    const breakdown = { car: 0, motorcycle: 0, truck: 0, other: 0 };
    slots.forEach((s) => {
      if (!s.is_occupied) return;
      const type = (s.vehicle_type || 'other').toLowerCase();
      if (type in breakdown) breakdown[type]++;
      else breakdown.other++;
    });
    return breakdown;
  }

  /** Generate system-wide policy flags */
  _generateSystemFlags(areaResults, balanceResult) {
    const flags = [];

    // Check for full areas
    const fullAreas = areaResults.filter(
      (r) => r.analysis.occupancy_status === 'full'
    );
    if (fullAreas.length > 0) {
      flags.push({
        type: 'overflow',
        severity: 'critical',
        message: `${fullAreas.length} area(s) at full capacity — activate overflow protocol`,
      });
    }

    // Check for imbalance
    if (!balanceResult.balanced) {
      flags.push({
        type: 'imbalance',
        severity: 'warning',
        message: `Load imbalance detected (score: ${balanceResult.imbalance_score})`,
      });
    }

    // Check for violation spikes
    const highViolationAreas = areaResults.filter(
      (r) => r.analysis.violation_status === 'critical'
    );
    if (highViolationAreas.length > 0) {
      flags.push({
        type: 'enforcement',
        severity: 'critical',
        message: `${highViolationAreas.length} area(s) require immediate enforcement`,
      });
    }

    return flags;
  }
}

// ── Singleton instance ───────────────────────────────────────────────────────

export const ruleEngine = new RuleEngine();
export { RuleEngine, DEFAULT_CONFIG };
