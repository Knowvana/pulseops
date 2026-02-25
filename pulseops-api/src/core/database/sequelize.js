// ============================================================================
// Sequelize Instance — PulseOps API
//
// PURPOSE: Creates and exports the singleton Sequelize ORM connection.
// All connection parameters are read from database.json config.
//
// ARCHITECTURE: Single connection pool shared across all models and routes.
// Supports environment variable overrides for Kubernetes deployments.
// ============================================================================
import { Sequelize } from 'sequelize';
import { createRequire } from 'module';
import logger, { msg, logMessages } from '../logger.js';

const require = createRequire(import.meta.url);
const dbConfig = require('../../config/database.json');

const sequelize = new Sequelize(
  process.env.DB_NAME || dbConfig.database,
  process.env.DB_USER || dbConfig.username,
  process.env.DB_PASS || dbConfig.password,
  {
    host: process.env.DB_HOST || dbConfig.host,
    port: process.env.DB_PORT || dbConfig.port,
    dialect: dbConfig.dialect,
    schema: dbConfig.schema,
    pool: dbConfig.pool,
    logging: dbConfig.logging ? (sql) => logger.debug(sql) : false,
    dialectOptions: dbConfig.ssl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  }
);

export async function testConnection() {
  const start = Date.now();
  try {
    await sequelize.authenticate();
    const latencyMs = Date.now() - start;
    logger.info(logMessages.database.connected, { latencyMs });
    return { success: true, latencyMs };
  } catch (err) {
    logger.error(logMessages.database.connectionFailed, { error: err.message });
    return { success: false, error: err.message };
  }
}

export default sequelize;
