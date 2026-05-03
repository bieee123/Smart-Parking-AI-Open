import { MongoClient } from "mongodb";
import config from "../config/env.js";

let client = null;
let db = null;

export async function connectMongo() {
  try {
    client = new MongoClient(config.mongoUrl, {
      // ❌ Hapus semua opsi TLS yang bentrok
      // MongoDB Atlas sudah auto TLS
    });

    await client.connect();

    db = client.db(); 

    console.log("✅ MongoDB connected successfully");

    return db;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongo() first.");
  }
  return db;
}

export function getCollection(name) {
  return getDb().collection(name);
}

export async function disconnectMongo() {
  if (client) {
    await client.close();
    console.log("🔌 MongoDB disconnected");
  }
}