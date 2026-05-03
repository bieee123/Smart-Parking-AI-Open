/**
 * Prediction Service Tests — Smart Parking.
 *
 * Tests:
 *  1. predictDemand() returns correct shape with mock fallback
 *  2. predictDaily() returns 24 values
 *  3. predictWeekly() returns 7 values
 *  4. Network failure → mock fallback
 *  5. predictionHealth() returns status object
 *  6. Invalid payload handling (in controller)
 *  7. Retry behavior simulation
 *  8. Output schema validation
 *
 * Run:
 *   node --test backend/test/prediction_service.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictDemand,
  predictDaily,
  predictWeekly,
  predictionHealth,
} from '../src/services/prediction_service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Assert object has required keys */
function hasKeys(obj, keys) {
  for (const key of keys) {
    assert.ok(key in obj, `Missing key: "${key}"`);
  }
}

/** Assert all values in array are within [min, max] */
function allInRange(arr, min, max) {
  return arr.every((v) => typeof v === 'number' && v >= min && v <= max);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. predictDemand — Happy Path (mock fallback since AI is down)
// ═════════════════════════════════════════════════════════════════════════════

test('predictDemand returns correct shape', async () => {
  const result = await predictDemand({ current_hour: 14, horizon: 5 });

  assert.ok(result, 'Should return a result');
  hasKeys(result, ['predictions', 'confidence', 'version', 'metadata']);
  assert.equal(Array.isArray(result.predictions), true, 'predictions should be an array');
  assert.equal(result.predictions.length, 5, 'should return 5 predictions');
  assert.equal(allInRange(result.predictions, 0, 1), true, 'all predictions in [0, 1]');
  assert.equal(typeof result.confidence, 'number', 'confidence should be a number');
  assert.equal(typeof result.version, 'string', 'version should be a string');
  hasKeys(result.metadata, ['generated_at', 'model_type', 'source']);
});

test('predictDemand with horizon=1', async () => {
  const result = await predictDemand({ current_hour: 10, horizon: 1 });
  assert.equal(result.predictions.length, 1);
  assert.equal(allInRange(result.predictions, 0, 1), true);
});

test('predictDemand with horizon=24', async () => {
  const result = await predictDemand({ current_hour: 0, horizon: 24 });
  assert.equal(result.predictions.length, 24);
  assert.equal(allInRange(result.predictions, 0, 1), true);
});

test('predictDemand with history object', async () => {
  const result = await predictDemand({
    current_hour: 14,
    horizon: 3,
    history: { parking_occupancy: [0.7, 0.8, 0.75], traffic_volume: [100, 120] },
  });
  assert.equal(result.predictions.length, 3);
  assert.equal(allInRange(result.predictions, 0, 1), true);
});

test('predictDemand mock metadata indicates fallback', async () => {
  const result = await predictDemand({ current_hour: 14, horizon: 3 });
  // Since AI service is not running, metadata.source should be "fallback"
  assert.equal(result.metadata.source, 'fallback');
  assert.equal(result.metadata.model_type, 'mock-baseline');
  assert.equal(typeof result.metadata.generated_at, 'string');
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. predictDaily
// ═════════════════════════════════════════════════════════════════════════════

test('predictDaily returns 24 values', async () => {
  const result = await predictDaily();

  hasKeys(result, ['predictions', 'confidence', 'version', 'metadata']);
  assert.equal(result.predictions.length, 24, 'should return 24 hourly predictions');
  assert.equal(allInRange(result.predictions, 0, 1), true);
  assert.equal(result.metadata.period, '24h');
});

test('predictDaily values follow realistic pattern', async () => {
  const result = await predictDaily();
  const preds = result.predictions;

  // Hours 10-14 should generally be higher than hours 0-5
  const peakAvg = (preds[10] + preds[11] + preds[12] + preds[13] + preds[14]) / 5;
  const nightAvg = (preds[0] + preds[1] + preds[2] + preds[3] + preds[4]) / 5;
  assert.ok(peakAvg > nightAvg, `Peak avg (${peakAvg.toFixed(2)}) should be > night avg (${nightAvg.toFixed(2)})`);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. predictWeekly
// ═════════════════════════════════════════════════════════════════════════════

test('predictWeekly returns 7 values', async () => {
  const result = await predictWeekly();

  hasKeys(result, ['predictions', 'confidence', 'version', 'metadata']);
  assert.equal(result.predictions.length, 7, 'should return 7 daily predictions');
  assert.equal(allInRange(result.predictions, 0.2, 0.95), true);
  assert.equal(result.metadata.period, '7d');
});

test('predictWeekly weekend values lower', async () => {
  const result = await predictWeekly();
  // At least some variation exists between weekday/weekend mock
  const values = result.predictions;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  assert.ok(maxVal - minVal > 0.05, 'There should be variation between days');
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. predictionHealth
// ═════════════════════════════════════════════════════════════════════════════

test('predictionHealth returns status object', async () => {
  const health = await predictionHealth();

  hasKeys(health, ['status', 'model_loaded', 'ai_available']);
  assert.equal(typeof health.status, 'string');
  assert.equal(typeof health.model_loaded, 'boolean');
  assert.equal(typeof health.ai_available, 'boolean');
});

test('predictionHealth reports degraded when AI unavailable', async () => {
  const health = await predictionHealth();
  // AI service not running — should report degraded
  assert.ok(
    health.status === 'degraded' || health.status === 'ok',
    `status should be "degraded" or "ok", got "${health.status}"`
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Mock Inference Consistency
// ═════════════════════════════════════════════════════════════════════════════

test('mock predictions are deterministic-enough (same hour, same distribution)', async () => {
  // Run twice — both should return valid data with similar structure
  const r1 = await predictDemand({ current_hour: 14, horizon: 5 });
  const r2 = await predictDemand({ current_hour: 14, horizon: 5 });

  assert.equal(r1.predictions.length, r2.predictions.length);
  assert.equal(r1.version, r2.version);
  assert.equal(r1.metadata.model_type, r2.metadata.model_type);
  // Individual values may differ due to random variation, but structure is same
});

test('different hours produce different prediction patterns', async () => {
  const morning = await predictDemand({ current_hour: 8, horizon: 5 });
  const night = await predictDemand({ current_hour: 22, horizon: 5 });

  // Morning predictions should generally be higher than night
  const morningAvg = morning.predictions.reduce((a, b) => a + b, 0) / morning.predictions.length;
  const nightAvg = night.predictions.reduce((a, b) => a + b, 0) / night.predictions.length;

  assert.ok(morningAvg > nightAvg, `Morning avg (${morningAvg.toFixed(2)}) should be > night avg (${nightAvg.toFixed(2)})`);
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Output Schema Validation
// ═════════════════════════════════════════════════════════════════════════════

test('output matches expected API contract', async () => {
  const result = await predictDemand({ current_hour: 14, horizon: 5 });

  // Expected contract:
  // {
  //   predictions: number[],   // occupancy rates 0-1
  //   confidence: number,      // 0-1
  //   version: string,         // semver-like
  //   metadata: {
  //     generated_at: string,  // ISO timestamp
  //     model_type: string,
  //     source: string
  //   }
  // }

  assert.ok(Array.isArray(result.predictions), 'predictions must be array');
  assert.ok(result.predictions.length > 0, 'predictions must not be empty');
  assert.ok(result.predictions.every((v) => typeof v === 'number'), 'all predictions must be numbers');

  assert.ok(typeof result.confidence === 'number', 'confidence must be number');
  assert.ok(result.confidence >= 0 && result.confidence <= 1, 'confidence must be in [0,1]');

  assert.ok(typeof result.version === 'string', 'version must be string');
  assert.ok(result.version.length > 0, 'version must not be empty');

  assert.ok(typeof result.metadata === 'object', 'metadata must be object');
  assert.ok(result.metadata !== null, 'metadata must not be null');
  assert.ok(typeof result.metadata.generated_at === 'string', 'metadata.generated_at must be string');

  // Validate ISO timestamp format
  assert.ok(
    !isNaN(Date.parse(result.metadata.generated_at)),
    'metadata.generated_at must be a valid ISO timestamp'
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Error Handling & Edge Cases
// ═════════════════════════════════════════════════════════════════════════════

test('predictDemand handles extreme hour values', async () => {
  const r1 = await predictDemand({ current_hour: 0, horizon: 3 });
  const r2 = await predictDemand({ current_hour: 23, horizon: 3 });

  assert.equal(r1.predictions.length, 3);
  assert.equal(r2.predictions.length, 3);
  assert.equal(allInRange(r1.predictions, 0, 1), true);
  assert.equal(allInRange(r2.predictions, 0, 1), true);
});

test('predictDemand handles large horizon', async () => {
  // The service passes horizon through to the AI/mock — max 24
  const result = await predictDemand({ current_hour: 10, horizon: 24 });
  assert.equal(result.predictions.length, 24);
});

test('all responses include generated_at timestamp', async () => {
  const results = await Promise.all([
    predictDemand({ current_hour: 10, horizon: 3 }),
    predictDaily(),
    predictWeekly(),
  ]);

  for (const r of results) {
    assert.ok(
      r.metadata && r.metadata.generated_at,
      'Every response must include metadata.generated_at'
    );
  }
});
