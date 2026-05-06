import { getCollection } from '../db/mongo.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { db } from '../db/postgres.js';
import { analysisHistory } from '../db/drizzle/schema.js';
import { desc } from 'drizzle-orm';

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

// ── GET /api/ai/analysis/history (PostgreSQL)
export const getAnalysisHistory = asyncHandler(async (req, res) => {
  const history = await db.select().from(analysisHistory).orderBy(desc(analysisHistory.created_at));
  res.json({ success: true, data: history });
});

// ── POST /api/ai/analysis/history (PostgreSQL)
export const saveAnalysisHistory = asyncHandler(async (req, res) => {
  const { filename, media_type, result_summary, detailed_result } = req.body;
  
  const [inserted] = await db.insert(analysisHistory).values({
    filename,
    media_type,
    result_summary,
    detailed_result: typeof detailed_result === 'string' ? detailed_result : JSON.stringify(detailed_result),
    created_at: new Date()
  }).returning();

  res.status(201).json({ success: true, data: inserted });
});
