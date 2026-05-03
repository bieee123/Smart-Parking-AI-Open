/**
 * Slot Efficiency Service — rule-based calculations using live PostgreSQL data.
 *
 * All functions query `parking_slots` + `parking_logs` from Drizzle schema.
 * No ML required — pure statistics ready to be replaced by a model later.
 */

import { eq, sql, count, avg, sum } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { parkingSlots, parkingLogs } from '../db/drizzle/schema.js';

// ── Cache layer (in-memory, TTL-style) ───────────────────────────────────────

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5_000; // 5 seconds

function getCached() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  return null;
}

function setCached(data) {
  _cache = data;
  _cacheAt = Date.now();
}

// ── 1. Occupancy Percentage ──────────────────────────────────────────────────

/**
 * occupiedSlots / totalSlots * 100
 */
export async function getOccupancyPercentage() {
  const [totalResult, occupiedResult] = await Promise.all([
    db.select({ count: count() }).from(parkingSlots),
    db.select({ count: count() }).from(parkingSlots).where(eq(parkingSlots.is_occupied, true)),
  ]);

  const total = totalResult[0]?.count || 0;
  const occupied = occupiedResult[0]?.count || 0;
  const percentage = total > 0 ? parseFloat(((occupied / total) * 100).toFixed(1)) : 0;

  return { total, occupied, percentage };
}

// ── 2. Available Slots ───────────────────────────────────────────────────────

/**
 * totalSlots - occupiedSlots
 */
export async function getAvailableSlots() {
  const { total, occupied } = await getOccupancyPercentage();
  return { total, available: total - occupied };
}

// ── 3. Average Duration ──────────────────────────────────────────────────────

/**
 * For completed logs: uses stored duration_minutes.
 * For active logs: uses NOW() - entry_time.
 * Returns overall average + per-slot breakdown.
 */
export async function getAverageDuration() {
  // Completed sessions with known duration
  const completedResult = await db
    .select({
      avgDuration: avg(parkingLogs.duration_minutes),
      totalSessions: count(),
    })
    .from(parkingLogs)
    .where(eq(parkingLogs.status, 'completed'));

  const avgCompleted = parseFloat(completedResult[0]?.avgDuration) || 0;
  const completedCount = completedResult[0]?.totalSessions || 0;

  // Active sessions — compute elapsed time
  const activeResult = await db
    .select({
      id: parkingLogs.id,
      slot_id: parkingLogs.slot_id,
      entry_time: parkingLogs.entry_time,
    })
    .from(parkingLogs)
    .where(eq(parkingLogs.status, 'active'));

  const now = Date.now();
  const activeDurations = activeResult.map((log) => {
    const elapsed = Math.round((now - log.entry_time.getTime()) / 60000);
    return { slot_id: log.slot_id, duration: elapsed };
  });

  const avgActive =
    activeDurations.length > 0
      ? parseFloat((activeDurations.reduce((s, a) => s + a.duration, 0) / activeDurations.length).toFixed(1))
      : 0;

  // Combined average (weighted)
  const totalSessions = completedCount + activeDurations.length;
  const combinedAvg =
    totalSessions > 0
      ? parseFloat(((avgCompleted * completedCount + avgActive * activeDurations.length) / totalSessions).toFixed(1))
      : 0;

  // Per-slot breakdown
  const perSlot = {};
  activeDurations.forEach((a) => {
    const key = a.slot_id || 'unknown';
    if (!perSlot[key]) perSlot[key] = [];
    perSlot[key].push(a.duration);
  });

  const perSlotAvg = Object.fromEntries(
    Object.entries(perSlot).map(([slotId, durations]) => [
      slotId,
      {
        activeMinutes: durations.reduce((s, d) => s + d, 0),
        sessionCount: durations.length,
      },
    ])
  );

  return {
    averageMinutes: combinedAvg,
    completedAvgMinutes: parseFloat(avgCompleted.toFixed(1)),
    activeAvgMinutes: avgActive,
    activeSessionCount: activeDurations.length,
    completedSessionCount: completedCount,
    perSlot: perSlotAvg,
  };
}

// ── 4. Turnover Rate ─────────────────────────────────────────────────────────

/**
 * Per slot: completed_sessions / unique days with activity.
 * Global: total_completed_sessions / total_slots.
 */
export async function getTurnoverRate() {
  // Total completed sessions
  const [totalCompleted] = await db
    .select({ count: count() })
    .from(parkingLogs)
    .where(eq(parkingLogs.status, 'completed'));

  // Total slots
  const [totalSlotsResult] = await db.select({ count: count() }).from(parkingSlots);
  const totalSlots = totalSlotsResult?.count || 0;

  // Unique days with activity (from completed logs)
  const daysResult = await db
    .select({
      uniqueDays: sql`COUNT(DISTINCT DATE(${parkingLogs.exit_time}))`,
    })
    .from(parkingLogs)
    .where(eq(parkingLogs.status, 'completed'));

  const uniqueDays = parseInt(daysResult[0]?.uniqueDays) || 1; // avoid div by zero
  const completedCount = totalCompleted?.count || 0;

  // Global turnover: sessions per slot per day
  const globalRate = totalSlots > 0 ? parseFloat((completedCount / (totalSlots * uniqueDays)).toFixed(2)) : 0;

  // Per-slot turnover
  const perSlotResult = await db
    .select({
      slot_id: parkingLogs.slot_id,
      sessions: count(),
    })
    .from(parkingLogs)
    .where(eq(parkingLogs.status, 'completed'))
    .groupBy(parkingLogs.slot_id);

  const perSlot = perSlotResult.reduce((map, row) => {
    map[row.slot_id] = {
      sessions: row.sessions,
      perDay: parseFloat((row.sessions / uniqueDays).toFixed(2)),
    };
    return map;
  }, {});

  return {
    globalRate,
    totalCompletedSessions: completedCount,
    totalSlots,
    uniqueActiveDays: uniqueDays,
    perSlot,
  };
}

// ── 5. Utilization Score (Rule-Based) ────────────────────────────────────────

/**
 * > 85% → High Usage    (0.85-1.0)
 * 60-85% → Optimal       (0.60-0.85)
 * 40-59% → Moderate      (0.40-0.59)
 * < 40% → Underused      (0.00-0.39)
 */
export function classifyUtilization(percentage) {
  if (percentage >= 85) return { label: 'High Usage', value: parseFloat((percentage / 100).toFixed(2)) };
  if (percentage >= 60) return { label: 'Optimal', value: parseFloat((percentage / 100).toFixed(2)) };
  if (percentage >= 40) return { label: 'Moderate', value: parseFloat((percentage / 100).toFixed(2)) };
  return { label: 'Underused', value: parseFloat((percentage / 100).toFixed(2)) };
}

// ── 6. Master Function (All-in-one, cached) ──────────────────────────────────

/**
 * Single call returns all efficiency metrics.
 * Results cached for CACHE_TTL ms to avoid DB thrashing.
 */
export async function getSlotEfficiency() {
  const cached = getCached();
  if (cached) return cached;

  const [occupancy, available, duration, turnover] = await Promise.all([
    getOccupancyPercentage(),
    getAvailableSlots(),
    getAverageDuration(),
    getTurnoverRate(),
  ]);

  const utilizationScore = classifyUtilization(occupancy.percentage);

  const result = {
    occupancyPercentage: occupancy.percentage,
    availableSlots: available.available,
    totalSlots: occupancy.total,
    occupiedSlots: occupancy.occupied,
    averageDurationMinutes: duration.averageMinutes,
    turnoverRate: turnover.globalRate,
    utilizationScore,
    details: {
      completedSessions: turnover.totalCompletedSessions,
      activeSessions: duration.activeSessionCount,
      uniqueActiveDays: turnover.uniqueActiveDays,
      completedAvgMinutes: duration.completedAvgMinutes,
      activeAvgMinutes: duration.activeAvgMinutes,
      turnoverPerSlot: turnover.perSlot,
    },
    timestamp: new Date().toISOString(),
  };

  setCached(result);
  return result;
}
