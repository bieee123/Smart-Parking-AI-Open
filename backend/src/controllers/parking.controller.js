import { eq, and, or, desc, like, count, sql } from 'drizzle-orm';
import { db } from '../db/postgres.js';
import { parkingSlots, parkingLogs } from '../db/drizzle/schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCache, setCache, deleteCache, deleteCacheByPattern } from '../db/redis.js';
import { getCollection } from '../db/mongo.js';

// ── Cache TTLs ──────────────────────────────────────────────
const CACHE_SLOTS = 3; // seconds
const CACHE_CAMERA = 3;
const CACHE_LOGS = 10;

// ── GET /api/parking/slots?zone=A&vehicle=car&search=A1
export const getAllSlots = asyncHandler(async (req, res) => {
  const { zone, vehicle, search } = req.query;

  // Build cache key from query params
  const cacheKey = `slots:${zone || 'all'}:${vehicle || 'all'}:${search || ''}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  // Build where conditions dynamically
  const conditions = [];
  if (zone && zone !== 'all') conditions.push(eq(parkingSlots.zone, zone.toUpperCase()));
  if (vehicle) conditions.push(eq(parkingSlots.vehicle_type, vehicle.toLowerCase()));
  if (search) {
    // Search by slot_number or license_plate
    conditions.push(
      or(
        like(parkingSlots.slot_number, `%${search}%`),
        like(parkingSlots.license_plate, `%${search}%`)
      )
    );
  }

  const query = db.select().from(parkingSlots);
  if (conditions.length > 0) {
    query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }
  query.orderBy(parkingSlots.zone, parkingSlots.floor, parkingSlots.slot_number);

  const slots = await query;

  // Map status field: is_occupied → status for frontend convenience
  const mappedSlots = slots.map((slot) => ({
    ...slot,
    status: deriveStatus(slot),
  }));

  await setCache(cacheKey, mappedSlots, CACHE_SLOTS);

  res.json({ success: true, data: mappedSlots });
});

// ── GET /api/parking/slots/:id
export const getSlotById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cacheKey = `slot:${id}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const [slot] = await db.select().from(parkingSlots).where(eq(parkingSlots.id, id)).limit(1);

  if (!slot) {
    return res.status(404).json({ error: 'Parking slot not found' });
  }

  const enriched = {
    ...slot,
    status: deriveStatus(slot),
  };

  await setCache(cacheKey, enriched, CACHE_SLOTS);

  res.json({ success: true, data: enriched });
});

// ── PUT /api/parking/slots/:id
export const updateSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, is_occupied, vehicle_type, license_plate, camera_id } = req.body;

  // Determine is_occupied from status or direct field
  let newOccupied = is_occupied;
  if (status !== undefined) {
    newOccupied = status === 'occupied';
  }

  const updateData = {
    updated_at: new Date(),
  };
  if (newOccupied !== undefined) updateData.is_occupied = newOccupied;
  if (vehicle_type !== undefined) updateData.vehicle_type = vehicle_type || null;
  if (license_plate !== undefined) updateData.license_plate = license_plate || null;
  if (camera_id !== undefined) updateData.camera_id = camera_id || null;

  // If setting to not occupied, clear vehicle data
  if (newOccupied === false) {
    updateData.vehicle_type = null;
    updateData.license_plate = null;
  }

  const [updatedSlot] = await db
    .update(parkingSlots)
    .set(updateData)
    .where(eq(parkingSlots.id, id))
    .returning();

  if (!updatedSlot) {
    return res.status(404).json({ error: 'Parking slot not found' });
  }

  // Invalidate cache
  await deleteCacheByPattern('slots:*');
  await deleteCache(`slot:${id}`);

  res.json({
    success: true,
    message: 'Parking slot updated successfully',
    data: { ...updatedSlot, status: deriveStatus(updatedSlot) },
  });
});

// ── DELETE /api/parking/slots/:id
export const deleteSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await db.delete(parkingSlots).where(eq(parkingSlots.id, id));

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Parking slot not found' });
  }

  await deleteCacheByPattern('slots:*');
  await deleteCache(`slot:${id}`);

  res.json({ success: true, message: 'Parking slot deleted' });
});

// ── GET /api/parking/logs?slotId=xxx&limit=50
export const getLogs = asyncHandler(async (req, res) => {
  const { slotId, limit = 100, page = 1 } = req.query;

  const cacheKey = `logs:${slotId || 'all'}:${limit}:${page}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(parkingLogs);
  let countQuery = db.select({ count: parkingLogs.id }).from(parkingLogs);

  if (slotId) {
    query = query.where(eq(parkingLogs.slot_id, slotId));
    countQuery = countQuery.where(eq(parkingLogs.slot_id, slotId));
  }

  query.orderBy(desc(parkingLogs.entry_time)).limit(limitNum).offset(offset);

  const [countResult, logs] = await Promise.all([countQuery, query]);
  const total = countResult.length;

  const result = {
    logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  };

  await setCache(cacheKey, result, CACHE_LOGS);

  res.json({ success: true, data: result });
});

// ── POST /api/parking/logs
export const createLog = asyncHandler(async (req, res) => {
  const { slot_id, license_plate, vehicle_type, detection_confidence, entry_image_url } = req.body;

  if (!slot_id || !license_plate) {
    return res.status(400).json({ error: 'slot_id and license_plate are required' });
  }

  const [newLog] = await db
    .insert(parkingLogs)
    .values({
      slot_id,
      license_plate,
      vehicle_type: vehicle_type || null,
      detection_confidence: detection_confidence || null,
      entry_image_url: entry_image_url || null,
      status: 'active',
    })
    .returning();

  // Update slot occupancy
  if (slot_id) {
    await db
      .update(parkingSlots)
      .set({
        is_occupied: true,
        vehicle_type: vehicle_type || null,
        license_plate,
        updated_at: new Date(),
      })
      .where(eq(parkingSlots.id, slot_id));

    await deleteCache(`slot:${slot_id}`);
  }
  await deleteCacheByPattern('logs:*');

  res.status(201).json({ success: true, message: 'Parking log created', data: newLog });
});

// ── PUT /api/parking/logs/:id/complete
export const completeLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { exit_image_url } = req.body;

  const [log] = await db.select().from(parkingLogs).where(eq(parkingLogs.id, id)).limit(1);
  if (!log) {
    return res.status(404).json({ error: 'Parking log not found' });
  }

  const exitTime = new Date();
  const durationMinutes = Math.round((exitTime - log.entry_time) / 60000);
  const fee = durationMinutes * 1000; // Example: 1000 per minute

  const [updatedLog] = await db
    .update(parkingLogs)
    .set({
      exit_time: exitTime,
      duration_minutes: durationMinutes,
      fee,
      status: 'completed',
      exit_image_url: exit_image_url || null,
    })
    .where(eq(parkingLogs.id, id))
    .returning();

  // Update slot to free
  if (log.slot_id) {
    await db
      .update(parkingSlots)
      .set({
        is_occupied: false,
        vehicle_type: null,
        license_plate: null,
        updated_at: new Date(),
      })
      .where(eq(parkingSlots.id, log.slot_id));

    await deleteCache(`slot:${log.slot_id}`);
  }
  await deleteCacheByPattern('logs:*');

  res.json({ success: true, message: 'Parking session completed', data: updatedLog });
});

// ── Helper: derive status string from slot fields ───────────
function deriveStatus(slot) {
  // Priority: explicit status-like field → is_occupied → default
  if (slot.status) return slot.status; // if already a status field
  if (slot.is_occupied) return 'occupied';
  return 'empty';
}

// ── POST /api/parking/detect — AI plate + vehicle detection ─
export const detectVehicle = asyncHandler(async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'imageBase64 is required' });
  }

  // Import lazily to avoid circular dependency issues
  const { recognizePlate, classifyVehicle } = await import('../services/ai.js');

  try {
    // Run both AI calls in parallel
    const [plateResult, typeResult] = await Promise.all([
      recognizePlate(imageBase64),
      classifyVehicle(imageBase64),
    ]);

    res.json({
      success: true,
      data: {
        plate: plateResult.plate,
        plateConfidence: plateResult.confidence,
        type: typeResult.type,
        typeConfidence: typeResult.confidence,
      },
    });
  } catch (err) {
    // Forward AI service errors with appropriate status code
    const status = err.response?.status || 500;
    const message = err.code === 'ECONNABORTED'
      ? 'AI service timeout'
      : err.response?.data?.error || err.message || 'AI detection failed';

    res.status(status >= 400 && status < 500 ? status : 502).json({
      success: false,
      error: message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Dashboard helpers
// ═══════════════════════════════════════════════════════════════════

// ── GET /api/dashboard/summary
export const getDashboardSummary = asyncHandler(async (_req, res) => {
  const cacheKey = 'dashboard:summary';
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  // Total, occupied, available
  const [totalResult, occupiedResult] = await Promise.all([
    db.select({ value: count() }).from(parkingSlots),
    db.select({ value: count() }).from(parkingSlots).where(eq(parkingSlots.is_occupied, true)),
  ]);

  const totalSlots = totalResult[0]?.value || 0;
  const occupiedSlots = occupiedResult[0]?.value || 0;
  const availableSlots = totalSlots - occupiedSlots;

  // Breakdown by zone
  const zoneBreakdown = await db
    .select({
      zone: parkingSlots.zone,
      total: count(),
      occupied: sql`SUM(CASE WHEN ${parkingSlots.is_occupied} THEN 1 ELSE 0 END)`,
    })
    .from(parkingSlots)
    .groupBy(parkingSlots.zone)
    .orderBy(parkingSlots.zone);

  // Today's log count
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [todayLogsResult] = await db
    .select({ value: count() })
    .from(parkingLogs)
    .where(sql`${parkingLogs.entry_time} >= ${startOfDay}`);

  const summary = {
    total_slots: totalSlots,
    occupied: occupiedSlots,
    available: availableSlots,
    reserved: 0,
    blocked: 0,
    today_logs: todayLogsResult?.value || 0,
    occupancy_rate: totalSlots > 0 ? parseFloat(((occupiedSlots / totalSlots) * 100).toFixed(1)) : 0,
    zones: zoneBreakdown.map((z) => ({
      zone: z.zone,
      total: Number(z.total),
      occupied: Number(z.occupied),
      available: Number(z.total) - Number(z.occupied),
    })),
    last_update: new Date().toISOString(),
  };

  await setCache(cacheKey, summary, 5); // 5-second cache
  res.json({ success: true, data: summary });
});

// ── GET /api/logs/recent
export const getRecentLogs = asyncHandler(async (req, res) => {
  const cacheKey = 'logs:recent';
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const logs = await db
    .select()
    .from(parkingLogs)
    .orderBy(desc(parkingLogs.entry_time))
    .limit(20);

  const result = {
    logs: logs.slice(0, 20),
    count: logs.length,
  };

  await setCache(cacheKey, result, 10);
  res.json({ success: true, data: result });
});
