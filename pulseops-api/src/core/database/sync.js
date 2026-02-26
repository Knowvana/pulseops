// ============================================================================
// Database Sync Utility — PulseOps API
//
// PURPOSE: Standalone script to synchronize Sequelize models with the
// PostgreSQL database. Creates tables if they don't exist. Seeds the
// default admin user if no users exist.
//
// USAGE: node src/core/database/sync.js
// ============================================================================
import sequelize from '#core/database/sequelize.js';
import models from '#core/database/models/index.js';
import logger, { logMessages } from '#core/logger.js';
import { createRequire } from 'module';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const appConfig = require('#config/app.json');

async function syncDatabase() {
  try {
    logger.info(logMessages.database.connecting);
    await sequelize.authenticate();
    logger.info(logMessages.database.connected);

    logger.info(logMessages.database.syncing);
    await sequelize.sync({ alter: true });
    logger.info(logMessages.database.synced);

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

    logger.info('Database sync complete.');
    process.exit(0);
  } catch (err) {
    logger.error(logMessages.database.syncFailed, { error: err.message });
    process.exit(1);
  }
}

syncDatabase();
