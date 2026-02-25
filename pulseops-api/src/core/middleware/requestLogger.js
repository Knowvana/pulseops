// ============================================================================
// Request Logger Middleware — PulseOps API
//
// PURPOSE: Logs every incoming HTTP request with method, URL, status code,
// and latency. Captures request/response bodies for API logging.
// Persists logs to database asynchronously.
// ============================================================================
import logger, { msg, logMessages } from '../logger.js';
import { SystemLog } from '../database/models/index.js';

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
    // Skip logging for health checks and docs
    if (req.originalUrl.includes('/health') || req.originalUrl.includes('/docs')) {
      return;
    }

    await SystemLog.create({
      timestamp: new Date(),
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
