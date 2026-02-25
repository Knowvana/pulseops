// ============================================================================
// Server Entry Point — PulseOps API
//
// PURPOSE: Starts the Express server, connects to the database, syncs
// models, and handles graceful shutdown for Kubernetes deployments.
//
// ARCHITECTURE: Imports the app factory, initializes the database,
// starts listening, and registers SIGTERM/SIGINT handlers for clean
// pod termination. All config from JSON files.
// ============================================================================
import { createRequire } from 'module';
import createApp from './app.js';
import sequelize from './core/database/sequelize.js';
import models from './core/database/models/index.js';
import logger, { msg, logMessages } from './core/logger.js';

const require = createRequire(import.meta.url);
const appConfig = require('./config/app.json');

const PORT = process.env.PORT || appConfig.port;

async function startServer() {
  try {
    // --- Connect to database ---
    logger.info(logMessages.database.connecting);
    await sequelize.authenticate();
    logger.info(logMessages.database.connected);

    // --- Sync models (create tables if not exist) ---
    logger.info(logMessages.database.syncing);
    await sequelize.sync({ alter: false });
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
