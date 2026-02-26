// ============================================================================
// Config Routes — PulseOps API
//
// PURPOSE: System configuration CRUD endpoints. Admin-only.
// Stores key-value pairs in the system_config table.
//
// ENDPOINTS:
//   GET    /api/config         — List all config entries
//   GET    /api/config/:key    — Get config by key
//   PUT    /api/config/:key    — Upsert config by key
//   DELETE /api/config/:key    — Delete config by key
// ============================================================================
import { Router } from 'express';
import { SystemConfig } from '#core/database/models/index.js';
import { authenticate, authorize } from '#core/middleware/auth.js';
import logger, { logMessages } from '#core/logger.js';

const router = Router();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '../../config');

function readJsonConfig(filename) {
  try {
    const filePath = path.join(CONFIG_DIR, filename);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {}
  return null;
}

function writeJsonConfig(filename, data) {
  const filePath = path.join(CONFIG_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Helpers: Dual-write (file + DB) for K8s persistence ─────────────────────

async function persistToDb(key, value, category = 'system') {
  try {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await SystemConfig.upsert({ key, value: jsonValue, category });
  } catch (_) {
    // DB may not be initialized yet — file-only fallback is acceptable
  }
}

async function readFromDb(key) {
  try {
    const record = await SystemConfig.findOne({ where: { key } });
    if (record?.value) {
      try { return JSON.parse(record.value); } catch (_) { return record.value; }
    }
  } catch (_) {
    // DB unavailable — fall through to file
  }
  return null;
}

async function readConfig(key, filename, fallback = {}) {
  const dbValue = await readFromDb(key);
  if (dbValue) return dbValue;
  return readJsonConfig(filename) || fallback;
}

async function writeConfig(key, filename, data) {
  writeJsonConfig(filename, data);
  await persistToDb(key, data);
}

// ─── Database Config ──────────────────────────────────────────────────────────

router.post('/database', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { host, port, database, username, password, ssl } = req.body;
    const existing = await readConfig('config:database', 'database.json', {});
    const updated = {
      ...existing,
      host: host || existing.host,
      port: port || existing.port,
      database: database || existing.database,
      username: username || existing.username,
      ssl: ssl !== undefined ? ssl : existing.ssl,
    };
    if (password) {
      updated.passwordHash = await bcrypt.hash(password, 10);
    }
    await writeConfig('config:database', 'database.json', updated);
    logger.info(logMessages.platform?.configSaved || 'Database config saved');
    res.json({ success: true, data: { message: 'Database configuration saved' } });
  } catch (err) { next(err); }
});

// ─── Auth Config ──────────────────────────────────────────────────────────────

router.get('/auth', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const authConfig = await readConfig('config:auth', 'authConfig.json', { method: 'json' });
    res.json({ success: true, data: authConfig });
  } catch (err) { next(err); }
});

router.post('/auth', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { method } = req.body;
    if (!['json', 'database'].includes(method)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid auth method. Must be "json" or "database".' } });
    }
    const authConfig = { method, updatedAt: new Date().toISOString() };
    await writeConfig('config:auth', 'authConfig.json', authConfig);
    logger.info(`Auth method switched to ${method}`);
    res.json({ success: true, data: authConfig });
  } catch (err) { next(err); }
});

// ─── Logging Config ───────────────────────────────────────────────────────────

router.get('/logging', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const loggingConfig = await readConfig('config:logging', 'loggingConfig.json', {
      logLevel: 'debug',
      consoleOutput: true,
      captureApiCalls: true,
      captureUiLogs: true,
      captureModuleLogs: true,
      maxEntries: 500,
      dbRetention: 10000,
      autoCleanup: true,
      moduleLogging: {},
    });
    res.json({ success: true, data: loggingConfig });
  } catch (err) { next(err); }
});

router.post('/logging', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const config = { ...req.body, updatedAt: new Date().toISOString() };
    await writeConfig('config:logging', 'loggingConfig.json', config);
    logger.info('Logging configuration saved');
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

// ─── Generic Key-Value Config ─────────────────────────────────────────────────

/**
 * @swagger
 * /config:
 *   get:
 *     tags: [Config]
 *     summary: List all system configuration entries
 *     responses:
 *       200: { description: Config entries }
 */
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const configs = await SystemConfig.findAll({ order: [['category', 'ASC'], ['key', 'ASC']] });
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /config/{key}:
 *   get:
 *     tags: [Config]
 *     summary: Get a config entry by key
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Config entry }
 *       404: { description: Config not found }
 */
router.get('/:key', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne({ where: { key: req.params.key } });
    if (!config) {
      return res.status(404).json({ success: false, error: { message: 'Config key not found', code: 'NOT_FOUND' } });
    }
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /config/{key}:
 *   put:
 *     tags: [Config]
 *     summary: Upsert a config entry
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value: { type: string }
 *               category: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Config saved }
 */
router.put('/:key', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { value, category, description } = req.body;
    const [config, created] = await SystemConfig.findOrCreate({
      where: { key: req.params.key },
      defaults: { value, category: category || 'general', description },
    });
    if (!created) {
      if (value !== undefined) config.value = value;
      if (category) config.category = category;
      if (description !== undefined) config.description = description;
      await config.save();
    }
    logger.info(logMessages.platform?.configSaved || 'Config saved', { key: req.params.key });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /config/{key}:
 *   delete:
 *     tags: [Config]
 *     summary: Delete a config entry
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Config deleted }
 */
router.delete('/:key', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne({ where: { key: req.params.key } });
    if (!config) {
      return res.status(404).json({ success: false, error: { message: 'Config key not found', code: 'NOT_FOUND' } });
    }
    await config.destroy();
    res.json({ success: true, data: { message: 'Config deleted successfully' } });
  } catch (err) { next(err); }
});

export default router;
