// ============================================================================
// Health Routes — PulseOps API
//
// PURPOSE: Kubernetes readiness, liveness, and general health probes.
// All endpoints are public (no authentication required).
//
// ENDPOINTS:
//   GET /api/health           — General health check
//   GET /api/health/liveness  — K8s liveness probe
//   GET /api/health/readiness — K8s readiness probe (includes DB check)
// ============================================================================
import { Router } from 'express';
import { testConnection } from '../database/sequelize.js';
import logger, { logMessages } from '../logger.js';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: General health check
 *     security: []
 *     responses:
 *       200: { description: Service is healthy }
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     tags: [Health]
 *     summary: Kubernetes liveness probe
 *     security: []
 *     responses:
 *       200: { description: Process is alive }
 */
router.get('/liveness', (req, res) => {
  res.json({ success: true, data: { status: 'alive' } });
});

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     tags: [Health]
 *     summary: Kubernetes readiness probe (includes database connectivity)
 *     security: []
 *     responses:
 *       200: { description: Service is ready }
 *       503: { description: Service is not ready }
 */
router.get('/readiness', async (req, res) => {
  const dbResult = await testConnection();
  if (dbResult.success) {
    logger.debug(logMessages.database.healthOk);
    res.json({ success: true, data: { status: 'ready', database: 'connected', latencyMs: dbResult.latencyMs } });
  } else {
    logger.warn(logMessages.database.healthFail, { error: dbResult.error });
    res.status(503).json({ success: false, data: { status: 'not_ready', database: 'disconnected', error: dbResult.error } });
  }
});

export default router;
