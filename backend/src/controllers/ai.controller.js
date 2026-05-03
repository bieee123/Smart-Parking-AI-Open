import { getCollection } from '../db/mongo.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDetections = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1 } = req.query;
  const collection = getCollection('ai_detections');

  const skip = (page - 1) * limit;
  const total = await collection.countDocuments();
  const detections = await collection
    .find()
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  res.json({
    detections,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

export const createDetection = asyncHandler(async (req, res) => {
  const detection = req.body;
  detection.timestamp = new Date();

  const collection = getCollection('ai_detections');
  const result = await collection.insertOne(detection);

  res.status(201).json({ message: 'Detection recorded', id: result.insertedId });
});

export const getDetectionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ObjectId } = await import('mongodb');

  const collection = getCollection('ai_detections');
  const detection = await collection.findOne({ _id: new ObjectId(id) });

  if (!detection) {
    return res.status(404).json({ error: 'Detection not found' });
  }

  res.json({ detection });
});

export const getStats = asyncHandler(async (req, res) => {
  const collection = getCollection('ai_detections');

  const totalDetections = await collection.countDocuments();
  const todayDetections = await collection.countDocuments({
    timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  });

  res.json({
    stats: { totalDetections, todayDetections },
  });
});
