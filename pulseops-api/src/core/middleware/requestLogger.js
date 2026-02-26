// ============================================================================
// Request Logger Middleware — PulseOps API
//
// PURPOSE: This middleware automatically logs every incoming HTTP request to the PulseOps API.
// It captures request details (method, URL, status code, latency), request/response bodies,
// and persists them to the database for monitoring and debugging purposes.
// The logging respects the logging configuration (captureApiCalls) to conditionally enable/disable API logging.
//
// HOW IT WORKS:
// 1. Intercepts each incoming request in the Express middleware chain.
// 2. Captures the request body (for non-GET requests) and intercepts the response.json to capture response body.
// 3. Logs the request details to the console/file via the logger service.
// 4. Asynchronously persists the log entry to the SystemLog table in the database.
// 5. Checks the loggingConfig.json to determine if API calls should be logged (captureApiCalls flag).
// 6. Skips logging for health checks and documentation endpoints.
//
// USAGE: This middleware is automatically applied to all routes in the Express app (see app.js).
// No direct usage is required; it operates transparently for all API requests.
//
// WHO USES THIS FILE: The PulseOps API server uses this middleware for all incoming HTTP requests.
// Developers can monitor API activity through the logs, and administrators can control logging via the settings.
// ============================================================================
import logger, { msg, logMessages } from '#core/logger.js';
import { SystemLog } from '#core/database/models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '../../config');

function readJsonConfig(filename) {
  try {
    const filePath = path.join(CONFIG_DIR, filename);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {}
  return null;
}

function getISTTimestamp() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return istTime;
}

let requestBody = null;
let responseBody = null;

export default function requestLogger(req, res, next) {
  const start = Date.now();

  // Capture request body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestBody = req.body || null;
  }

  // Intercept response.json to capture response body
  const originalJson = res.json;
  res.json = function(data) {
    responseBody = data || null;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const latencyMs = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs,
      ip: req.ip,
    };

    const message = msg(logMessages.middleware.requestReceived, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs,
    });

    if (res.statusCode >= 500) {
      logger.error(message, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
    } else {
      logger.info(message, logData);
    }

    // Persist API log to database asynchronously
    persistApiLog(req, res, latencyMs, requestBody, responseBody).catch(err => {
      logger.error('Failed to persist API log', { error: err.message });
    });

    requestBody = null;
    responseBody = null;
  });

  next();
}

async function persistApiLog(req, res, latencyMs, reqBody, respBody) {
  try {
    // Check logging config
    const loggingConfig = readJsonConfig('loggingConfig.json') || { captureApiCalls: true };
    if (!loggingConfig.captureApiCalls) return;

    // Skip logging for health checks and docs
    if (req.originalUrl.includes('/health') || req.originalUrl.includes('/docs')) {
      return;
    }

    await SystemLog.create({
      timestamp: getISTTimestamp(),
      level: res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'warn' : 'info',
      source: 'API',
      event: `${req.method} ${req.path}`,
      message: `API call to ${req.path}`,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      result: res.statusCode >= 400 ? 'failure' : 'success',
      apiUrl: req.originalUrl,
      httpMethod: req.method,
      responseCode: res.statusCode,
      durationMs: latencyMs,
      requestBody: reqBody ? JSON.stringify(reqBody).substring(0, 5000) : null,
      responseBody: respBody ? JSON.stringify(respBody).substring(0, 5000) : null,
    });
  } catch (err) {
    // Silently fail to avoid disrupting request flow
  }
}
