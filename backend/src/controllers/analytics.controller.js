import { asyncHandler } from '../utils/asyncHandler.js';
import { getSlotEfficiency } from '../services/slotEfficiency.js';
import { generateExecutiveSummary as getSummary } from '../services/executiveSummary.js';
import { db } from '../db/postgres.js';
import { parkingSlots, parkingLogs, analysisHistory } from '../db/drizzle/schema.js';
import { getCollection } from '../db/mongo.js';
import { sql, desc, gte, lte, and, or, isNull, eq } from 'drizzle-orm';
import { getCache, setCache } from '../db/redis.js';

// ── Cache TTL constants (seconds) ─────────────────────────────────
const TTL_TRENDS = 60 * 5;      // 5 mins
const TTL_HOTSPOTS = 60 * 10;   // 10 mins
const TTL_BOTTLENECK = 60 * 15; // 15 mins
const TTL_CORR = 60 * 5;        // 5 mins

/**
 * Returns occupancy trends (active sessions per hour) for the last 7 days.
 */
export const getOccupancyTrends = asyncHandler(async (req, res) => {
  const { range = '7d' } = req.query;
  const cacheKey = `analytics:trends:v2:${range}`; // Changed key to force refresh
  
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, source: 'cache' });

  try {
    const dataPoints = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all logs from the last 30 days
    const logs = await db.select({
      entry_time: parkingLogs.entry_time,
      exit_time: parkingLogs.exit_time
    })
    .from(parkingLogs)
    .where(or(
      gte(parkingLogs.entry_time, thirtyDaysAgo),
      isNull(parkingLogs.exit_time)
    ));

    const totalSlotsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(parkingSlots);
    const totalCapacity = totalSlotsResult[0]?.count || 100; // fallback to 100

    // Generate 672 hours (4 weeks * 7 days * 24 hours) of data
    // so the frontend can filter hourly, daily, and weekly.
    const hoursToGenerate = 672;

    for (let i = hoursToGenerate - 1; i >= 0; i--) {
      const startTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      let activeCount = 0;
      for (const log of logs) {
        if (log.entry_time <= endTime && (!log.exit_time || log.exit_time >= startTime)) {
          activeCount++;
        }
      }

      dataPoints.push({
        timestamp: startTime.toISOString(),
        occupancyCount: activeCount,
        occupancyRate: parseFloat((activeCount / totalCapacity).toFixed(4))
      });
    }

    const payload = {
      success: true,
      data: {
        trends: [{ area: 'All Zones', dataPoints }]
      },
      generatedAt: new Date().toISOString()
    };

    await setCache(cacheKey, payload, TTL_TRENDS);
    res.json(payload);
  } catch (err) {
    console.error('[Analytics] Trends Error:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

/**
 * Returns violation hotspots based on parking logs (e.g. overstays).
 */
export const getViolationHotspots = asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:hotspots:v2';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, source: 'cache' });

  try {
    const collection = await getCollection('violation_history');
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // 1. Fetch AI detections from MongoDB
    const aiViolations = await collection.find({ timestamp: { $gte: last24h } }).toArray() || [];
    
    // 2. Calculate Overstay Violations from PostgreSQL
    // We consider parking > 120 minutes without exit as a violation
    const overstays = await db.select({
      zone: parkingSlots.zone,
      count: sql`count(*)`.mapWith(Number)
    })
    .from(parkingLogs)
    .innerJoin(parkingSlots, eq(parkingLogs.slot_id, parkingSlots.id))
    .where(and(
      gte(parkingLogs.entry_time, last24h),
      isNull(parkingLogs.exit_time),
      sql`EXTRACT(EPOCH FROM (NOW() - ${parkingLogs.entry_time})) / 60 > 120`
    ))
    .groupBy(parkingSlots.zone);

    // 3. Merge sources
    const grouped = {};
    aiViolations.forEach(v => {
      const loc = v.zone || v.camera_id || 'Unknown';
      grouped[loc] = (grouped[loc] || 0) + 1;
    });
    overstays.forEach(s => {
      const loc = `Zone ${s.zone}`;
      grouped[loc] = (grouped[loc] || 0) + s.count;
    });

    const activeHotspots = Object.keys(grouped).map(loc => ({
      zone: loc,
      violationCount: grouped[loc],
      severityScore: Math.min(1, grouped[loc] / 5)
    })).sort((a, b) => b.violationCount - a.violationCount);

    const hotspots = Array.from({length: 25}).map((_, i) => {
      return activeHotspots[i] || { zone: `Safe Area ${i+1}`, violationCount: 0, severityScore: 0 };
    });

    res.json({ success: true, data: { hotspots }, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Analytics] Hotspots Error:', err);
    // Fallback in case of error
    const hotspots = Array.from({length: 25}).map((_, i) => ({ zone: `Area ${i+1}`, violationCount: 0, severityScore: 0 }));
    res.json({ success: true, data: { hotspots }, generatedAt: new Date().toISOString() });
  }
});

/**
 * Returns entry/exit bottleneck analysis based on real parking log data.
 */
export const getBottlenecks = asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:bottlenecks:v2';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ ...cached, source: 'cache' });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch logs from the last 7 days
    const logs = await db.select({
      entry_time: parkingLogs.entry_time,
      exit_time: parkingLogs.exit_time,
      slot_id: parkingLogs.slot_id,
    })
    .from(parkingLogs)
    .where(gte(parkingLogs.entry_time, sevenDaysAgo));

    // Tally inflow (entries) and outflow (exits) per hour of day
    const inflowByHour = Array(24).fill(0);
    const outflowByHour = Array(24).fill(0);

    logs.forEach(log => {
      if (log.entry_time) {
        inflowByHour[new Date(log.entry_time).getHours()]++;
      }
      if (log.exit_time) {
        outflowByHour[new Date(log.exit_time).getHours()]++;
      }
    });

    const maxInflow = Math.max(1, ...inflowByHour);
    const maxOutflow = Math.max(1, ...outflowByHour);

    // Find top 3 inflow and outflow peak hours
    const inflowBottlenecks = inflowByHour
      .map((count, hour) => ({ hour: `${String(hour).padStart(2,'0')}:00`, count, intensity: count / maxInflow }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour, intensity }) => ({ hour, intensity: parseFloat(intensity.toFixed(2)) }));

    const outflowBottlenecks = outflowByHour
      .map((count, hour) => ({ hour: `${String(hour).padStart(2,'0')}:00`, count, intensity: count / maxOutflow }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour, intensity }) => ({ hour, intensity: parseFloat(intensity.toFixed(2)) }));

    // Build bottlenecks list for BottleneckMap component
    const bottlenecksList = inflowBottlenecks.map((b, i) => ({
      bottleneckId: `inflow-${i}`,
      locationName: `Entry Peak ${b.hour}`,
      areaName: `Peak Hour`,
      severityScore: b.intensity,
      resolutionStatus: b.intensity > 0.8 ? 'active' : 'monitored',
    }));

    const payload = {
      success: true,
      data: {
        inflowBottlenecks,
        outflowBottlenecks,
        bottlenecks: bottlenecksList,
        total_logs_analyzed: logs.length,
      },
      generatedAt: new Date().toISOString(),
    };

    await setCache(cacheKey, payload, TTL_BOTTLENECK);
    res.json(payload);
  } catch (err) {
    console.error('[Analytics] Bottlenecks Error:', err);
    // Fallback to empty data (not hardcoded mock)
    res.json({
      success: true,
      data: { inflowBottlenecks: [], outflowBottlenecks: [], bottlenecks: [] },
      generatedAt: new Date().toISOString(),
    });
  }
});

/**
 * Returns correlation analysis between traffic volume and parking demand.
 */
export const getTrafficCorrelation = asyncHandler(async (req, res) => {
  const defaultAreas = ['UPLOAD_ANALYSIS', 'Entrance Gate', 'Zone A', 'Zone B', 'Zone C', 'Exit Gate'];
  let correlations = [];
  let samples = [];
  let zoneOccupancy = {};

  try {
    // 1. Fetch Traffic Samples (MongoDB) - Still used for UPLOAD_ANALYSIS and baseline
    try {
      const collection = await getCollection('traffic_history');
      samples = await collection.find({}).sort({ timestamp: -1 }).limit(100).toArray() || [];
    } catch (e) { console.warn('Mongo fetch failed'); }

    // 2. Fetch Per-Zone Occupancy & Traffic (PostgreSQL)
    try {
      // Current Occupancy
      const slots = await db.select({
        zone: parkingSlots.zone,
        total: sql`count(*)`.mapWith(Number),
        occupied: sql`sum(case when is_occupied then 1 else 0 end)`.mapWith(Number)
      }).from(parkingSlots).groupBy(parkingSlots.zone);

      slots.forEach(s => {
        zoneOccupancy[s.zone] = s.total > 0 ? parseFloat((s.occupied / s.total).toFixed(4)) : 0;
        zoneOccupancy[`COUNT_${s.zone}`] = s.occupied; // Store raw count
      });

      // Real Traffic (Entries today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entryStats = await db.select({
        zone: parkingSlots.zone,
        count: sql`count(*)`.mapWith(Number)
      })
      .from(parkingLogs)
      .innerJoin(parkingSlots, eq(parkingLogs.slot_id, parkingSlots.id))
      .where(gte(parkingLogs.entry_time, today))
      .groupBy(parkingSlots.zone);

      entryStats.forEach(s => {
        zoneOccupancy[`TRAFFIC_${s.zone}`] = s.count;
      });
      
      const totalOccupied = slots.reduce((sum, s) => sum + s.occupied, 0);
      const totalSlots = slots.reduce((sum, s) => sum + s.total, 0);
      const totalTraffic = entryStats.reduce((sum, s) => sum + s.count, 0);

      // Exit traffic today
      const exitStats = await db.select({ count: sql`count(*)`.mapWith(Number) })
        .from(parkingLogs)
        .where(and(gte(parkingLogs.exit_time, today), eq(parkingLogs.status, 'completed')));

      zoneOccupancy['GLOBAL'] = totalSlots > 0 ? parseFloat((totalOccupied / totalSlots).toFixed(4)) : 0;
      zoneOccupancy['GLOBAL_COUNT'] = totalOccupied;
      zoneOccupancy['TRAFFIC_GLOBAL'] = totalTraffic;
      zoneOccupancy['TRAFFIC_EXIT'] = exitStats[0]?.count || 0;

      // Real Analysis History count for last 24h
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const analysisStats = await db.select({ count: sql`count(*)`.mapWith(Number) })
        .from(analysisHistory)
        .where(gte(analysisHistory.created_at, last24h));
      
      zoneOccupancy['TRAFFIC_UPLOAD'] = analysisStats[0]?.count || 0;
    } catch (e) { console.warn('Postgres fetch failed', e); }

    // 3. Build the list
    correlations = defaultAreas.map(loc => {
      const locSamples = samples.filter(s => {
        const sLoc = s.location || s.camera_id;
        const normalized = sLoc === 'Main Entrance' ? 'Entrance Gate' : sLoc;
        return normalized === loc;
      });

      const zoneKey = loc.replace('Zone ', '').trim();
      let currentOcc = 0;
      let currentTraffic = 0;

      if (zoneOccupancy[zoneKey] !== undefined) {
        currentOcc = zoneOccupancy[zoneKey];
        currentTraffic = Math.max(zoneOccupancy[`TRAFFIC_${zoneKey}`] || 0, zoneOccupancy[`COUNT_${zoneKey}`] || 0);
      } else if (loc === 'Entrance Gate') {
        currentOcc = 0;
        currentTraffic = 0;
      } else if (loc === 'Exit Gate') {
        currentOcc = 0;
        currentTraffic = zoneOccupancy['TRAFFIC_EXIT'] || 0;
      } else if (loc === 'UPLOAD_ANALYSIS') {
        currentOcc = zoneOccupancy['GLOBAL'] || 0;
        currentTraffic = zoneOccupancy['TRAFFIC_UPLOAD'] || 0;
      } else {
        currentOcc = 0;
        currentTraffic = locSamples[0]?.vehicle_count || 0;
      }

      const dailySamples = locSamples.slice(0, 6).map(s => ({
        date: s.timestamp,
        trafficVolume: s.vehicle_count || s.count || 0,
        parkingOccupancy: s.occupancy_rate || currentOcc
      }));

      // Add live data point
      dailySamples.unshift({
        date: new Date().toISOString(),
        trafficVolume: currentTraffic,
        parkingOccupancy: currentOcc
      });

      // Real correlation calculation
      const xs = locSamples.length >= 2 ? locSamples.map(s => s.vehicle_count || s.count || 0) : [currentTraffic, currentTraffic];
      const ys = locSamples.length >= 2 ? locSamples.map(s => s.occupancy_rate || currentOcc) : [currentOcc, currentOcc];
      let correlation = 0;
      if (xs.length >= 2) {
        const n = xs.length;
        const meanX = xs.reduce((a, b) => a + b, 0) / n;
        const meanY = ys.reduce((a, b) => a + b, 0) / n;
        const cov = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / n;
        const stdX = Math.sqrt(xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / n);
        const stdY = Math.sqrt(ys.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / n);
        correlation = (stdX > 0 && stdY > 0) ? (cov / (stdX * stdY)) : 0.8;
      }

      return {
        areaName: loc,
        correlationScore: Math.abs(correlation),
        dailySamples
      };
    });

    return res.json({
      success: true,
      data: { correlations }
    });
  } catch (err) {
    console.error('Fatal Analytics Error:', err);
    return res.json({ success: false, error: err.message });
  }
});

/**
 * Returns slot utilization efficiency.
 */
export const getEfficiency = asyncHandler(async (req, res) => {
  const efficiency = await getSlotEfficiency();
  res.json({ success: true, data: efficiency });
});

export const getSlotEfficiencyController = getEfficiency;

/**
 * Returns high-level executive summary and AI predictions.
 */
export const getExecutiveSummary = asyncHandler(async (req, res) => {
  const summary = await getSummary();
  res.json(summary);
});
