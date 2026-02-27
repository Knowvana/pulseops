// ============================================================================
// Module Routes — PulseOps API
//
// PURPOSE: API endpoints for managing platform modules. Handles listing,
// enabling, disabling, initializing schema, and loading demo data for
// each registered module.
//
// ARCHITECTURE: These routes interact with the system_modules table to
// persist module state. When a module is enabled, its schema.js is
// called to create the required database tables. This ensures all
// module state survives Kubernetes pod restarts.
//
// ENDPOINTS:
//   GET    /api/modules              — List all modules with DB state
//   GET    /api/modules/:id          — Get single module details
//   GET    /api/modules/:id/status   — Check module schema status
//   POST   /api/modules/:id/enable   — Enable module (set enabled=true)
//   POST   /api/modules/:id/disable  — Disable module (set enabled=false)
//   POST   /api/modules/:id/initialize — Create module schema tables
//   POST   /api/modules/:id/demo-data  — Load demo data for module
//   DELETE /api/modules/:id/data     — Wipe module data
//
// USED BY:
//   - Frontend Admin Module → Modules Page (list, enable, disable)
//   - Frontend StepWizard   → Initialize schema + load demo data
//
// INTEGRATION FLOW:
//   TopNav Modules Page → GET /api/modules → shows all modules →
//   User clicks Enable → StepWizard opens → POST /initialize →
//   POST /enable → module appears in TopNav
// ============================================================================
import { Router } from 'express';
import { authenticate, authorize } from '#core/middleware/auth.js';
import { SystemModule } from '#core/database/models/index.js';
import logger, { msg, logMessages } from '#core/logger.js';
import queryService from '#core/database/queryService.js';

const router = Router();

// --- Module schema registry (lazy-loaded per module) ---
const MODULE_SCHEMAS = {};

async function getModuleSchema(moduleId) {
  if (MODULE_SCHEMAS[moduleId]) return MODULE_SCHEMAS[moduleId];
  try {
    switch (moduleId) {
      case 'shiftroaster': {
        const mod = await import('../../modules/roster/schema.js');
        MODULE_SCHEMAS[moduleId] = mod.default || mod;
        return MODULE_SCHEMAS[moduleId];
      }
      case 'servicenow': {
        const mod = await import('../../modules/servicenow/schema.js');
        MODULE_SCHEMAS[moduleId] = mod.default || mod;
        return MODULE_SCHEMAS[moduleId];
      }
      default:
        return null;
    }
  } catch (err) {
    logger.error(msg(logMessages.modules.schemaLoadFailed, { moduleId }), { error: err.message });
    return null;
  }
}

/**
 * @swagger
 * /modules:
 *   get:
 *     tags: [Modules]
 *     summary: List all registered modules with their database state
 *     responses:
 *       200: { description: List of modules }
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const modules = await SystemModule.findAll({ order: [['order', 'ASC']] });

    // Real-time schema verification: check actual DB tables
    let existingTables = [];
    try {
      existingTables = await queryService.getTablesBySchema();
    } catch (_) {}

    const enriched = modules.map(m => {
      const required = m.requiredTables || [];
      const existing = required.filter(t => existingTables.includes(t));
      const missing = required.filter(t => !existingTables.includes(t));
      const schemaValid = required.length > 0 && missing.length === 0;

      // Auto-correct stale initialized flag if tables are gone
      if (m.initialized && !schemaValid && !m.isCore) {
        m.initialized = false;
        m.save().catch(() => {});
      }

      const plain = m.toJSON ? m.toJSON() : { ...m };
      plain.schemaValid = schemaValid;
      plain.existingTables = existing;
      plain.missingTables = missing;
      return plain;
    });

    // Filter by user role for non-admins
    const userRole = req.user.role;
    const filtered = userRole === 'admin'
      ? enriched
      : enriched.filter(m => m.enabled && (m.roles || []).includes(userRole));

    res.json({ success: true, data: filtered });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}:
 *   get:
 *     tags: [Modules]
 *     summary: Get a specific module by moduleId
 */
router.get('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }
    res.json({ success: true, data: mod });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/status:
 *   get:
 *     tags: [Modules]
 *     summary: Check module schema initialization status
 */
router.get('/:id/status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    const schema = await getModuleSchema(req.params.id);
    if (!schema) {
      // Core modules (admin) are always initialized
      if (mod.isCore) {
        return res.json({ success: true, data: { moduleId: mod.moduleId, initialized: true, isCore: true, existing: mod.requiredTables, missing: [] } });
      }
      return res.json({ success: true, data: { moduleId: mod.moduleId, initialized: mod.initialized, schemaAvailable: false } });
    }

    const status = await schema.verifySchema();
    res.json({ success: true, data: { moduleId: mod.moduleId, ...status, enabled: mod.enabled } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/initialize:
 *   post:
 *     tags: [Modules]
 *     summary: Create module database schema (tables)
 */
router.post('/:id/initialize', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    if (mod.isCore) {
      return res.json({ success: true, data: { message: 'Core module schema is managed by the platform', initialized: true } });
    }

    const schema = await getModuleSchema(req.params.id);
    if (!schema) {
      return res.status(400).json({ success: false, error: { message: 'No schema definition found for this module', code: 'NO_SCHEMA' } });
    }

    logger.info(msg(logMessages.modules.initializing, { moduleId: req.params.id }));
    const result = await schema.createSchema();

    mod.initialized = true;
    mod.schemaVersion = mod.version;
    await mod.save();

    logger.info(msg(logMessages.modules.initialized, { moduleId: req.params.id }));
    res.json({ success: true, data: { message: 'Module schema created successfully', ...result } });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/enable:
 *   post:
 *     tags: [Modules]
 *     summary: Enable a module
 */
router.post('/:id/enable', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    if (!mod.initialized) {
      return res.status(400).json({ success: false, error: { message: 'Module must be initialized before enabling. Create the schema first.', code: 'NOT_INITIALIZED' } });
    }

    mod.enabled = true;
    mod.enabledAt = new Date();
    mod.enabledBy = req.user.id;
    await mod.save();

    logger.info(msg(logMessages.modules.enabled, { moduleId: req.params.id }));
    res.json({ success: true, data: mod });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/disable:
 *   post:
 *     tags: [Modules]
 *     summary: Disable a module
 */
router.post('/:id/disable', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    if (mod.isCore) {
      return res.status(400).json({ success: false, error: { message: 'Core modules cannot be disabled', code: 'CORE_MODULE' } });
    }

    mod.enabled = false;
    await mod.save();

    logger.info(msg(logMessages.modules.disabled, { moduleId: req.params.id }));
    res.json({ success: true, data: mod });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/demo-data:
 *   post:
 *     tags: [Modules]
 *     summary: Load demo data for a module
 */
router.post('/:id/demo-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    if (!mod.initialized) {
      return res.status(400).json({ success: false, error: { message: 'Module must be initialized before loading demo data', code: 'NOT_INITIALIZED' } });
    }

    const schema = await getModuleSchema(req.params.id);
    if (!schema || !schema.loadDemoData) {
      return res.status(400).json({ success: false, error: { message: 'No demo data available for this module', code: 'NO_DEMO_DATA' } });
    }

    const result = await schema.loadDemoData();
    logger.info(msg(logMessages.modules.demoDataLoaded, { moduleId: req.params.id }));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /modules/{id}/data:
 *   delete:
 *     tags: [Modules]
 *     summary: Wipe all data for a module
 */
router.delete('/:id/data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await SystemModule.findOne({ where: { moduleId: req.params.id } });
    if (!mod) {
      return res.status(404).json({ success: false, error: { message: 'Module not found', code: 'NOT_FOUND' } });
    }

    if (mod.isCore) {
      return res.status(400).json({ success: false, error: { message: 'Cannot wipe core module data', code: 'CORE_MODULE' } });
    }

    const schema = await getModuleSchema(req.params.id);
    if (!schema || !schema.wipeModuleData) {
      return res.status(400).json({ success: false, error: { message: 'Wipe not supported for this module', code: 'NOT_SUPPORTED' } });
    }

    const result = await schema.wipeModuleData();

    // Mark module as uninitialized since tables are dropped
    mod.initialized = false;
    mod.schemaVersion = null;
    await mod.save();

    logger.info(msg(logMessages.modules.dataWiped, { moduleId: req.params.id }));
    res.json({ success: true, data: { message: 'Module data wiped successfully', ...result } });
  } catch (err) { next(err); }
});

export default router;
