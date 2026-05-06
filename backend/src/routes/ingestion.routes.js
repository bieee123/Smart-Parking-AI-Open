import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCollection } from '../db/mongo.js';
import { db } from '../db/postgres.js';
import { parkingSlots, cameras as camerasTable } from '../db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/ingest/traffic
router.post('/traffic', asyncHandler(async (req, res) => {
  const { vehicle_count, density_level, camera_id, violations, timestamp } = req.body;
  
  // ── Validation: Ignore if camera is offline ──
  if (camera_id) {
    try {
      const [cam] = await db.select().from(camerasTable).where(eq(camerasTable.id, camera_id)).limit(1);
      if (cam && cam.status !== 'online') {
        return res.json({ success: true, ignored: true, reason: 'Camera is offline' });
      }
    } catch (err) {
      console.warn(`[Ingest/traffic] Camera check failed for ${camera_id}:`, err.message);
    }
  }

  try {
    const col = await getCollection('traffic_history');
    await col.insertOne({
      vehicle_count: vehicle_count ?? 0,
      density_level: density_level ?? 'unknown',
      camera_id: camera_id ?? 'unknown',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      created_at: new Date(),
    });
    if (Array.isArray(violations) && violations.length > 0) {
      const vcol = await getCollection('violation_history');
      await vcol.insertMany(violations.map(v => ({
        camera_id: camera_id ?? 'unknown',
        violation_type: v.type ?? 'illegal_parking',
        zone: v.zone ?? 'unknown',
        confidence: v.confidence ?? 0,
        timestamp: new Date(),
        created_at: new Date(),
      })));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Ingest/traffic]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}));

// POST /api/ingest/occupancy
router.post('/occupancy', asyncHandler(async (req, res) => {
  const { slots } = req.body;
  if (!slots || !Array.isArray(slots))
    return res.status(400).json({ success: false, error: 'slots array required' });
  
  const { parkingLogs } = await import('../db/drizzle/schema.js');
  const { desc, and } = await import('drizzle-orm');
  
  let updated = 0;
  try {
    for (const slot of slots) {
      try {
        // 1. Get current slot state to detect changes
        const [currentSlot] = await db.select().from(parkingSlots).where(eq(parkingSlots.slot_number, slot.slot_number)).limit(1);
        
        if (!currentSlot) continue;

        const wasOccupied = currentSlot.is_occupied;
        const isNowOccupied = slot.is_occupied ?? false;

        // 2. Detect Change: Empty -> Occupied (Entry)
        if (!wasOccupied && isNowOccupied) {
          await db.insert(parkingLogs).values({
            slot_id: currentSlot.id,
            license_plate: slot.license_plate || 'UNKNOWN',
            vehicle_type: slot.vehicle_type || 'car',
            status: 'active',
            entry_time: new Date(),
          });
        }

        // 3. Detect Change: Occupied -> Empty (Exit)
        if (wasOccupied && !isNowOccupied) {
          const [activeLog] = await db
            .select()
            .from(parkingLogs)
            .where(and(eq(parkingLogs.slot_id, currentSlot.id), eq(parkingLogs.status, 'active')))
            .orderBy(desc(parkingLogs.entry_time))
            .limit(1);

          if (activeLog) {
            const exitTime = new Date();
            const durationMinutes = Math.round((exitTime - activeLog.entry_time) / 60000);
            await db.update(parkingLogs)
              .set({
                exit_time: exitTime,
                duration_minutes: durationMinutes,
                fee: durationMinutes * 1000,
                status: 'completed'
              })
              .where(eq(parkingLogs.id, activeLog.id));
          }
        }

        // 4. Update the slot itself
        await db.update(parkingSlots)
          .set({ 
            is_occupied: isNowOccupied, 
            license_plate: isNowOccupied ? (slot.license_plate ?? null) : null,
            vehicle_type: isNowOccupied ? (slot.vehicle_type ?? null) : null,
            updated_at: new Date() 
          })
          .where(eq(parkingSlots.id, currentSlot.id));
        
        updated++;
      } catch (e) {
        console.warn(`[Ingest/occupancy] Slot ${slot.slot_number}:`, e.message);
      }
    }

    // Record history for analytics
    const ocol = await getCollection('parking_occupancy_history');
    await ocol.insertOne({ 
      timestamp: new Date(), 
      total: slots.length,
      occupied: slots.filter(s => s.is_occupied).length, 
      slots_snapshot: slots 
    });

    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// GET /api/ingest/status
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const tcol = await getCollection('traffic_history');
    const ocol = await getCollection('parking_occupancy_history');
    res.json({ success: true, data: {
      traffic_records: await tcol.countDocuments(),
      occupancy_snapshots: await ocol.countDocuments(),
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

export default router;
