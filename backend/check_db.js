import { MongoClient } from 'mongodb';
async function run() {
  try {
    const client = await MongoClient.connect('mongodb://localhost:27017/');
    const db = client.db('test');
    const samples = await db.collection('violation_history').find().sort({timestamp:-1}).limit(10).toArray();
    console.log('Last 10 violations:');
    samples.forEach(s => console.log(`- ${s.timestamp} | ${s.violation_type || s.type} | ${s.zone}`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
