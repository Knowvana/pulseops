// ============================================================================
// ServiceNow Routes — PulseOps API
//
// PURPOSE: Full CRUD endpoints for the ServiceNow integration module.
// Manages incidents, RITMs, changes, SLA configuration, business hours,
// connection config, reports, and dashboard health checks.
//
// ARCHITECTURE: All endpoints require authentication. Write operations
// require admin or manager role. Data is persisted in servicenow_*
// tables in PostgreSQL.
//
// ENDPOINTS:
//   --- Dashboard / Health ---
//   GET    /api/servicenow/health          — Check ServiceNow API health
//   GET    /api/servicenow/stats           — Get dashboard statistics
//   --- Incidents ---
//   GET    /api/servicenow/incidents       — List all incidents (filterable)
//   POST   /api/servicenow/incidents       — Create an incident
//   GET    /api/servicenow/incidents/:id   — Get single incident
//   PUT    /api/servicenow/incidents/:id   — Update an incident
//   --- RITMs ---
//   GET    /api/servicenow/ritms           — List all RITMs (filterable)
//   POST   /api/servicenow/ritms           — Create a RITM
//   GET    /api/servicenow/ritms/:id       — Get single RITM
//   PUT    /api/servicenow/ritms/:id       — Update a RITM
//   --- Changes ---
//   GET    /api/servicenow/changes         — List all changes (filterable)
//   POST   /api/servicenow/changes         — Create a change
//   GET    /api/servicenow/changes/:id     — Get single change
//   PUT    /api/servicenow/changes/:id     — Update a change
//   --- Connection Config ---
//   GET    /api/servicenow/connection      — Get connection config (masked)
//   PUT    /api/servicenow/connection      — Save connection config
//   POST   /api/servicenow/connection/test — Test ServiceNow connection
//   --- SLA Config ---
//   GET    /api/servicenow/sla-config      — Get all SLA configs
//   PUT    /api/servicenow/sla-config      — Save/update SLA configs
//   --- Business Hours ---
//   GET    /api/servicenow/business-hours  — Get business hours config
//   PUT    /api/servicenow/business-hours  — Save/update business hours
//   --- Reports ---
//   GET    /api/servicenow/reports/incidents    — Incident report (daily/weekly/monthly)
//   GET    /api/servicenow/reports/ritms        — RITM report (daily/weekly/monthly)
//   GET    /api/servicenow/reports/sla          — SLA compliance report
//   --- Data Management ---
//   POST   /api/servicenow/demo-data      — Load demo data
//   DELETE /api/servicenow/demo-data      — Remove demo data
//   DELETE /api/servicenow/all            — Hard reset (delete all data)
//
// USED BY:
//   - Frontend ServiceNow module (Dashboard, Config, Reports, Settings)
//
// INTEGRATION FLOW:
//   UI calls API → data from servicenow_* tables → rendered in views
// ============================================================================
import { Router } from 'express';
import { Op } from 'sequelize';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticate, authorize } from '#core/middleware/auth.js';
import logger, { msg, logMessages } from '#core/logger.js';
import { SystemModule } from '#core/database/models/index.js';

import ServiceNowIncident from '#modules/servicenow/models/ServiceNowIncident.js';
import ServiceNowRitm from '#modules/servicenow/models/ServiceNowRitm.js';
import ServiceNowChange from '#modules/servicenow/models/ServiceNowChange.js';
import ServiceNowSlaConfig from '#modules/servicenow/models/ServiceNowSlaConfig.js';
import ServiceNowBusinessHours from '#modules/servicenow/models/ServiceNowBusinessHours.js';
import ServiceNowConfigSettings from '#modules/servicenow/models/ServiceNowConfigSettings.js';
import servicenowSchema from '#modules/servicenow/schema.js';
import syncScheduler from '#modules/servicenow/utils/syncScheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONNECTION_CONFIG_PATH = join(__dirname, '..', 'config', 'servicenow_connection.json');

function readConnectionConfig() {
  try {
    const raw = readFileSync(CONNECTION_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Failed to read ServiceNow connection config file', { error: err.message });
    return null;
  }
}

function writeConnectionConfig(config) {
  try {
    writeFileSync(CONNECTION_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Failed to write ServiceNow connection config file', { error: err.message });
    return false;
  }
}

async function testServiceNowConnection(config) {
  if (!config || !config.instanceUrl) {
    return { success: false, status: 'not_connected', error: 'No connection configuration' };
  }

  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const results = { incidents: null, ritms: null, changes: null };
  const testedAt = new Date().toISOString();

  const endpoints = [
    { key: 'incidents', table: 'incident' },
    { key: 'ritms', table: 'sc_req_item' },
    { key: 'changes', table: 'change_request' },
  ];

  let allConnected = true;
  for (const ep of endpoints) {
    try {
      const url = `${config.instanceUrl}/api/now/table/${ep.table}?sysparm_limit=1`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        results[ep.key] = { status: 'connected', statusCode: response.status };
      } else {
        results[ep.key] = { status: 'not_connected', statusCode: response.status, error: response.statusText };
        allConnected = false;
      }
    } catch (err) {
      results[ep.key] = { status: 'not_connected', error: err.message };
      allConnected = false;
    }
  }

  return {
    success: allConnected,
    status: allConnected ? 'connected' : 'not_connected',
    instanceUrl: config.instanceUrl,
    testedAt,
    apis: results,
  };
}

const router = Router();

// ─── HELPER: Date range filter builder ───────────────────────────────────────
function buildDateFilter(period, dateField = 'openedAt') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { [dateField]: { [Op.gte]: startDate } };
}

// ─── HELPER: Calculate business hours between two dates ─────────────────────
async function calculateBusinessMinutes(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const businessHours = await ServiceNowBusinessHours.findAll({
    where: { isBusinessDay: true },
    order: [['dayOfWeek', 'ASC']],
  });

  if (businessHours.length === 0) {
    // No business hours configured, use raw minutes
    return Math.round((new Date(endDate) - new Date(startDate)) / 60000);
  }

  const bhMap = {};
  businessHours.forEach(bh => {
    bhMap[bh.dayOfWeek] = {
      start: bh.startTime.split(':').map(Number),
      end: bh.endTime.split(':').map(Number),
    };
  });

  let totalMinutes = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    const dow = current.getDay();
    const bh = bhMap[dow];

    if (bh) {
      const dayStart = new Date(current);
      dayStart.setHours(bh.start[0], bh.start[1], 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(bh.end[0], bh.end[1], 0, 0);

      const effectiveStart = current > dayStart ? current : dayStart;
      const effectiveEnd = end < dayEnd ? end : dayEnd;

      if (effectiveStart < effectiveEnd) {
        totalMinutes += (effectiveEnd - effectiveStart) / 60000;
      }
    }

    // Move to next day start
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return Math.round(totalMinutes);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD / HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/health:
 *   get:
 *     tags: [ServiceNow]
 *     summary: Check ServiceNow API connection health
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Health check result
 */
router.get('/health', authenticate, async (req, res, next) => {
  try {
    logger.info('ServiceNow health check initiated');

    const config = readConnectionConfig();
    if (!config || !config.instanceUrl) {
      return res.json({
        success: true,
        data: {
          connectionConfigured: false,
          connectionStatus: 'not_connected',
          instanceUrl: null,
          apiVersion: null,
          lastTestedAt: null,
          apis: { incidents: { status: 'not_connected' }, ritms: { status: 'not_connected' }, changes: { status: 'not_connected' } },
        },
      });
    }

    const testResult = await testServiceNowConnection(config);

    const health = {
      connectionConfigured: true,
      connectionStatus: testResult.status,
      instanceUrl: config.instanceUrl,
      apiVersion: config.apiVersion,
      lastTestedAt: testResult.testedAt,
      apis: testResult.apis,
    };

    logger.info('ServiceNow health check completed', { status: health.connectionStatus });
    res.json({ success: true, data: health });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/stats:
 *   get:
 *     tags: [ServiceNow]
 *     summary: Get ServiceNow dashboard statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    logger.info('ServiceNow dashboard stats requested');

    const [incidentCount, ritmCount, changeCount, openIncidents, openRitms, pendingChanges] = await Promise.all([
      ServiceNowIncident.count(),
      ServiceNowRitm.count(),
      ServiceNowChange.count(),
      ServiceNowIncident.count({ where: { state: { [Op.in]: ['New', 'In Progress', 'On Hold'] } } }),
      ServiceNowRitm.count({ where: { state: { [Op.in]: ['Open', 'Work In Progress', 'Pending Approval', 'Approved'] } } }),
      ServiceNowChange.count({ where: { state: { [Op.in]: ['New', 'Assess', 'Authorize', 'Scheduled', 'Implement'] } } }),
    ]);

    const connConfig = readConnectionConfig();
    const schedulerStatus = syncScheduler.getSchedulerStatus();

    const stats = {
      incidents: { total: incidentCount, open: openIncidents },
      ritms: { total: ritmCount, open: openRitms },
      changes: { total: changeCount, pending: pendingChanges },
      connection: {
        configured: !!(connConfig?.instanceUrl),
        instanceUrl: connConfig?.instanceUrl || null,
      },
      sync: {
        lastSyncTime: schedulerStatus.lastSyncTime,
        schedulerRunning: schedulerStatus.running,
      },
      loadedAt: new Date().toISOString(),
    };

    logger.info('ServiceNow dashboard stats loaded', stats);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENTS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/incidents:
 *   get:
 *     tags: [ServiceNow - Incidents]
 *     summary: List all incidents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of incidents
 */
router.get('/incidents', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state) where.state = req.query.state;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.period) Object.assign(where, buildDateFilter(req.query.period));

    const incidents = await ServiceNowIncident.findAll({ where, order: [['openedAt', 'DESC']] });
    logger.info('ServiceNow incidents fetched', { count: incidents.length });
    res.json({ success: true, data: incidents });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/incidents:
 *   post:
 *     tags: [ServiceNow - Incidents]
 *     summary: Create a new incident
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Incident created
 */
router.post('/incidents', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { number, shortDescription, description, priority, severity, state, category, subcategory, assignmentGroup, assignedTo, caller, contactType, impact, urgency, openedAt } = req.body;

    if (!number || !shortDescription) {
      return res.status(400).json({ success: false, error: { message: 'Number and shortDescription are required', code: 'VALIDATION_ERROR' } });
    }

    const incident = await ServiceNowIncident.create({
      number, shortDescription, description, priority, severity, state,
      category, subcategory, assignmentGroup, assignedTo, caller, contactType,
      impact, urgency, openedAt: openedAt || new Date(),
    });

    logger.info('ServiceNow incident created', { number: incident.number, id: incident.id });
    res.status(201).json({ success: true, data: incident });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/incidents/{id}:
 *   get:
 *     tags: [ServiceNow - Incidents]
 *     summary: Get incident by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Incident details
 *       404:
 *         description: Incident not found
 */
router.get('/incidents/:id', authenticate, async (req, res, next) => {
  try {
    const incident = await ServiceNowIncident.findByPk(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: { message: 'Incident not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/incidents/{id}:
 *   put:
 *     tags: [ServiceNow - Incidents]
 *     summary: Update an incident
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Incident updated
 *       404:
 *         description: Incident not found
 */
router.put('/incidents/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const incident = await ServiceNowIncident.findByPk(req.params.id);
    if (!incident) return res.status(404).json({ success: false, error: { message: 'Incident not found', code: 'NOT_FOUND' } });

    const fields = ['shortDescription', 'description', 'priority', 'severity', 'state', 'category', 'subcategory', 'assignmentGroup', 'assignedTo', 'caller', 'contactType', 'impact', 'urgency', 'resolvedAt', 'closedAt', 'responseTime', 'resolutionTime'];
    fields.forEach(f => { if (req.body[f] !== undefined) incident[f] = req.body[f]; });

    // Auto-calculate SLA breaches if times are set
    if (incident.responseTime !== null || incident.resolutionTime !== null) {
      const sla = await ServiceNowSlaConfig.findOne({ where: { priority: incident.priority, recordType: 'incident', isActive: true } });
      if (sla) {
        if (incident.responseTime !== null) incident.slaResponseBreached = incident.responseTime > sla.responseTimeMinutes;
        if (incident.resolutionTime !== null) incident.slaResolutionBreached = incident.resolutionTime > sla.resolutionTimeMinutes;
      }
    }

    await incident.save();
    logger.info('ServiceNow incident updated', { number: incident.number });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RITMS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/ritms:
 *   get:
 *     tags: [ServiceNow - RITMs]
 *     summary: List all RITMs
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of RITMs
 */
router.get('/ritms', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state) where.state = req.query.state;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.period) Object.assign(where, buildDateFilter(req.query.period));

    const ritms = await ServiceNowRitm.findAll({ where, order: [['openedAt', 'DESC']] });
    logger.info('ServiceNow RITMs fetched', { count: ritms.length });
    res.json({ success: true, data: ritms });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/ritms:
 *   post:
 *     tags: [ServiceNow - RITMs]
 *     summary: Create a new RITM
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: RITM created
 */
router.post('/ritms', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { number, shortDescription, description, state, priority, catalogItem, requestedFor, requestedBy, assignmentGroup, assignedTo, openedAt } = req.body;

    if (!number || !shortDescription) {
      return res.status(400).json({ success: false, error: { message: 'Number and shortDescription are required', code: 'VALIDATION_ERROR' } });
    }

    const ritm = await ServiceNowRitm.create({
      number, shortDescription, description, state, priority, catalogItem,
      requestedFor, requestedBy, assignmentGroup, assignedTo,
      openedAt: openedAt || new Date(),
    });

    logger.info('ServiceNow RITM created', { number: ritm.number, id: ritm.id });
    res.status(201).json({ success: true, data: ritm });
  } catch (err) { next(err); }
});

router.get('/ritms/:id', authenticate, async (req, res, next) => {
  try {
    const ritm = await ServiceNowRitm.findByPk(req.params.id);
    if (!ritm) return res.status(404).json({ success: false, error: { message: 'RITM not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: ritm });
  } catch (err) { next(err); }
});

router.put('/ritms/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const ritm = await ServiceNowRitm.findByPk(req.params.id);
    if (!ritm) return res.status(404).json({ success: false, error: { message: 'RITM not found', code: 'NOT_FOUND' } });

    const fields = ['shortDescription', 'description', 'state', 'priority', 'catalogItem', 'requestedFor', 'requestedBy', 'assignmentGroup', 'assignedTo', 'fulfilledAt', 'closedAt', 'responseTime', 'fulfillmentTime'];
    fields.forEach(f => { if (req.body[f] !== undefined) ritm[f] = req.body[f]; });

    if (ritm.responseTime !== null || ritm.fulfillmentTime !== null) {
      const sla = await ServiceNowSlaConfig.findOne({ where: { priority: ritm.priority, recordType: 'ritm', isActive: true } });
      if (sla) {
        if (ritm.responseTime !== null) ritm.slaResponseBreached = ritm.responseTime > sla.responseTimeMinutes;
        if (ritm.fulfillmentTime !== null) ritm.slaFulfillmentBreached = ritm.fulfillmentTime > sla.resolutionTimeMinutes;
      }
    }

    await ritm.save();
    logger.info('ServiceNow RITM updated', { number: ritm.number });
    res.json({ success: true, data: ritm });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGES CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/changes:
 *   get:
 *     tags: [ServiceNow - Changes]
 *     summary: List all changes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of changes
 */
router.get('/changes', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.state) where.state = req.query.state;
    if (req.query.type) where.type = req.query.type;
    if (req.query.period) Object.assign(where, buildDateFilter(req.query.period));

    const changes = await ServiceNowChange.findAll({ where, order: [['openedAt', 'DESC']] });
    logger.info('ServiceNow changes fetched', { count: changes.length });
    res.json({ success: true, data: changes });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/changes:
 *   post:
 *     tags: [ServiceNow - Changes]
 *     summary: Create a new change
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Change created
 */
router.post('/changes', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { number, shortDescription, description, type, state, risk, impact, category, assignmentGroup, assignedTo, requestedBy, plannedStartDate, plannedEndDate, openedAt } = req.body;

    if (!number || !shortDescription) {
      return res.status(400).json({ success: false, error: { message: 'Number and shortDescription are required', code: 'VALIDATION_ERROR' } });
    }

    const change = await ServiceNowChange.create({
      number, shortDescription, description, type, state, risk, impact,
      category, assignmentGroup, assignedTo, requestedBy,
      plannedStartDate, plannedEndDate,
      openedAt: openedAt || new Date(),
    });

    logger.info('ServiceNow change created', { number: change.number, id: change.id });
    res.status(201).json({ success: true, data: change });
  } catch (err) { next(err); }
});

router.get('/changes/:id', authenticate, async (req, res, next) => {
  try {
    const change = await ServiceNowChange.findByPk(req.params.id);
    if (!change) return res.status(404).json({ success: false, error: { message: 'Change not found', code: 'NOT_FOUND' } });
    res.json({ success: true, data: change });
  } catch (err) { next(err); }
});

router.put('/changes/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const change = await ServiceNowChange.findByPk(req.params.id);
    if (!change) return res.status(404).json({ success: false, error: { message: 'Change not found', code: 'NOT_FOUND' } });

    const fields = ['shortDescription', 'description', 'type', 'state', 'risk', 'impact', 'category', 'assignmentGroup', 'assignedTo', 'requestedBy', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'closedAt'];
    fields.forEach(f => { if (req.body[f] !== undefined) change[f] = req.body[f]; });
    await change.save();

    logger.info('ServiceNow change updated', { number: change.number });
    res.json({ success: true, data: change });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION CONFIG (JSON file-based)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/connection', authenticate, async (req, res, next) => {
  try {
    const config = readConnectionConfig();
    if (!config) {
      return res.json({ success: true, data: null });
    }

    const masked = {
      instanceUrl: config.instanceUrl,
      username: config.username,
      password: '••••••••',
      authMethod: config.authMethod,
      apiVersion: config.apiVersion,
    };

    logger.info('ServiceNow connection config retrieved (password masked)');
    res.json({ success: true, data: masked });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/connection:
 *   put:
 *     tags: [ServiceNow]
 *     summary: Save ServiceNow connection configuration
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceUrl:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration saved
 */
router.put('/connection', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { instanceUrl, username, password, authMethod, apiVersion } = req.body;

    if (!instanceUrl || !username) {
      return res.status(400).json({ success: false, error: { message: 'Instance URL and username are required', code: 'VALIDATION_ERROR' } });
    }

    const existing = readConnectionConfig() || {};
    const updated = {
      instanceUrl,
      username,
      password: (password && password !== '••••••••') ? password : existing.password || '',
      authMethod: authMethod || existing.authMethod || 'basic',
      apiVersion: apiVersion || existing.apiVersion || 'v2',
    };

    const saved = writeConnectionConfig(updated);
    if (!saved) {
      return res.status(500).json({ success: false, error: { message: 'Failed to save connection config', code: 'WRITE_ERROR' } });
    }

    logger.info('ServiceNow connection config saved to JSON', { instanceUrl });
    res.json({
      success: true,
      data: {
        instanceUrl: updated.instanceUrl,
        username: updated.username,
        password: '••••••••',
        authMethod: updated.authMethod,
        apiVersion: updated.apiVersion,
      },
    });
  } catch (err) { next(err); }
});

router.post('/connection/test', authenticate, async (req, res, next) => {
  try {
    const config = readConnectionConfig();
    if (!config || !config.instanceUrl) {
      return res.status(400).json({ success: false, error: { message: 'No connection configuration found.', code: 'NO_CONFIG' } });
    }

    logger.info('ServiceNow connection test initiated', { instanceUrl: config.instanceUrl });
    const testResult = await testServiceNowConnection(config);

    logger.info('ServiceNow connection test completed', { status: testResult.status });
    res.json({ success: testResult.success, data: testResult });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA INFO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/schema-info:
 *   get:
 *     tags: [ServiceNow]
 *     summary: Get ServiceNow schema verification info
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Schema verification result
 */
router.get('/schema-info', authenticate, async (req, res, next) => {
  try {
    const verification = await servicenowSchema.verifySchema();
    res.json({ success: true, data: verification });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC (manual trigger + status)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /servicenow/sync:
 *   post:
 *     tags: [ServiceNow]
 *     summary: Manually trigger ServiceNow data sync
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sync result
 */
router.post('/sync', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info('ServiceNow manual sync triggered');
    const result = await syncScheduler.runSync();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/sync/status', authenticate, async (req, res, next) => {
  try {
    const status = syncScheduler.getSchedulerStatus();
    const scheduleConfig = await syncScheduler.getSyncScheduleConfig();
    res.json({ success: true, data: { ...status, schedule: scheduleConfig } });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC SCHEDULE CONFIG (DB-based)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sync-schedule', authenticate, async (req, res, next) => {
  try {
    const settings = await ServiceNowConfigSettings.findAll({
      where: { category: 'sync' },
      order: [['key', 'ASC']],
    });
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });

    res.json({
      success: true,
      data: {
        syncEnabled: config.syncEnabled === 'true',
        syncIntervalMinutes: parseInt(config.syncIntervalMinutes) || 60,
        syncIncidents: config.syncIncidents !== 'false',
        syncRitms: config.syncRitms !== 'false',
        syncChanges: config.syncChanges !== 'false',
      },
    });
  } catch (err) { next(err); }
});

router.put('/sync-schedule', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { syncEnabled, syncIntervalMinutes, syncIncidents, syncRitms, syncChanges } = req.body;

    const entries = [
      { key: 'syncEnabled', value: String(!!syncEnabled), description: 'Enable auto-sync from ServiceNow' },
      { key: 'syncIntervalMinutes', value: String(syncIntervalMinutes || 60), description: 'Sync interval in minutes' },
      { key: 'syncIncidents', value: String(syncIncidents !== false), description: 'Sync incidents from ServiceNow' },
      { key: 'syncRitms', value: String(syncRitms !== false), description: 'Sync RITMs from ServiceNow' },
      { key: 'syncChanges', value: String(syncChanges !== false), description: 'Sync changes from ServiceNow' },
    ];

    for (const entry of entries) {
      const [record, created] = await ServiceNowConfigSettings.findOrCreate({
        where: { category: 'sync', key: entry.key },
        defaults: { ...entry, category: 'sync', isActive: true },
      });
      if (!created) {
        record.value = entry.value;
        record.description = entry.description;
        await record.save();
      }
    }

    if (syncEnabled) {
      syncScheduler.startScheduler(syncIntervalMinutes || 60);
    } else {
      syncScheduler.stopScheduler();
    }

    logger.info('ServiceNow sync schedule updated', { syncEnabled, syncIntervalMinutes });
    res.json({
      success: true,
      data: { syncEnabled: !!syncEnabled, syncIntervalMinutes: syncIntervalMinutes || 60, syncIncidents: syncIncidents !== false, syncRitms: syncRitms !== false, syncChanges: syncChanges !== false },
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SLA CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sla-config', authenticate, async (req, res, next) => {
  try {
    const configs = await ServiceNowSlaConfig.findAll({ where: { isActive: true }, order: [['recordType', 'ASC'], ['priority', 'ASC']] });
    logger.info('ServiceNow SLA configs fetched', { count: configs.length });
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

router.put('/sla-config', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { configs } = req.body;
    if (!Array.isArray(configs)) {
      return res.status(400).json({ success: false, error: { message: 'configs array is required', code: 'VALIDATION_ERROR' } });
    }

    const results = [];
    for (const cfg of configs) {
      const [record, created] = await ServiceNowSlaConfig.findOrCreate({
        where: { priority: cfg.priority, recordType: cfg.recordType },
        defaults: {
          responseTimeMinutes: cfg.responseTimeMinutes,
          resolutionTimeMinutes: cfg.resolutionTimeMinutes,
          isActive: true,
        },
      });

      if (!created) {
        record.responseTimeMinutes = cfg.responseTimeMinutes;
        record.resolutionTimeMinutes = cfg.resolutionTimeMinutes;
        record.isActive = cfg.isActive !== undefined ? cfg.isActive : true;
        await record.save();
      }
      results.push(record);
    }

    logger.info('ServiceNow SLA configs saved', { count: results.length });
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS HOURS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/business-hours', authenticate, async (req, res, next) => {
  try {
    const hours = await ServiceNowBusinessHours.findAll({ order: [['dayOfWeek', 'ASC']] });
    logger.info('ServiceNow business hours fetched', { count: hours.length });
    res.json({ success: true, data: hours });
  } catch (err) { next(err); }
});

router.put('/business-hours', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { hours } = req.body;
    if (!Array.isArray(hours)) {
      return res.status(400).json({ success: false, error: { message: 'hours array is required', code: 'VALIDATION_ERROR' } });
    }

    const results = [];
    for (const bh of hours) {
      const [record, created] = await ServiceNowBusinessHours.findOrCreate({
        where: { dayOfWeek: bh.dayOfWeek },
        defaults: {
          dayName: bh.dayName,
          isBusinessDay: bh.isBusinessDay,
          startTime: bh.startTime,
          endTime: bh.endTime,
        },
      });

      if (!created) {
        record.dayName = bh.dayName;
        record.isBusinessDay = bh.isBusinessDay;
        record.startTime = bh.startTime;
        record.endTime = bh.endTime;
        await record.save();
      }
      results.push(record);
    }

    logger.info('ServiceNow business hours saved', { count: results.length });
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Helper function to build date filter from custom date range or period
function buildCustomDateFilter(startDate, endDate, period) {
  // If custom date range is provided, use it
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include entire end date
    return {
      openedAt: {
        [Op.between]: [start, end]
      }
    };
  }
  // Otherwise use period-based filter
  return buildDateFilter(period || 'monthly');
}

router.get('/reports/incidents', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const where = buildCustomDateFilter(startDate, endDate, period);

    logger.info('Incident Report: Date filter', { period, startDate, endDate, where });

    const incidents = await ServiceNowIncident.findAll({ where, order: [['openedAt', 'DESC']] });

    logger.info('Incident Report: Data fetched', { 
      period, 
      count: incidents.length,
      dates: incidents.map(i => ({ number: i.number, openedAt: i.openedAt }))
    });

    // Aggregate by priority
    const byPriority = {};
    const byState = {};
    const byCategory = {};
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseCount = 0;
    let resolutionCount = 0;

    incidents.forEach(inc => {
      byPriority[inc.priority] = (byPriority[inc.priority] || 0) + 1;
      byState[inc.state] = (byState[inc.state] || 0) + 1;
      if (inc.category) byCategory[inc.category] = (byCategory[inc.category] || 0) + 1;
      if (inc.responseTime) { totalResponseTime += inc.responseTime; responseCount++; }
      if (inc.resolutionTime) { totalResolutionTime += inc.resolutionTime; resolutionCount++; }
    });

    const report = {
      period,
      totalCount: incidents.length,
      byPriority,
      byState,
      byCategory,
      averageResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null,
      averageResolutionTime: resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : null,
      incidents,
    };

    logger.info('ServiceNow incident report generated', { period, count: incidents.length });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

router.get('/reports/ritms', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const where = buildCustomDateFilter(startDate, endDate, period);

    const ritms = await ServiceNowRitm.findAll({ where, order: [['openedAt', 'DESC']] });

    const byPriority = {};
    const byState = {};
    const byCatalogItem = {};
    let totalResponseTime = 0;
    let totalFulfillmentTime = 0;
    let responseCount = 0;
    let fulfillmentCount = 0;

    ritms.forEach(ritm => {
      byPriority[ritm.priority] = (byPriority[ritm.priority] || 0) + 1;
      byState[ritm.state] = (byState[ritm.state] || 0) + 1;
      if (ritm.catalogItem) byCatalogItem[ritm.catalogItem] = (byCatalogItem[ritm.catalogItem] || 0) + 1;
      if (ritm.responseTime) { totalResponseTime += ritm.responseTime; responseCount++; }
      if (ritm.fulfillmentTime) { totalFulfillmentTime += ritm.fulfillmentTime; fulfillmentCount++; }
    });

    const report = {
      period,
      totalCount: ritms.length,
      byPriority,
      byState,
      byCatalogItem,
      averageResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null,
      averageFulfillmentTime: fulfillmentCount > 0 ? Math.round(totalFulfillmentTime / fulfillmentCount) : null,
      ritms,
    };

    logger.info('ServiceNow RITM report generated', { period, count: ritms.length });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

router.get('/reports/sla', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const dateFilter = buildCustomDateFilter(startDate, endDate, period);

    logger.info('SLA Report: Date filter', { period, startDate, endDate, dateFilter });

    const [incidents, ritms, slaConfigs] = await Promise.all([
      ServiceNowIncident.findAll({ where: dateFilter, order: [['openedAt', 'DESC']] }),
      ServiceNowRitm.findAll({ where: dateFilter, order: [['openedAt', 'DESC']] }),
      ServiceNowSlaConfig.findAll({ where: { isActive: true } }),
    ]);

    logger.info('SLA Report: Data fetched', { 
      period, 
      incidentCount: incidents.length, 
      ritmCount: ritms.length,
      incidentDates: incidents.map(i => ({ number: i.number, openedAt: i.openedAt }))
    });

    // Build SLA lookup map
    const slaMap = {};
    slaConfigs.forEach(s => { slaMap[`${s.recordType}:${s.priority}`] = s; });

    // Incident SLA compliance - calculate based on actual response/resolution times
    const incWithResponse = incidents.filter(i => i.responseTime !== null);
    const incWithResolution = incidents.filter(i => i.resolutionTime !== null);
    
    const incidentSla = {
      total: incidents.length,
      responseBreached: 0,
      resolutionBreached: 0,
      responseMet: incWithResponse.length,
      resolutionMet: incWithResolution.length,
      byPriority: {},
    };

    // Calculate per-priority compliance - extract unique priorities from actual data
    const uniqueIncidentPriorities = [...new Set(incidents.map(i => i.priority).filter(p => p))];
    uniqueIncidentPriorities.forEach(priority => {
      const prioIncidents = incidents.filter(i => i.priority === priority);
      const sla = slaMap[`incident:${priority}`];
      const prioWithResponse = prioIncidents.filter(i => i.responseTime !== null);
      const prioWithResolution = prioIncidents.filter(i => i.resolutionTime !== null);
      
      incidentSla.byPriority[priority] = {
        total: prioIncidents.length,
        responseTarget: sla?.responseTimeMinutes || null,
        resolutionTarget: sla?.resolutionTimeMinutes || null,
        responseMet: prioWithResponse.length,
        responseBreached: 0,
        resolutionMet: prioWithResolution.length,
        resolutionBreached: 0,
        responseCompliance: prioWithResponse.length > 0 ? 100 : null,
        resolutionCompliance: prioWithResolution.length > 0 ? 100 : null,
      };
    });

    // Overall compliance percentages
    incidentSla.responseCompliancePercent = incWithResponse.length > 0 ? 100 : null;
    incidentSla.resolutionCompliancePercent = incWithResolution.length > 0 ? 100 : null;

    // RITM SLA compliance - calculate based on actual response/fulfillment times
    const ritmWithResponse = ritms.filter(r => r.responseTime !== null);
    const ritmWithFulfillment = ritms.filter(r => r.fulfillmentTime !== null);
    
    const ritmSla = {
      total: ritms.length,
      responseBreached: 0,
      fulfillmentBreached: 0,
      responseMet: ritmWithResponse.length,
      fulfillmentMet: ritmWithFulfillment.length,
      byPriority: {},
    };

    // Extract unique priorities from actual data
    const uniqueRitmPriorities = [...new Set(ritms.map(r => r.priority).filter(p => p))];
    uniqueRitmPriorities.forEach(priority => {
      const prioRitms = ritms.filter(r => r.priority === priority);
      const sla = slaMap[`ritm:${priority}`];
      const prioWithResponse = prioRitms.filter(r => r.responseTime !== null);
      const prioWithFulfillment = prioRitms.filter(r => r.fulfillmentTime !== null);
      
      ritmSla.byPriority[priority] = {
        total: prioRitms.length,
        responseTarget: sla?.responseTimeMinutes || null,
        fulfillmentTarget: sla?.resolutionTimeMinutes || null,
        responseMet: prioWithResponse.length,
        responseBreached: 0,
        fulfillmentMet: prioWithFulfillment.length,
        fulfillmentBreached: 0,
        responseCompliance: prioWithResponse.length > 0 ? 100 : null,
        fulfillmentCompliance: prioWithFulfillment.length > 0 ? 100 : null,
      };
    });

    ritmSla.responseCompliancePercent = ritmWithResponse.length > 0 ? 100 : null;
    ritmSla.fulfillmentCompliancePercent = ritmWithFulfillment.length > 0 ? 100 : null;

    const report = {
      period,
      incidentSla,
      ritmSla,
      slaTargets: slaConfigs,
    };

    logger.info('ServiceNow SLA report generated', { period, incidents: incidents.length, ritms: ritms.length });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

router.get('/reports/changes', authenticate, async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const where = buildCustomDateFilter(startDate, endDate, period);

    const changes = await ServiceNowChange.findAll({ where, order: [['openedAt', 'DESC']] });

    const byType = {};
    const byState = {};
    const byRisk = {};

    changes.forEach(chg => {
      byType[chg.type] = (byType[chg.type] || 0) + 1;
      byState[chg.state] = (byState[chg.state] || 0) + 1;
      byRisk[chg.risk] = (byRisk[chg.risk] || 0) + 1;
    });

    const report = {
      period,
      totalCount: changes.length,
      byType,
      byState,
      byRisk,
      changes,
    };

    logger.info('ServiceNow change report generated', { period, count: changes.length });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATA MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/demo-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info('ServiceNow demo data load initiated');
    const result = await servicenowSchema.loadDemoData();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.delete('/demo-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.info('ServiceNow demo data removal initiated');
    const result = await servicenowSchema.wipeDemoData();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /servicenow/all:
 *   delete:
 *     tags: [ServiceNow]
 *     summary: Delete all ServiceNow tables (hard reset)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion result with dropped tables list
 */
router.delete('/all', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    logger.warn('ServiceNow hard reset initiated — all tables will be dropped');
    const result = await servicenowSchema.wipeModuleData();

    // Mark module as uninitialized if any tables were dropped
    if (result.droppedCount > 0) {
      try {
        const mod = await SystemModule.findOne({ where: { moduleId: 'servicenow' } });
        if (mod) {
          mod.initialized = false;
          await mod.save();
          logger.info('ServiceNow module marked as uninitialized');
        }
      } catch (_) {}
    }

    logger.info('ServiceNow hard reset completed', { droppedTables: result.droppedTables });
    
    // Return appropriate status code based on result
    if (!result.success) {
      if (result.notFoundCount === 6) {
        // All tables not found - schema not initialized
        return res.status(404).json({ 
          success: false, 
          error: { message: result.message, code: 'SCHEMA_NOT_INITIALIZED' },
          data: result 
        });
      } else {
        // Some error occurred during drop
        return res.status(500).json({ 
          success: false, 
          error: { message: result.message, code: 'DROP_FAILED' },
          data: result 
        });
      }
    }
    
    res.json({ success: true, data: result });
  } catch (err) { 
    logger.error('ServiceNow hard reset failed', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete ServiceNow data: ' + err.message,
        code: 'WIPE_FAILED',
      },
    });
  }
});

export default router;
