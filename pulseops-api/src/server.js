// ============================================================================
// Server Entry Point — PulseOps API
//
// PURPOSE: Starts the Express server, connects to the database, syncs
// CORE system tables only, seeds default data, and handles graceful
// shutdown for Kubernetes deployments.
//
// ARCHITECTURE: On startup, ONLY core system tables (system_users,
// system_config, system_logs, system_modules) are created. Module-specific
// tables are created on-demand when a module is enabled via the StepWizard.
// This ensures clean separation between core platform and modules.
//
// STARTUP FLOW:
//   1. Connect to PostgreSQL
//   2. Sync CORE models only (User, SystemConfig, SystemLog, SystemModule)
//   3. Seed default admin user if none exists
//   4. Seed module registry records from modules.json
//   5. Start Express server
//   6. Register graceful shutdown handlers (SIGTERM/SIGINT)
//
// USED BY: Entry point — run via `node src/server.js` or `npm start`
// ============================================================================
import { createRequire } from 'module';
import createApp from './app.js';
import sequelize from '#core/database/sequelize.js';
import models from '#core/database/models/index.js';
import logger, { msg, logMessages } from '#core/logger.js';

const require = createRequire(import.meta.url);
const appConfig = require('#config/app.json');
const modulesConfig = require('#config/modules.json');

const PORT = process.env.PORT || appConfig.port;

// Core system models — ONLY these are synced on startup
const CORE_MODELS = [
  models.User,
  models.SystemConfig,
  models.SystemLog,
  models.SystemModule,
];

/**
 * Seed module registry records from modules.json into system_modules table.
 * Uses findOrCreate to avoid duplicates across pod restarts.
 */
async function seedModuleRegistry() {
  logger.info(logMessages.modules.seedingModules);
  for (const mod of modulesConfig.modules) {
    const [record, created] = await models.SystemModule.findOrCreate({
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
    if (!created) {
      // Update non-destructive fields (don't override enabled/initialized which are runtime state)
      record.name = mod.name;
      record.description = mod.description;
      record.version = mod.version;
      record.requiredTables = mod.requiredTables;
      record.roles = mod.roles;
      record.order = mod.order;
      record.isCore = mod.isCore;
      await record.save();
    }
  }
  logger.info(logMessages.modules.modulesSeedComplete);
}

async function startServer() {
  try {
    // --- Connect to database ---
    logger.info(logMessages.database.connecting);
    await sequelize.authenticate();
    logger.info(logMessages.database.connected);

    // --- Sync CORE models only (create tables if not exist) ---
    logger.info(logMessages.database.syncing);
    for (const Model of CORE_MODELS) {
      await Model.sync({ alter: false });
    }
    logger.info(logMessages.database.synced);

    // --- Seed default admin if no users exist ---
    const userCount = await models.User.count();
    if (userCount === 0) {
      logger.info(logMessages.database.seedingDefault);
      await models.User.create({
        name: appConfig.defaultAdmin.name,
        email: appConfig.defaultAdmin.email,
        password: appConfig.defaultAdmin.password,
        role: appConfig.defaultAdmin.role,
        status: 'active',
      });
      logger.info(logMessages.database.seedComplete);
    }

    // --- Seed module registry ---
    await seedModuleRegistry();

    // --- Start Express ---
    const app = createApp();
    const server = app.listen(PORT, () => {
      logger.info(msg(logMessages.server.started, { port: PORT }));
      logger.info(`Swagger UI: http://localhost:${PORT}/api/docs`);
    });

    // --- Graceful Shutdown (Kubernetes) ---
    const shutdown = async (signal) => {
      logger.info(msg(logMessages.server.shutdownSignal, { signal }));
      server.close(async () => {
        try {
          await sequelize.close();
          logger.info(logMessages.server.shutdownComplete);
          process.exit(0);
        } catch (err) {
          logger.error(logMessages.server.shutdownError, { error: err.message });
          process.exit(1);
        }
      });
      setTimeout(() => { process.exit(1); }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error(logMessages.database.connectionFailed, { error: err.message });
    logger.info('Server will start without database. Some features will be unavailable.');

    const app = createApp();
    const server = app.listen(PORT, () => {
      logger.info(msg(logMessages.server.started, { port: PORT }));
      logger.warn('Running in degraded mode — database not connected.');
      logger.info(`Swagger UI: http://localhost:${PORT}/api/docs`);
    });

    const shutdown = (signal) => {
      logger.info(msg(logMessages.server.shutdownSignal, { signal }));
      server.close(() => { process.exit(0); });
      setTimeout(() => { process.exit(1); }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

startServer();
