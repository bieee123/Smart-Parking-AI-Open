import { connectMongo, disconnectMongo } from './mongo.js';

async function testConnection() {
  try {
    await connectMongo();
    console.log('✅ MongoDB connected successfully');
    await disconnectMongo();
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Possible fixes:');
    console.error('   1. Check MONGO_URL in .env file');
    console.error('   2. Ensure MongoDB Atlas cluster is accessible');
    console.error('   3. Verify IP whitelist includes your IP');
    console.error('   4. Check username and password are correct');
    process.exit(1);
  }
}

testConnection();
