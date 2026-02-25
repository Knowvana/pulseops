// ============================================================================
// Database Routes — PulseOps API
//
// PURPOSE: Database management endpoints for admin users. Includes
// connection testing, schema status, sync, stats, data seeding, and wipe.
//
// ENDPOINTS:
//   GET  /api/database/test-connection  — Test DB connectivity
//   GET  /api/database/schema-status    — Check if schema is initialized
//   POST /api/database/create-schema    — Sync all models (create tables)
//   GET  /api/database/stats            — Table and row counts
//   POST /api/database/load-demo-data   — Seed demo data
//   POST /api/database/wipe             — Delete all data (destructive)
// ============================================================================
import { Router } from 'express';
import sequelize, { testConnection } from '../database/sequelize.js';
import models, { User, SystemConfig, RosterSchedule, RosterConfig } from '../database/models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger, { logMessages } from '../logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const appConfig = require('../../config/app.json');

const router = Router();

/**
 * @swagger
 * /database/test-connection:
 *   get:
 *     tags: [Database]
 *     summary: Test database connectivity
 *     responses:
 *       200: { description: Connection test result }
 */
router.get('/test-connection', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await testConnection();
    const statusCode = result.success ? 200 : 503;
    res.status(statusCode).json({
      success: result.success,
      data: {
        connected: result.success,
        latencyMs: result.latencyMs,
        dbVersion: result.dbVersion || null,
        dbSystemTime: result.dbSystemTime || null,
        error: result.error,
        message: result.success 
          ? 'Database connection successful' 
          : 'Database connection failed. Ensure PostgreSQL is running and accessible.',
      },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/schema-status:
 *   get:
 *     tags: [Database]
 *     summary: Check if database schema is initialized
 *     responses:
 *       200: { description: Schema status }
 */
router.get('/schema-status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [results] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const tableNames = results.map(r => r.table_name);
    const requiredTables = ['users', 'system_config', 'roster_schedules', 'roster_config'];
    const initialized = requiredTables.every(t => tableNames.includes(t));

    let hasDefaultData = false;
    let userCount = 0;
    let activeUserCount = 0;
    let inactiveUserCount = 0;
    if (initialized) {
      try {
        userCount = await User.count();
        activeUserCount = await User.count({ where: { status: 'active' } });
        inactiveUserCount = userCount - activeUserCount;
        hasDefaultData = userCount > 0;
      } catch (_) {}
    }

    res.json({
      success: true,
      data: {
        initialized,
        tables: tableNames,
        required: requiredTables,
        tableCount: tableNames.length,
        hasDefaultData,
        userCount,
        activeUserCount,
        inactiveUserCount,
      },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/create-schema:
 *   post:
 *     tags: [Database]
 *     summary: Synchronize Sequelize models to create/update tables
 *     responses:
 *       200: { description: Schema created }
 */
router.post('/create-schema', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.syncing);
    await sequelize.sync({ alter: true });
    logger.info(logMessages.database.schemaCreated);

    const userCount = await User.count();
    if (userCount === 0) {
      logger.info(logMessages.database.seedingDefault);
      await User.create({
        name: appConfig.defaultAdmin.name,
        email: appConfig.defaultAdmin.email,
        password: appConfig.defaultAdmin.password,
        role: appConfig.defaultAdmin.role,
        status: 'active',
      });
      logger.info(logMessages.database.seedComplete);
    }

    res.json({ success: true, data: { message: 'Schema synchronized successfully' } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/stats:
 *   get:
 *     tags: [Database]
 *     summary: Get database table and row statistics
 *     responses:
 *       200: { description: Database statistics }
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      logger.warn('Database stats requested but connection failed', { error: connectionTest.error });
      return res.status(503).json({
        success: false,
        error: {
          message: 'Database connection failed. Ensure PostgreSQL is running and accessible.',
          code: 'DB_CONNECTION_FAILED',
          details: connectionTest.error,
        },
      });
    }

    const [results] = await sequelize.query(
      "SELECT schemaname, relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE schemaname = 'public'"
    );
    const tableCount = results.length;
    const totalRows = results.reduce((sum, r) => sum + parseInt(r.row_count || 0), 0);

    let userCount = 0;
    let activeUserCount = 0;
    let inactiveUserCount = 0;
    let logCount = 0;
    let configCount = 0;
    try {
      userCount = await User.count();
      activeUserCount = await User.count({ where: { status: 'active' } });
      inactiveUserCount = userCount - activeUserCount;
      configCount = await SystemConfig.count();
    } catch (_) {}

    res.json({
      success: true,
      data: {
        tableCount,
        totalRows,
        userCount,
        activeUserCount,
        inactiveUserCount,
        logCount,
        configCount,
        details: results,
      },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/load-demo-data:
 *   post:
 *     tags: [Database]
 *     summary: Load demo/sample data into the database
 *     responses:
 *       200: { description: Demo data loaded }
 */
/**
 * POST /database/sync — Alias for create-schema (used by frontend SettingsDbObjects)
 */
router.post('/sync', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.syncing);
    await sequelize.sync({ alter: true });
    logger.info(logMessages.database.schemaCreated);

    const userCount = await User.count();
    if (userCount === 0) {
      logger.info(logMessages.database.seedingDefault);
      await User.create({
        name: appConfig.defaultAdmin.name,
        email: appConfig.defaultAdmin.email,
        password: appConfig.defaultAdmin.password,
        role: appConfig.defaultAdmin.role,
        status: 'active',
      });
      logger.info(logMessages.database.seedComplete);
    }

    res.json({ success: true, data: { message: 'Database synchronized successfully' } });
  } catch (err) { next(err); }
});

/**
 * POST /database/load-default-data — Seed default admin user
 */
router.post('/load-default-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.seedingDefault);
    const [user, created] = await User.findOrCreate({
      where: { email: appConfig.defaultAdmin.email },
      defaults: {
        name: appConfig.defaultAdmin.name,
        password: appConfig.defaultAdmin.password,
        role: appConfig.defaultAdmin.role,
        status: 'active',
      },
    });
    if (!created) {
      logger.info('Default admin user already exists, skipping seed');
    }
    logger.info(logMessages.database.seedComplete);
    res.json({ success: true, data: { message: 'Default data loaded successfully', created } });
  } catch (err) { next(err); }
});

router.post('/load-demo-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.seedingDemo);
    const demoUsers = [
      { name: 'Jane Manager', email: 'manager@pulseops.local', password: 'manager123', role: 'manager', status: 'active' },
      { name: 'John User', email: 'user@pulseops.local', password: 'user123', role: 'user', status: 'active' },
    ];
    for (const u of demoUsers) {
      await User.findOrCreate({ where: { email: u.email }, defaults: u });
    }
    logger.info(logMessages.database.seedComplete);
    res.json({ success: true, data: { message: 'Demo data loaded successfully' } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/wipe:
 *   post:
 *     tags: [Database]
 *     summary: Wipe all data from all tables (destructive)
 *     responses:
 *       200: { description: Data wiped }
 */
router.post('/wipe', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.wipeStarted);
    await RosterSchedule.destroy({ where: {}, truncate: true, cascade: true });
    await RosterConfig.destroy({ where: {}, truncate: true, cascade: true });
    await SystemConfig.destroy({ where: {}, truncate: true, cascade: true });
    await User.destroy({ where: {}, truncate: true, cascade: true });
    logger.info(logMessages.database.wipeComplete);
    res.json({ success: true, data: { message: 'All data wiped successfully' } });
  } catch (err) { next(err); }
});

export default router;
