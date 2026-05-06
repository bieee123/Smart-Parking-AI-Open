import { db as pgDb } from './src/db/postgres.js';
import { parkingLogs, parkingSlots } from './src/db/drizzle/schema.js';
import { connectMongo } from './src/db/mongo.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

async function seedData() {
  console.log('🚀 Starting Seeding for Analytics...');
  
  try {
    // 1. Get all available slots to link logs
    const slots = await pgDb.select().from(parkingSlots);
    if (slots.length === 0) {
      console.error('❌ No slots found. Please run the app once first.');
      process.exit(1);
    }

    // 2. Generate Historical Logs (Last 7 Days)
    console.log('--- Seeding Parking Logs (PostgreSQL) ---');
    const logsToInsert = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) { // 7 days
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate 15-25 logs per day
      const logsPerDay = Math.floor(Math.random() * 10) + 15;
      
      for (let j = 0; j < logsPerDay; j++) {
        const slot = slots[Math.floor(Math.random() * slots.length)];
        const entryTime = new Date(date);
        entryTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        // Parking duration between 30 mins to 5 hours
        const durationMins = Math.floor(Math.random() * 270) + 30;
        const exitTime = new Date(entryTime.getTime() + durationMins * 60000);
        
        const fee = Math.ceil(durationMins / 60) * 5000; // 5000 per hour

        logsToInsert.push({
          id: crypto.randomUUID(),
          slot_id: slot.id,
          license_plate: `B ${Math.floor(Math.random() * 8999) + 1000} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          vehicle_type: slot.vehicle_type || 'car',
          entry_time: entryTime,
          exit_time: exitTime,
          duration_minutes: durationMins,
          fee: fee,
          status: 'completed',
          created_at: entryTime
        });
      }
    }
    
    await pgDb.insert(parkingLogs).values(logsToInsert);
    console.log(`✅ Inserted ${logsToInsert.length} historical logs.`);

    // 3. Generate MongoDB Data (Traffic & Violations)
    console.log('--- Seeding MongoDB (Traffic & Violations) ---');
    const mongo = await connectMongo();
    const trafficColl = mongo.collection('traffic_history');
    const violationColl = mongo.collection('violations');

    const trafficData = [];
    const violationData = [];
    const violationTypes = ['wrong_way', 'illegal_parking', 'overstay', 'speeding'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(date);
        timestamp.setHours(hour, 0, 0, 0);

        // Traffic Data
        trafficData.push({
          timestamp: timestamp,
          location: 'Main Entrance',
          vehicle_count: Math.floor(Math.random() * 50) + 10,
          occupancy_rate: Math.random() * 0.8 + 0.1,
          zone: 'A'
        });

        // Occasional Violations
        if (Math.random() > 0.7) {
          violationData.push({
            timestamp: timestamp,
            violation_type: violationTypes[Math.floor(Math.random() * violationTypes.length)],
            location: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
            license_plate: `B ${Math.floor(Math.random() * 8999) + 1000} ERR`,
            confidence: 0.85 + Math.random() * 0.1,
            processed: true
          });
        }
      }
    }

    await trafficColl.insertMany(trafficData);
    await violationColl.insertMany(violationData);
    
    console.log(`✅ Inserted ${trafficData.length} traffic records.`);
    console.log(`✅ Inserted ${violationData.length} violation records.`);

    console.log('\n✨ Seeding Complete! Please REFRESH your Analytics Dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
  }
}

seedData();
