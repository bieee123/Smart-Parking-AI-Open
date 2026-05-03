/**
 * Prediction Service — Node.js wrapper for the AI demand prediction model.
 *
 * Communicates with the Python AI microservice via HTTP.
 * Falls back to mock data when the AI service is unavailable.
 *
 * TODO: Once real model is trained, this service passes live data to the AI
 *       endpoint and returns actual predictions.
 */

import axios from 'axios';
import env from '../config/env.js';

const AI_TIMEOUT = 5000;
const MAX_RETRIES = 2;

const client = axios.create({
  baseURL: env.aiServiceUrl,
  timeout: AI_TIMEOUT,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Realistic hourly occupancy profile (mock baseline) */
const BASE_PROFILE = {
  0: 0.15, 1: 0.12, 2: 0.10, 3: 0.08, 4: 0.10, 5: 0.15,
  6: 0.25, 7: 0.40, 8: 0.55, 9: 0.65,
  10: 0.75, 11: 0.82, 12: 0.88, 13: 0.90, 14: 0.92, 15: 0.88,
  16: 0.82, 17: 0.75, 18: 0.65, 19: 0.50,
  20: 0.40, 21: 0.32, 22: 0.25, 23: 0.18,
};

function mockPredictions(hour, horizon) {
  const preds = [];
  for (let i = 1; i <= horizon; i++) {
    const futureHour = (hour + i) % 24;
    const base = BASE_PROFILE[futureHour] ?? 0.5;
    const variation = (Math.random() - 0.5) * 0.06;
    preds.push(parseFloat(Math.max(0, Math.min(1, base + variation)).toFixed(4)));
  }
  return preds;
}

async function requestWithRetry(fn, retries = MAX_RETRIES) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    const code = err.code;

    // 4xx or timeout — abort
    if ((status && status >= 400 && status < 500) || code === 'ECONNABORTED') {
      throw err;
    }

    if (retries > 0) {
      const delay = 150 * Math.pow(2, MAX_RETRIES - retries);
      await new Promise((r) => setTimeout(r, delay));
      return requestWithRetry(fn, retries - 1);
    }
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict demand for the next N hours.
 *
 * @param {Object} params
 * @param {number} params.current_hour - Current hour (0-23)
 * @param {number} [params.horizon=5] - Hours ahead to predict
 * @param {Object} [params.history] - Optional historical data
 * @returns {{ predictions: number[], confidence: number, version: string, metadata: object }}
 */
export async function predictDemand({ current_hour, horizon = 5, history = {} }) {
  try {
    const payload = {
      hour: current_hour,
      horizon,
      history,
    };

    const res = await requestWithRetry(() =>
      client.post('/ai/predict/demand', payload)
    );

    const data = res.data.data || {};
    return {
      predictions: data.prediction || [],
      confidence: data.confidence ?? 0.78,
      version: data.version || '0.1.0',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: data.model_type || 'placeholder-baseline',
        source: 'ai-service',
      },
    };
  } catch (err) {
    // Fallback to mock when AI service is unavailable
    if (env.nodeEnv === 'development') {
      console.warn('[prediction_service] AI service unavailable — using mock predictions');
    }

    return {
      predictions: mockPredictions(current_hour, horizon),
      confidence: 0.65,
      version: '0.1.0-mock',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: 'mock-baseline',
        source: 'fallback',
        error: err.message,
      },
    };
  }
}

/**
 * Predict demand for the next 24 hours.
 *
 * @returns {{ predictions: number[], confidence: number, version: string, metadata: object }}
 */
export async function predictDaily() {
  try {
    const res = await requestWithRetry(() =>
      client.post('/ai/predict/demand/daily', {})
    );

    const data = res.data.data || {};
    return {
      predictions: data.prediction || [],
      confidence: 0.75,
      version: data.version || '0.1.0',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: data.model_type || 'placeholder-baseline',
        period: '24h',
        source: 'ai-service',
      },
    };
  } catch (err) {
    if (env.nodeEnv === 'development') {
      console.warn('[prediction_service] AI daily prediction unavailable — using mock');
    }

    const currentHour = new Date().getHours();
    return {
      predictions: mockPredictions(currentHour, 24),
      confidence: 0.60,
      version: '0.1.0-mock',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: 'mock-baseline',
        period: '24h',
        source: 'fallback',
        error: err.message,
      },
    };
  }
}

/**
 * Predict daily average occupancy for the next 7 days.
 *
 * @returns {{ predictions: number[], confidence: number, version: string, metadata: object }}
 */
export async function predictWeekly() {
  try {
    const res = await requestWithRetry(() =>
      client.post('/ai/predict/demand/weekly', {})
    );

    const data = res.data.data || {};
    return {
      predictions: data.prediction || [],
      confidence: 0.70,
      version: data.version || '0.1.0',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: data.model_type || 'placeholder-baseline',
        period: '7d',
        source: 'ai-service',
      },
    };
  } catch (err) {
    if (env.nodeEnv === 'development') {
      console.warn('[prediction_service] AI weekly prediction unavailable — using mock');
    }

    // Mock: 7 daily averages with weekday/weekend patterns
    const dayOfWeek = new Date().getDay(); // 0=Sun
    const weeklyPred = [];
    for (let i = 0; i < 7; i++) {
      const day = (dayOfWeek + i) % 7;
      const isWeekend = day === 0 || day === 6;
      const base = isWeekend ? 0.55 : 0.75;
      const variation = (Math.random() - 0.5) * 0.15;
      weeklyPred.push(parseFloat(Math.max(0.2, Math.min(0.95, base + variation)).toFixed(4)));
    }

    return {
      predictions: weeklyPred,
      confidence: 0.55,
      version: '0.1.0-mock',
      metadata: {
        generated_at: new Date().toISOString(),
        model_type: 'mock-baseline',
        period: '7d',
        source: 'fallback',
        error: err.message,
      },
    };
  }
}

/**
 * Health check for the prediction service.
 *
 * @returns {{ status: string, model_loaded: boolean, version: string, ai_available: boolean }}
 */
export async function predictionHealth() {
  try {
    const res = await requestWithRetry(() =>
      client.get('/ai/health')
    );

    const health = res.data.data || {};
    return {
      status: health.status || 'ok',
      model_loaded: health.models_loaded ?? false,
      ai_available: true,
      engines: health.engines || {},
    };
  } catch {
    return {
      status: 'degraded',
      model_loaded: false,
      ai_available: false,
      engines: {},
      note: 'AI microservice unreachable — mock predictions active',
    };
  }
}
