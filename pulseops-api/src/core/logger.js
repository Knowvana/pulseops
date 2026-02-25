// ============================================================================
// Logger — PulseOps API
//
// PURPOSE: Centralized structured logging via Winston. All log messages
// are template strings from logs.json — NO inline log messages.
//
// ARCHITECTURE: Singleton Winston instance. Reads config from logs.json.
// Provides a helper to interpolate template strings with params.
// ============================================================================
import winston from 'winston';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const logsConfig = require('../config/logs.json');

const logger = winston.createLogger({
  level: logsConfig.config.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logsConfig.config.format === 'json'
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) =>
          `${timestamp} [${level.toUpperCase()}] ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`
        )
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Interpolate a log message template with parameters.
 * @param {string} template - Message template from logs.json (e.g. "Server started on port {port}")
 * @param {Object} params - Key-value pairs for interpolation
 * @returns {string}
 */
export function msg(template, params = {}) {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

export const logMessages = logsConfig.messages;
export default logger;
