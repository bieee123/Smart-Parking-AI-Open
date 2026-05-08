import { asyncHandler } from '../utils/asyncHandler.js';
import { db } from '../db/postgres.js';
import { reservations, parkingSlots } from '../db/drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// Tarif: { firstHour, perHour }
const TARIFF = {
  car:        { firstHour: 5000, perHour: 2000 },
  truck:      { firstHour: 5000, perHour: 2000 },
  motorcycle: { firstHour: 3000, perHour: 2000 },
};

function calcFee(vehicleType, durationHours) {
  const t = TARIFF[vehicleType] || TARIFF.car;
  if (durationHours <= 1) return t.firstHour;
  return t.firstHour + (durationHours - 1) * t.perHour;
}

/**
 * GET /api/public/slots — public slot status (no auth needed)
 */
export const getPublicSlots = asyncHandler(async (req, res) => {
  const slots = await db.select({
    id: parkingSlots.id,
    slot_number: parkingSlots.slot_number,
    zone: parkingSlots.zone,
    status: parkingSlots.status,
    is_occupied: parkingSlots.is_occupied,
    vehicle_type: parkingSlots.vehicle_type,
  }).from(parkingSlots);

  // Zone summary
  const summary = {};
  slots.forEach(s => {
    if (!summary[s.zone]) summary[s.zone] = { zone: s.zone, total: 0, available: 0, occupied: 0, reserved: 0 };
    summary[s.zone].total++;
    if (s.status === 'empty') summary[s.zone].available++;
    else if (s.status === 'occupied') summary[s.zone].occupied++;
    else if (s.status === 'reserved') summary[s.zone].reserved++;
  });

  res.json({
    success: true,
    data: {
      slots,
      zoneSummary: Object.values(summary),
      totals: {
        total: slots.length,
        available: slots.filter(s => s.status === 'empty').length,
        occupied: slots.filter(s => s.status === 'occupied').length,
        reserved: slots.filter(s => s.status === 'reserved').length,
      },
    },
  });
});

/**
 * POST /api/reservations — Create reservation (viewer auth required)
 */
export const createReservation = asyncHandler(async (req, res) => {
  const { slot_id, license_plate, vehicle_type, duration_hours } = req.body;
  const userId = req.user.id;

  if (!slot_id || !license_plate || !vehicle_type || !duration_hours) {
    return res.status(400).json({ error: 'slot_id, license_plate, vehicle_type, and duration_hours are required' });
  }

  // Check slot is available
  const [slot] = await db.select().from(parkingSlots).where(eq(parkingSlots.id, slot_id)).limit(1);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  if (slot.status !== 'empty') return res.status(409).json({ error: `Slot is ${slot.status}. Choose another slot.` });

  // Check user doesn't already have active reservation
  const existing = await db.select().from(reservations)
    .where(and(eq(reservations.user_id, userId), eq(reservations.status, 'active')))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'You already have an active reservation. Cancel it first.' });
  }

  const hours = Math.min(Math.max(parseInt(duration_hours), 1), 24);
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
  const fee = calcFee(vehicle_type, hours);

  // Create reservation + mark slot as reserved (atomic-ish)
  const [newReservation] = await db.insert(reservations).values({
    user_id: userId,
    slot_id,
    license_plate: license_plate.toUpperCase(),
    vehicle_type,
    duration_hours: hours,
    start_time: startTime,
    end_time: endTime,
    estimated_fee: fee,
    status: 'active',
  }).returning();

  await db.update(parkingSlots)
    .set({ status: 'reserved', license_plate: license_plate.toUpperCase(), vehicle_type })
    .where(eq(parkingSlots.id, slot_id));

  res.status(201).json({
    success: true,
    message: 'Reservation created successfully',
    data: newReservation,
  });
});

/**
 * GET /api/reservations/my — Get current user's reservations
 */
export const getMyReservations = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const myReservations = await db.select({
    id: reservations.id,
    slot_id: reservations.slot_id,
    slot_number: parkingSlots.slot_number,
    zone: parkingSlots.zone,
    license_plate: reservations.license_plate,
    vehicle_type: reservations.vehicle_type,
    duration_hours: reservations.duration_hours,
    start_time: reservations.start_time,
    end_time: reservations.end_time,
    estimated_fee: reservations.estimated_fee,
    status: reservations.status,
    created_at: reservations.created_at,
  })
  .from(reservations)
  .innerJoin(parkingSlots, eq(reservations.slot_id, parkingSlots.id))
  .where(eq(reservations.user_id, userId))
  .orderBy(sql`${reservations.created_at} DESC`)
  .limit(20);

  res.json({ success: true, data: myReservations });
});

/**
 * DELETE /api/reservations/:id — Cancel reservation
 */
export const cancelReservation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [reservation] = await db.select().from(reservations)
    .where(and(eq(reservations.id, id), eq(reservations.user_id, userId)))
    .limit(1);

  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.status !== 'active') return res.status(400).json({ error: 'Only active reservations can be cancelled' });

  await db.update(reservations).set({ status: 'cancelled', updated_at: new Date() }).where(eq(reservations.id, id));
  await db.update(parkingSlots).set({ status: 'empty', license_plate: null, vehicle_type: null }).where(eq(parkingSlots.id, reservation.slot_id));

  res.json({ success: true, message: 'Reservation cancelled' });
});

/**
 * GET /api/reservations/tariff — Fee calculator
 */
export const getTariff = asyncHandler(async (req, res) => {
  const { vehicle_type = 'car', duration_hours = 1 } = req.query;
  const fee = calcFee(vehicle_type, parseInt(duration_hours));
  res.json({ success: true, data: { vehicle_type, duration_hours: parseInt(duration_hours), estimated_fee: fee, tariff: TARIFF[vehicle_type] || TARIFF.car } });
});
/**
 * PATCH /api/reservations/:id/checkin — User arrives at slot
 */
export const checkinReservation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = ['admin', 'operator'].includes(req.user.role);

  // Find reservation
  const [reservation] = await db.select().from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);

  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  
  // Security check: only the user who booked or an admin can check in
  if (reservation.user_id !== userId && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (reservation.status !== 'active') {
    return res.status(400).json({ error: `Cannot check in. Status is ${reservation.status}` });
  }

  // Update Slot status: reserved -> occupied
  await db.update(parkingSlots)
    .set({ status: 'occupied' })
    .where(eq(parkingSlots.id, reservation.slot_id));

  // Update Reservation status: active -> completed (or we can keep it active but mark check_in time)
  // For simplicity, let's mark it as 'completed' in terms of "reservation stage"
  await db.update(reservations)
    .set({ status: 'completed', updated_at: new Date() })
    .where(eq(reservations.id, id));

  res.json({
    success: true,
    message: 'Check-in successful. Slot is now marked as occupied.',
  });
});

/**
 * GET /api/reservations/all — Admin view of all reservations
 */
export const getAllReservations = asyncHandler(async (req, res) => {
  if (!['admin', 'operator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized. Admin/Operator only.' });
  }

  const allReservations = await db.select({
    id: reservations.id,
    user_id: reservations.user_id,
    slot_id: reservations.slot_id,
    slot_number: parkingSlots.slot_number,
    slot_status: parkingSlots.status,
    license_plate: reservations.license_plate,
    vehicle_type: reservations.vehicle_type,
    status: reservations.status,
    start_time: reservations.start_time,
    end_time: reservations.end_time,
    created_at: reservations.created_at,
  })
  .from(reservations)
  .innerJoin(parkingSlots, eq(reservations.slot_id, parkingSlots.id))
  .orderBy(sql`${reservations.created_at} DESC`)
  .limit(100);

  res.json({ success: true, data: allReservations });
});
