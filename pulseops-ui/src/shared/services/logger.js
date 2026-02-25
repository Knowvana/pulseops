// ============================================================================
// Logger Service — PulseOps UI
//
// PURPOSE: Centralized, structured logging for the frontend application.
// All log messages are read from logs.json — NO inline log messages.
// Maintains separate system and API log buffers with subscriber pattern.
//
// ARCHITECTURE: Singleton service imported via '@shared'. Supports log levels
// (debug, info, warn, error). Stores logs in circular buffers.
// Subscribers are notified on every new entry (for RightPanel, LogsViewer).
//
// USAGE:
//   import { Logger } from '@shared';
//   Logger.info('ModuleName', 'Action description', { userId });
// ============================================================================
import logsConfig from '@shared/config/logs.json';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL_NAMES = ['debug', 'info', 'warn', 'error'];

let _idCounter = 0;
function nextId() { return `log_${Date.now()}_${++_idCounter}`; }

class LoggerService {
  constructor() {
    this._systemLogs = [];
    this._apiLogs = [];
    this._subscribers = new Set();
    this._config = {
      minLevel: logsConfig.config?.minLevel || 'debug',
      maxBufferSize: logsConfig.config?.maxBufferSize || 500,
      consoleOutput: logsConfig.config?.enableConsole ?? true,
      captureApiCalls: true,
      captureTimestamps: true,
      flushIntervalSeconds: 60,
      flushThreshold: 50,
    };
    this._user = null;
  }

  getConfig() { return { ...this._config }; }
  updateConfig(cfg) { this._config = { ...this._config, ...cfg }; }
  getLogLevels() { return LOG_LEVEL_NAMES; }
  setUser(user) { this._user = user; }
  getUser() { return this._user; }

  getSystemLogs() { return [...this._systemLogs]; }
  getApiLogs() { return [...this._apiLogs]; }

  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  _notify() {
    this._subscribers.forEach((fn) => { try { fn(); } catch (_) {} });
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[this._config.minLevel || 'info'];
  }

  _addSystemEntry(level, source, message, data = null) {
    if (!this._shouldLog(level)) return;

    const entry = {
      id: nextId(),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      data,
      user: this._user?.email || this._user?.name || 'system',
      result: level === 'error' ? 'failure' : level === 'warn' ? 'warning' : 'success',
    };

    this._systemLogs.unshift(entry);
    if (this._systemLogs.length > this._config.maxBufferSize) {
      this._systemLogs.pop();
    }

    if (this._config.consoleOutput) {
      const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;
      consoleFn(`[${level.toUpperCase()}] [${source}] ${message}`, data || '');
    }

    this._notify();
  }

  debug(source, message, data) { this._addSystemEntry('debug', source, message, data); }
  info(source, message, data) { this._addSystemEntry('info', source, message, data); }
  warn(source, message, data) { this._addSystemEntry('warn', source, message, data); }
  error(source, message, data) { this._addSystemEntry('error', source, message, data); }

  logApiCall({ method, url, path, statusCode, durationMs, success, requestPayload, responsePayload, user }) {
    if (!this._config.captureApiCalls) return;

    const entry = {
      id: nextId(),
      timestamp: new Date().toISOString(),
      method: method || 'GET',
      url: url || path || '',
      path: path || url || '',
      statusCode: statusCode || 0,
      durationMs: durationMs || 0,
      success: success !== false,
      requestPayload: requestPayload || null,
      responsePayload: responsePayload || null,
      user: user || this._user?.email || 'system',
    };

    this._apiLogs.unshift(entry);
    if (this._apiLogs.length > this._config.maxBufferSize) {
      this._apiLogs.pop();
    }

    this._notify();
  }

  clearSystemLogs() { this._systemLogs = []; this._notify(); }
  clearApiLogs() { this._apiLogs = []; this._notify(); }
  clearAll() { this._systemLogs = []; this._apiLogs = []; this._notify(); }
}

const Logger = new LoggerService();
export default Logger;
