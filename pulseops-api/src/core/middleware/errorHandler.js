// ============================================================================
// Error Handler Middleware — PulseOps API
//
// PURPOSE: Global error handler. Catches unhandled errors from routes and
// middleware, logs them, and returns a standardized JSON error response.
// ============================================================================
import logger from '#core/logger.js';

export default function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error('Unhandled error', {
    statusCode,
    message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 ? 'Internal server error' : message,
      code: err.code || 'SERVER_ERROR',
    },
  });
}
