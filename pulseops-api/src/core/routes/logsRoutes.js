// ============================================================================
// Logs Routes — PulseOps API
//
// PURPOSE: API endpoints for system and API log management. Handles log
// persistence to database, retrieval, filtering, and cleanup.
//
// ENDPOINTS:
//   GET  /api/logs/system         — Get system logs with filters
//   GET  /api/logs/api            — Get API call logs with filters
//   POST /api/logs/system         — Create system log entry
//   POST /api/logs/api            — Create API log entry
//   DELETE /api/logs/system       — Delete system logs
//   DELETE /api/logs/api          — Delete API logs
// ============================================================================
import { Router } from 'express';
import { Op } from 'sequelize';
import { SystemLog } from '../database/models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger, { logMessages } from '../logger.js';

const router = Router();

/**
 * GET /logs/system — Retrieve system logs with filtering and pagination
 */
router.get('/system', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { level, source, event, userId, limit = 100, offset = 0, search } = req.query;
    const where = {};

    if (level) where.level = level;
    if (source) where.source = source;
    if (event) where.event = event;
    if (userId) where.userId = userId;

    if (search) {
      where[Op.or] = [
        { message: { [Op.iLike]: `%${search}%` } },
        { event: { [Op.iLike]: `%${search}%` } },
        { userEmail: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await SystemLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /logs/api — Retrieve API call logs with filtering and pagination
 */
router.get('/api', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { httpMethod, responseCode, userId, limit = 100, offset = 0, search } = req.query;
    const where = { source: 'API' };

    if (httpMethod) where.httpMethod = httpMethod;
    if (responseCode) where.responseCode = parseInt(responseCode);
    if (userId) where.userId = userId;

    if (search) {
      where[Op.or] = [
        { apiUrl: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
        { userEmail: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await SystemLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) { next(err); }
});

/**
 * POST /logs/system — Create a system log entry
 */
router.post('/system', authenticate, async (req, res, next) => {
  try {
    const { level, source, event, message, result, metadata } = req.body;

    const log = await SystemLog.create({
      timestamp: new Date(),
      level: level || 'info',
      source: source || 'UI',
      event: event || 'Unknown',
      message: message || '',
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      result: result || 'success',
      metadata: metadata || null,
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (err) { next(err); }
});

/**
 * POST /logs/api — Create an API log entry
 */
router.post('/api', authenticate, async (req, res, next) => {
  try {
    const {
      httpMethod,
      apiUrl,
      responseCode,
      durationMs,
      requestBody,
      responseBody,
      message,
      result,
    } = req.body;

    const log = await SystemLog.create({
      timestamp: new Date(),
      level: responseCode >= 400 ? 'error' : responseCode >= 300 ? 'warn' : 'info',
      source: 'API',
      event: `${httpMethod} ${apiUrl}`,
      message: message || `API call to ${apiUrl}`,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      result: result || (responseCode >= 400 ? 'failure' : 'success'),
      apiUrl: apiUrl || null,
      httpMethod: httpMethod || null,
      responseCode: responseCode || null,
      durationMs: durationMs || null,
      requestBody: requestBody || null,
      responseBody: responseBody || null,
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (err) { next(err); }
});

/**
 * DELETE /logs/system — Delete system logs (admin only)
 */
router.delete('/system', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { olderThanDays = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

    const result = await SystemLog.destroy({
      where: {
        source: { [Op.ne]: 'API' },
        timestamp: { [Op.lt]: cutoffDate },
      },
    });

    logger.info('System logs cleanup completed', { deletedCount: result, olderThanDays });

    res.json({
      success: true,
      data: {
        message: `Deleted ${result} system logs older than ${olderThanDays} days`,
        deletedCount: result,
      },
    });
  } catch (err) { next(err); }
});

/**
 * DELETE /logs/api — Delete API logs (admin only)
 */
router.delete('/api', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { olderThanDays = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

    const result = await SystemLog.destroy({
      where: {
        source: 'API',
        timestamp: { [Op.lt]: cutoffDate },
      },
    });

    logger.info('API logs cleanup completed', { deletedCount: result, olderThanDays });

    res.json({
      success: true,
      data: {
        message: `Deleted ${result} API logs older than ${olderThanDays} days`,
        deletedCount: result,
      },
    });
  } catch (err) { next(err); }
});

export default router;
