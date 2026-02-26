// ============================================================================
// Database Routes — PulseOps API
//
// PURPOSE: Database management endpoints for admin users. Includes
// connection testing, schema status, sync (core tables only), stats,
// data seeding, and wipe (DROP ALL tables).
//
// ENDPOINTS:
//   GET  /api/database/test-connection  — Test DB connectivity
//   GET  /api/database/schema-status    — Check if schema is initialized
//   POST /api/database/create-schema    — Create CORE system_* tables only
//   POST /api/database/sync             — Alias for create-schema
//   GET  /api/database/stats            — Table and row counts
//   POST /api/database/load-default-data — Seed default admin user
//   POST /api/database/load-demo-data   — Seed demo users
//   POST /api/database/wipe             — DROP ALL tables (destructive)
//   GET  /api/database/schema-info      — Get details of what will be created
//   GET  /api/database/default-data-info — Get details of default data
// ============================================================================
import { Router } from 'express';
import sequelize, { testConnection } from '#core/database/sequelize.js';
import models, {
  User, SystemConfig, SystemLog, SystemModule,
} from '#core/database/models/index.js';
import { authenticate, authorize } from '#core/middleware/auth.js';
import logger, { logMessages } from '#core/logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const appConfig = require('#config/app.json');

const router = Router();

// Core system models — ONLY these are synced via Initialize Database
const CORE_MODELS = [
  { model: User, tableName: 'system_users', description: 'Platform users with roles and bcrypt passwords' },
  { model: SystemConfig, tableName: 'system_config', description: 'Key-value configuration store' },
  { model: SystemLog, tableName: 'system_logs', description: 'System and API log entries' },
  { model: SystemModule, tableName: 'system_modules', description: 'Module registry and state' },
];

/**
 * Helper: Get column info for a Sequelize model.
 */
function getModelColumns(model) {
  const attrs = model.rawAttributes || {};
  return Object.entries(attrs).map(([name, def]) => ({
    name,
    type: def.type?.key || def.type?.constructor?.name || 'UNKNOWN',
    allowNull: def.allowNull !== false,
    primaryKey: !!def.primaryKey,
    defaultValue: def.defaultValue !== undefined ? String(def.defaultValue) : null,
  }));
}

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
    // First test connection
    const connTest = await testConnection();
    if (!connTest.success) {
      return res.json({
        success: true,
        data: {
          connected: false,
          initialized: false,
          tables: [],
          required: CORE_MODELS.map(m => m.tableName),
          tableCount: 0,
          hasDefaultData: false,
          userCount: 0,
          activeUserCount: 0,
          inactiveUserCount: 0,
        },
      });
    }

    const [results] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const tableNames = results.map(r => r.table_name);
    const requiredTables = CORE_MODELS.map(m => m.tableName);
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
        connected: true,
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
 * GET /database/schema-info — Returns details of tables that will be created
 */
router.get('/schema-info', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const tables = CORE_MODELS.map(entry => ({
      tableName: entry.tableName,
      description: entry.description,
      columns: getModelColumns(entry.model),
    }));
    res.json({ success: true, data: { tables, totalTables: tables.length } });
  } catch (err) { next(err); }
});

/**
 * GET /database/default-data-info — Returns details of default data that will be seeded
 */
router.get('/default-data-info', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const info = {
      items: [
        {
          type: 'user',
          table: 'system_users',
          description: 'Default platform admin user',
          details: {
            name: appConfig.defaultAdmin.name,
            email: appConfig.defaultAdmin.email,
            role: appConfig.defaultAdmin.role,
            status: 'active',
          },
        },
        {
          type: 'modules',
          table: 'system_modules',
          description: 'Module registry records from modules.json',
          details: {
            note: 'Module records are seeded automatically on server startup. This ensures modules are registered in the database.',
          },
        },
      ],
    };
    res.json({ success: true, data: info });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/create-schema:
 *   post:
 *     tags: [Database]
 *     summary: Create CORE system_* tables only (module tables are created from Module Management)
 *     responses:
 *       200: { description: Core schema created with details }
 */
router.post('/create-schema', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Test connection first
    const connTest = await testConnection();
    if (!connTest.success) {
      return res.status(503).json({
        success: false,
        error: { message: 'Database connection failed. Configure the database first.', code: 'DB_CONNECTION_FAILED' },
      });
    }

    logger.info(logMessages.database.syncing);

    const createdTables = [];
    for (const entry of CORE_MODELS) {
      await entry.model.sync({ alter: true });
      const columns = getModelColumns(entry.model);
      createdTables.push({
        tableName: entry.tableName,
        description: entry.description,
        columnCount: columns.length,
        columns: columns.map(c => c.name),
        status: 'created',
      });
    }

    logger.info(logMessages.database.schemaCreated);

    // Log this action
    try {
      await SystemLog.create({
        level: 'info',
        source: 'System',
        event: 'Schema Initialization',
        message: `Core schema initialized: ${createdTables.length} tables created`,
        userId: req.user.id,
        userEmail: req.user.email,
        result: 'success',
        metadata: { tables: createdTables.map(t => t.tableName) },
      });
    } catch (_) {}

    res.json({
      success: true,
      data: {
        message: 'Core database schema initialized successfully',
        tablesCreated: createdTables.length,
        tables: createdTables,
        note: 'Module-specific tables are created from the Module Management section when a module is enabled.',
      },
    });
  } catch (err) { next(err); }
});

/**
 * POST /database/sync — Alias for create-schema (used by frontend)
 */
router.post('/sync', authenticate, authorize('admin'), async (req, res, next) => {
  // Delegate to create-schema handler
  req.url = '/create-schema';
  router.handle(req, res, next);
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
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
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
 * POST /database/load-default-data — Seed default admin user and module registry
 */
router.post('/load-default-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.seedingDefault);
    const seededItems = [];

    // Seed default admin user
    const [user, userCreated] = await User.findOrCreate({
      where: { email: appConfig.defaultAdmin.email },
      defaults: {
        name: appConfig.defaultAdmin.name,
        password: appConfig.defaultAdmin.password,
        role: appConfig.defaultAdmin.role,
        status: 'active',
      },
    });
    seededItems.push({
      type: 'user',
      table: 'system_users',
      name: appConfig.defaultAdmin.name,
      email: appConfig.defaultAdmin.email,
      role: appConfig.defaultAdmin.role,
      created: userCreated,
      status: userCreated ? 'created' : 'already_exists',
    });

    // Seed module registry from modules.json
    try {
      const modulesConfig = require('#config/modules.json');
      for (const mod of modulesConfig.modules) {
        const [record, modCreated] = await SystemModule.findOrCreate({
          where: { moduleId: mod.moduleId },
          defaults: {
            name: mod.name,
            description: mod.description,
            version: mod.version,
            enabled: mod.enabled,
            initialized: mod.initialized,
            isCore: mod.isCore,
            requiredTables: mod.requiredTables,
            roles: mod.roles,
            order: mod.order,
            schemaVersion: mod.schemaVersion,
          },
        });
        seededItems.push({
          type: 'module',
          table: 'system_modules',
          name: mod.name,
          moduleId: mod.moduleId,
          created: modCreated,
          status: modCreated ? 'created' : 'already_exists',
        });
      }
    } catch (_) {}

    logger.info(logMessages.database.seedComplete);

    // Log this action
    try {
      await SystemLog.create({
        level: 'info',
        source: 'System',
        event: 'Default Data Loaded',
        message: `Default data loaded: ${seededItems.filter(i => i.created).length} new items`,
        userId: req.user.id,
        userEmail: req.user.email,
        result: 'success',
        metadata: { items: seededItems },
      });
    } catch (_) {}

    res.json({
      success: true,
      data: {
        message: 'Default data loaded successfully',
        totalItems: seededItems.length,
        newItems: seededItems.filter(i => i.created).length,
        items: seededItems,
      },
    });
  } catch (err) { next(err); }
});

router.post('/load-demo-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.seedingDemo);
    const seededItems = [];
    const demoUsers = [
      { name: 'Jane Manager', email: 'manager@pulseops.local', password: 'manager123', role: 'manager', status: 'active' },
      { name: 'John User', email: 'user@pulseops.local', password: 'user123', role: 'user', status: 'active' },
    ];
    for (const u of demoUsers) {
      const [, created] = await User.findOrCreate({ where: { email: u.email }, defaults: u });
      seededItems.push({ type: 'user', name: u.name, email: u.email, role: u.role, created, status: created ? 'created' : 'already_exists' });
    }
    logger.info(logMessages.database.seedComplete);
    res.json({ success: true, data: { message: 'Demo data loaded successfully', items: seededItems } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /database/wipe:
 *   post:
 *     tags: [Database]
 *     summary: DROP ALL tables from the database (destructive — removes everything)
 *     responses:
 *       200: { description: All tables dropped }
 */
router.post('/wipe', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info(logMessages.database.wipeStarted);

    // Get all existing tables before dropping
    const [existingTables] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const tableNames = existingTables.map(r => r.table_name);

    if (tableNames.length === 0) {
      return res.json({ success: true, data: { message: 'No tables to drop', droppedTables: [], droppedCount: 0 } });
    }

    // Drop ALL tables using CASCADE to handle foreign keys
    await sequelize.query('SET session_replication_role = replica;');
    const droppedTables = [];
    for (const tableName of tableNames) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        droppedTables.push({ tableName, status: 'dropped' });
      } catch (dropErr) {
        droppedTables.push({ tableName, status: 'error', error: dropErr.message });
      }
    }
    await sequelize.query('SET session_replication_role = DEFAULT;');

    // Drop any remaining enum types
    try {
      const [enums] = await sequelize.query(
        "SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e'"
      );
      for (const e of enums) {
        await sequelize.query(`DROP TYPE IF EXISTS "${e.typname}" CASCADE`);
      }
    } catch (_) {}

    logger.info(logMessages.database.wipeComplete);

    res.json({
      success: true,
      data: {
        message: 'All database tables dropped successfully. Database is now empty.',
        droppedCount: droppedTables.filter(t => t.status === 'dropped').length,
        droppedTables,
        note: 'Use Initialize Database to recreate the core schema.',
      },
    });
  } catch (err) { next(err); }
});

export default router;
