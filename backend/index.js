import express from 'express';
import cors from 'cors';
import config from './src/config/env.js';

// Database connections
import { pool } from './src/db/postgres.js';
import { connectMongo } from './src/db/mongo.js';
import { connectRedis } from './src/db/redis.js';

// Routes
import authRoutes from './src/routes/auth.routes.js';
import parkingRoutes from './src/routes/parking.routes.js';
import aiRoutes from './src/routes/ai.routes.js';
import cameraRoutes from './src/routes/camera.routes.js';
import systemRoutes from './src/routes/system.routes.js';
import analyticsRoutes from './src/routes/analytics.routes.js';
import simulatorRoutes from './src/routes/simulator.routes.js';
import dashboardRoutes from './src/routes/dashboard.routes.js';
import logsRoutes from './src/routes/logs.routes.js';
import liveRoutes from './src/routes/live.routes.js';
import ingestionRoutes from './src/routes/ingestion.routes.js';
import profileRoutes from './src/routes/profile.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import reservationRoutes from './src/routes/reservation.routes.js';

// Middlewares
import { errorHandler, notFoundHandler } from './src/middlewares/error.js';

const app = express();

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/camera', cameraRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/ingest', ingestionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', reservationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Parking API',
    version: '1.0.0',
    docs: '/api/system/health',
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

async function startServer() {
  try {
    // Initialize database connections
    console.log('🔄 Initializing database connections...');

    // Test PostgreSQL connection
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
      console.warn('⚠️ PostgreSQL connection failed:', error.message);
    }

    // Initialize MongoDB connection
    try {
      await connectMongo();
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.warn('⚠️ MongoDB connection failed (optional):', error.message);
    }

    // Initialize Redis connection
    connectRedis();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/system/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
