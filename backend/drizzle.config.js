import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: './src/db/drizzle/schema.js',
  out: './src/db/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
  url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
};