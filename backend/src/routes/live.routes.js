import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCollection } from '../db/mongo.js';

const router = Router();

// ── In-memory SSE clients ────────────────────────────────────────────────────
let clients = [];

// ── Worker status (set by /broadcast when worker posts data) ─────────────────
let workerActive = false;
let workerLastSeen = null;
let latestData = null;

const WORKER_TIMEOUT_MS = 15_000; // 15 sec tanpa broadcast = worker dianggap mati

function isWorkerAlive() {
  if (!workerLastSeen) return false;
  return Date.now() - workerLastSeen.getTime() < WORKER_TIMEOUT_MS;
}

// ── B3: Plate blacklist check ─────────────────────────────────────────────────
async function checkPlateBlacklist(plate) {
  if (!plate) return null;
  try {
    const col = await getCollection('blacklisted_plates');
    const found = await col.findOne({ plate: plate.toUpperCase() });
    return found || null;
  } catch {
    return null;
  }
}

// ── GET /api/live/stream — SSE ke frontend ────────────────────────────────────
router.get('/stream', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // B1: Hybrid sourcing — jika worker tidak aktif, kirim data terakhir dari DB
  if (!isWorkerAlive()) {
    try {
      const col = await getCollection('traffic_history');
      const last = await col.findOne({}, { sort: { created_at: -1 } });
      if (last) {
        const payload = {
          ...last,
          source: 'db_history',
          worker_active: false,
          _id: undefined,
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ source: 'idle', worker_active: false, message: 'Waiting for source' })}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ source: 'idle', worker_active: false })}\n\n`);
    }
  }

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
}));

// ── POST /api/live/broadcast — camera_worker.py posts data here ───────────────
router.post('/broadcast', asyncHandler(async (req, res) => {
  const data = req.body;

  // Update worker status (B1)
  workerActive = true;
  workerLastSeen = new Date();
  latestData = data;

  const enriched = {
    ...data,
    worker_active: true,
    source: data.source || 'live',
    broadcast_at: new Date().toISOString(),
  };

  // Broadcast to all SSE clients
  clients.forEach(client => {
    try { client.write(`data: ${JSON.stringify(enriched)}\n\n`); } catch { /* skip dead client */ }
  });

  // B3: Plate alert — check blacklist and emit plate_alert event
  if (data.last_plate) {
    const hit = await checkPlateBlacklist(data.last_plate);
    if (hit) {
      const alert = {
        type: 'plate_alert',
        plate: data.last_plate,
        reason: hit.reason || 'Blacklisted',
        camera_id: data.camera_id || 'unknown',
        timestamp: new Date().toISOString(),
      };
      clients.forEach(client => {
        try { client.write(`event: plate_alert\ndata: ${JSON.stringify(alert)}\n\n`); } catch { /* skip */ }
      });
    }
  }

  res.status(200).json({ success: true, clients: clients.length });
}));

// ── GET /api/live/status — worker health check (B1) ──────────────────────────
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      worker_active: isWorkerAlive(),
      worker_last_seen: workerLastSeen,
      connected_clients: clients.length,
      source_mode: isWorkerAlive() ? 'live' : 'db_history',
    },
  });
}));

export default router;
