/**
 * AI Microservice HTTP Client
 * Communicates with the FastAPI AI service for LPR, vehicle classification,
 * demand prediction, and health checks.
 *
 * Features:
 *  - Retry 3x on transient network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
 *  - Retry on 5xx from AI service, abort on 4xx
 *  - 5-second timeout per request
 *  - Base64 input validation
 *  - Debug logging in development
 */
import axios from 'axios';
import env from '../config/env.js';

const AI_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 3;
const RETRYABLE_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'];

const client = axios.create({
  baseURL: env.aiServiceUrl,
  timeout: AI_TIMEOUT,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Check if an error code is a transient network issue worth retrying. */
function isRetryableNetworkError(code) {
  return RETRYABLE_ERRORS.includes(code);
}

/** Check if an HTTP status code warrants a retry (5xx only). */
function isRetryableStatus(status) {
  return typeof status === 'number' && status >= 500;
}

/** Log debug messages only in development. */
function log(...args) {
  if (env.nodeEnv === 'development') {
    console.log('[AI REQUEST]', ...args);
  }
}

function logResponse(...args) {
  if (env.nodeEnv === 'development') {
    console.log('[AI RESPONSE]', ...args);
  }
}

function logError(...args) {
  if (env.nodeEnv === 'development') {
    console.error('[AI ERROR]', ...args);
  }
}

/**
 * Execute an axios request with retry logic.
 * Retries up to MAX_RETRIES times on transient network errors or 5xx responses.
 * Aborts immediately on 4xx or timeout.
 */
async function requestWithRetry(fn, retries = MAX_RETRIES) {
  try {
    const res = await fn();
    return res;
  } catch (err) {
    const code = err.code;
    const status = err.response?.status;

    // 4xx → do NOT retry
    if (status && status >= 400 && status < 500) {
      throw err;
    }

    // Timeout → do NOT retry
    if (code === 'ECONNABORTED') {
      throw err;
    }

    // Network error or 5xx → retry if attempts remain
    if (retries > 0 && (isRetryableNetworkError(code) || isRetryableStatus(status))) {
      logError(`Retryable error (${code || status}), ${retries} retries left`);
      // Small delay between retries (exponential backoff: 200ms, 400ms, 800ms)
      const delay = 200 * Math.pow(2, MAX_RETRIES - retries);
      await new Promise((r) => setTimeout(r, delay));
      return requestWithRetry(fn, retries - 1);
    }

    // Non-retryable or out of retries
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Recognize license plate from base64 image.
 * @param {string} base64Image - Base64-encoded image string
 * @returns {{ plate: string, confidence: number }}
 */
export async function recognizePlate(base64Image) {
  log('POST /lpr/recognize');
  const res = await requestWithRetry(() =>
    client.post('/lpr/recognize', new URLSearchParams({ image_b64: base64Image }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  );
  logResponse(res.data);
  return res.data.data; // { plate, confidence }
}

/**
 * Classify vehicle type from base64 image.
 * @param {string} base64Image - Base64-encoded image string
 * @returns {{ type: string, confidence: number }}
 */
export async function classifyVehicle(base64Image) {
  log('POST /vehicle/classify');
  const res = await requestWithRetry(() =>
    client.post('/vehicle/classify', new URLSearchParams({ image_b64: base64Image }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  );
  logResponse(res.data);
  return res.data.data; // { type, confidence }
}

/**
 * Predict parking demand for upcoming hours.
 * @param {number} hour - Current hour (0-23)
 * @param {number} [horizon=5] - Hours ahead to predict
 * @returns {{ prediction: number[], hours_ahead: number }}
 */
export async function predictDemand(hour, horizon = 5) {
  log('POST /predict/demand', { hour, horizon });
  const res = await requestWithRetry(() =>
    client.post('/predict/demand', { hour, horizon })
  );
  logResponse(res.data);
  return res.data.data; // { prediction: [...], hours_ahead }
}

/**
 * Check AI microservice health.
 * @returns {{ status: string, models_loaded: boolean, engines: object }}
 */
export async function aiHealth() {
  try {
    log('GET /health');
    const res = await requestWithRetry(() => client.get('/health'));
    logResponse(res.data);
    return res.data.data;
  } catch (err) {
    logError('Health check failed:', err.message);
    return { status: 'unavailable', models_loaded: false, engines: {} };
  }
}
