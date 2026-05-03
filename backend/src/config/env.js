import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server
  port: process.env.PORT || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your_secret_here',

  // PostgreSQL
  databaseUrl: process.env.DATABASE_URL || 'postgresql://username:password@host:6543/postgres',

  // MongoDB
  mongoUrl: process.env.MONGO_URL || 'mongodb+srv://<user>:<password>@cluster.mongodb.net/SmartParking',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://default:<password>@host:6379',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // AI Service
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:9000/ai',
};

export default config;
