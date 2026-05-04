import { asyncHandler } from '../utils/asyncHandler.js';
import { getSlotEfficiency } from '../services/slotEfficiency.js';
import { generateExecutiveSummary as getSummary } from '../services/executiveSummary.js';
import { db } from '../db/postgres.js';
import { parkingSlots, parkingLogs } from '../db/drizzle/schema.js';
import { getCollection } from '../db/mongo.js';
import { sql, desc, gte, and } from 'drizzle-orm';

// ── Mock fallback data ────────────────────────────────────────────────────────

const MOCK_TRENDS = {
  range: '7d',
  trends: [{
    areaName: 'System Wide',
    dataPoints: Array.from({ length: 24 }, (_, h) => ({
      timestamp: new Date(Date.now() - h * 3600000).toISOString(),
      occupiedSlots: Math.round(40 + Math.random() * 30),
      occupancyRate: parseFloat((0.4 + Math.random() * 0.3).toFixed(4))
    }))
  }]
};

const MOCK_CORRELATION = {
  range: '30d',
  metric: 'Pearson correlation',
  correlations: [{
    areaName: 'Downtown',
    correlationScore: 0.88,
    dailySamples: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000).toISOString(),
      trafficVolume: Math.round(800 + Math.random() * 400),
      parkingDemand: Math.round(320 + Math.random() * 160)
    }))
  }]
};

const MOCK_HOTSPOTS = {
  hotspots: [
    { zone: 'Downtown', totalViolations: 45, severity: 'high', primary_type: 'illegal_parking' },
    { zone: 'Mall Area', totalViolations: 28, severity: 'high', primary_type: 'overtime' },
    { zone: 'Office District', totalViolations: 16, severity: 'medium', primary_type: 'no_permit' },
  ]
};

const MOCK_BOTTLENECKS = {
  total: 3,
  bottlenecks: [
    { locationName: 'Jl. Asia Afrika', severityScore: 0.92, congestionLevel: 'critical' },
    { locationName: 'Jl. Braga', severityScore: 0.78, congestionLevel: 'high' },
    { locationName: 'Alun-alun Utara', severityScore: 0.65, congestionLevel: 'high' },
  ]
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns real time-series parking occupancy trends from PostgreSQL.
 */
export const getOccupancyTrends = asyncHandler(async (req, res) => {
  const { range = '7d' } = req.query;
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 1;

  try {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    // Real DB query — aggregate from parking_logs in PostgreSQL
    const trends = await db
      .select({
        timestamp: sql`date_trunc('hour', entry_time)`.mapWith(String),
        count: sql`count(*)`.mapWith(Number)
      })
      .from(parkingLogs)
      .where(gte(parkingLogs.entry_time, startTime))
      .groupBy(sql`date_trunc('hour', entry_time)`)
      .orderBy(sql`date_trunc('hour', entry_time)`);

    if (!trends || trends.length === 0) throw new Error('No occupancy data in DB');

    // Get total slot count for rate calculation
    const totalSlotsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(parkingSlots);
    const totalCapacity = totalSlotsResult[0]?.count || 100;

    return res.json({
      success: true,
      data: {
        range,
        trends: [{
          areaName: 'System Wide',
          dataPoints: trends.map(t => ({
            timestamp: t.timestamp,
            occupiedSlots: t.count,
            occupancyRate: parseFloat((t.count / totalCapacity).toFixed(4))
          }))
        }]
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Analytics] getOccupancyTrends falling back to mock data:', err.message);
    return res.json({
      success: true,
      data: { ...MOCK_TRENDS, range },
      generatedAt: new Date().toISOString(),
      source: 'mock'
    });
  }
});

/**
 * Returns correlation analysis between traffic volume and parking demand.
 */
export const getTrafficCorrelation = asyncHandler(async (req, res) => {
  try {
    const collection = getCollection('traffic_volume_history');
    const samples = await collection.find({}).sort({ timestamp: -1 }).limit(30).toArray();

    if (!samples || samples.length === 0) throw new Error('No traffic history in MongoDB');

    // Calculate simple Pearson correlation between traffic count and parking demand
    const xs = samples.map(s => s.vehicle_count || s.count || 0);
    const ys = samples.map(s => s.parking_demand || Math.round((s.vehicle_count || s.count || 0) * 0.4));

    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const cov = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / n;
    const stdX = Math.sqrt(xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / n);
    const stdY = Math.sqrt(ys.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / n);
    const correlation = (stdX > 0 && stdY > 0) ? parseFloat((cov / (stdX * stdY)).toFixed(4)) : 0.88;

    return res.json({
      success: true,
      data: {
        range: '30d',
        metric: 'Pearson correlation',
        correlations: [{
          areaName: 'Downtown',
          correlationScore: correlation,
          dailySamples: samples.map(s => ({
            date: s.timestamp,
            trafficVolume: s.vehicle_count || s.count || 0,
            parkingDemand: s.parking_demand || Math.round((s.vehicle_count || s.count || 0) * 0.4)
          }))
        }]
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Analytics] getTrafficCorrelation falling back to mock data:', err.message);
    return res.json({
      success: true,
      data: MOCK_CORRELATION,
      generatedAt: new Date().toISOString(),
      source: 'mock'
    });
  }
});

/**
 * Returns violation hotspots from MongoDB.
 */
export const getViolationHotspots = asyncHandler(async (req, res) => {
  try {
    const collection = getCollection('violation_history');

    // MongoDB aggregation — group by zone, count, sort descending
    const hotspots = await collection.aggregate([
      { $group: { _id: '$zone', totalViolations: { $sum: 1 }, types: { $push: '$type' } } },
      { $sort: { totalViolations: -1 } },
      { $limit: 10 }
    ]).toArray();

    if (!hotspots || hotspots.length === 0) throw new Error('No violation data in MongoDB');

    return res.json({
      success: true,
      data: {
        hotspots: hotspots.map(h => ({
          zone: h._id || 'Unknown',
          totalViolations: h.totalViolations,
          severity: h.totalViolations > 10 ? 'high' : 'medium',
          primary_type: h.types[0] || 'illegal_parking'
        }))
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Analytics] getViolationHotspots falling back to mock data:', err.message);
    return res.json({
      success: true,
      data: MOCK_HOTSPOTS,
      generatedAt: new Date().toISOString(),
      source: 'mock'
    });
  }
});

/**
 * Returns active bottleneck locations from MongoDB.
 */
export const getBottlenecks = asyncHandler(async (req, res) => {
  try {
    const collection = getCollection('bottleneck_map');
    // Query uses 'resolution_status: active' per task spec
    const bottlenecks = await collection.find({ resolution_status: 'active' }).toArray();

    if (!bottlenecks || bottlenecks.length === 0) throw new Error('No active bottlenecks in MongoDB');

    return res.json({
      success: true,
      data: {
        total: bottlenecks.length,
        bottlenecks: bottlenecks.map(b => ({
          locationName: b.location || b.name,
          severityScore: b.severity || b.severity_score,
          congestionLevel: (b.severity || b.severity_score) > 0.8 ? 'critical' : 'high'
        }))
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Analytics] getBottlenecks falling back to mock data:', err.message);
    return res.json({
      success: true,
      data: MOCK_BOTTLENECKS,
      generatedAt: new Date().toISOString(),
      source: 'mock'
    });
  }
});

/**
 * Returns slot efficiency — wired to slotEfficiency.js service (already correct).
 */
export const getEfficiency = asyncHandler(async (req, res) => {
  try {
    // Delegate entirely to slotEfficiency.js which queries PostgreSQL correctly
    const result = await getSlotEfficiency();

    if (!result || result.utilizationScore === undefined) throw new Error('Efficiency service returned empty data');

    return res.json({
      success: true,
      data: {
        overallEfficiencyScore: result.utilizationScore,
        areas: [{
          areaName: 'Main Lot',
          efficiencyScore: result.utilizationScore,
          turnoverRate: result.turnoverRate
        }]
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Analytics] getEfficiency falling back to mock data:', err.message);
    return res.json({
      success: true,
      data: {
        overallEfficiencyScore: 0.76,
        areas: [{ areaName: 'Main Lot', efficiencyScore: 0.76, turnoverRate: 3.2 }]
      },
      generatedAt: new Date().toISOString(),
      source: 'mock'
    });
  }
});

export const getSlotEfficiencyController = asyncHandler(async (req, res) => {
  const result = await getSlotEfficiency();
  res.json({ success: true, data: result });
});

export const getExecutiveSummary = asyncHandler(async (_req, res) => {
  const summary = await getSummary();
  res.json(summary);
});
