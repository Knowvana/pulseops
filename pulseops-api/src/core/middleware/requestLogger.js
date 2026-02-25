// ============================================================================
// Request Logger Middleware — PulseOps API
//
// PURPOSE: Logs every incoming HTTP request with method, URL, status code,
// and latency. All messages use templates from logs.json.
// ============================================================================
import logger, { msg, logMessages } from '../logger.js';

export default function requestLogger(req, res, next) {
  const start = Date.now();

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
  });

  next();
}
