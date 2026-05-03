import { asyncHandler } from '../utils/asyncHandler.js';

export const healthCheck = asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export const getSystemInfo = asyncHandler(async (req, res) => {
  res.json({
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    },
  });
});
