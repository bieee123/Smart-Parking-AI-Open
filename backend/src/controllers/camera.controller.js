import { getCollection } from '../db/mongo.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCache, setCache } from '../db/redis.js';

const CACHE_CAMERA_STATUS = 3; // seconds

// ── GET /api/camera/logs
export const getCameraLogs = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1 } = req.query;
  const collection = getCollection('camera_logs');

  const skip = (page - 1) * limit;
  const total = await collection.countDocuments();
  const logs = await collection
    .find()
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  res.json({
    success: true,
    data: {
      logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    },
  });
});

// ── POST /api/camera/logs
export const createCameraLog = asyncHandler(async (req, res) => {
  const log = req.body;
  log.created_at = new Date();

  const collection = getCollection('camera_logs');
  const result = await collection.insertOne(log);

  res.status(201).json({ success: true, message: 'Camera log created', data: { id: result.insertedId } });
});

// ── PUT /api/camera/logs/:id
export const updateCameraStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, last_heartbeat } = req.body;
  const { ObjectId } = await import('mongodb');

  const collection = getCollection('camera_logs');
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, last_heartbeat: last_heartbeat || new Date() } }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Camera log not found' });
  }

  res.json({ success: true, message: 'Camera status updated' });
});

// ── GET /api/camera/status
export const getCameraStatus = asyncHandler(async (req, res) => {
  const collection = getCollection('camera_logs');
  const cameras = await collection.find().toArray();

  const status = {
    total: cameras.length,
    online: cameras.filter((c) => c.status === 'online').length,
    offline: cameras.filter((c) => c.status === 'offline').length,
  };

  res.json({ success: true, data: { cameras, status } });
});

// ── GET /api/camera/status/:cameraId
export const getCameraStatusById = asyncHandler(async (req, res) => {
  const { cameraId } = req.params;

  const cacheKey = `camera:status:${cameraId}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const collection = getCollection('camera_logs');
  const camera = await collection.findOne({ camera_id: cameraId }).sort({ created_at: -1 });

  if (!camera) {
    return res.status(404).json({ error: 'Camera not found' });
  }

  const result = {
    camera_id: camera.camera_id,
    name: camera.name || cameraId,
    status: camera.status || 'offline',
    last_heartbeat: camera.last_heartbeat || null,
    snapshot_url: camera.snapshot_url || null,
    linked_slot: camera.linked_slot || null,
  };

  await setCache(cacheKey, result, CACHE_CAMERA_STATUS);

  res.json({ success: true, data: result });
});
