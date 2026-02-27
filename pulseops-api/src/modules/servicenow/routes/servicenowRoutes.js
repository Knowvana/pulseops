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

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) return 0;

  const businessHours = await ServiceNowBusinessHours.findAll({
    where: { isBusinessDay: true },
    order: [['dayOfWeek', 'ASC']],
  });

  if (businessHours.length === 0) {
    return Math.round((end - start) / 60000);
  }

  // Build map keyed by UTC day-of-week (0=Sun ... 6=Sat)
  const bhMap = {};
  businessHours.forEach(bh => {
    const [startHour, startMin] = bh.startTime.split(':').map(Number);
    const [endHour, endMin] = bh.endTime.split(':').map(Number);
    bhMap[bh.dayOfWeek] = { startHour, startMin, endHour, endMin };
  });

  let totalMinutes = 0;

  // Iterate day by day using UTC dates to avoid server timezone shifts
  // current = midnight UTC of the current iteration day
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (current <= endDay) {
    const dow = current.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const bh = bhMap[dow];

    if (bh) {
      // Business hours boundaries in UTC for this day
      const dayBizStart = new Date(Date.UTC(
        current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(),
        bh.startHour, bh.startMin, 0
      ));
      const dayBizEnd = new Date(Date.UTC(
        current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(),
        bh.endHour, bh.endMin, 0
      ));

      // Clamp to the actual incident window
      const effectiveStart = start > dayBizStart ? start : dayBizStart;
      const effectiveEnd   = end   < dayBizEnd   ? end   : dayBizEnd;

      if (effectiveStart < effectiveEnd) {
        totalMinutes += (effectiveEnd - effectiveStart) / 60000;
      }
    }

    // Advance by one UTC day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // If no business hours overlap at all (e.g. incident opened and closed on weekend),
  // fall back to raw elapsed minutes so it is not silently marked as MET.
  if (totalMinutes === 0) {
    return Math.round((end - start) / 60000);
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
// CONFIG SETTINGS (report columns, sync filters, state mappings)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/config-settings', authenticate, async (req, res, next) => {
  try {
    const category = req.query.category;
    const where = { isActive: true };
    if (category) where.category = category;

    const settings = await ServiceNowConfigSettings.findAll({ where, order: [['category', 'ASC'], ['key', 'ASC']] });
    const grouped = {};
    settings.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = {};
      grouped[s.category][s.key] = s.value;
    });

    logger.info('ServiceNow config settings fetched', { category, count: settings.length });
    res.json({ success: true, data: grouped, raw: settings });
  } catch (err) { next(err); }
});

router.put('/config-settings', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, error: { message: 'settings array is required', code: 'VALIDATION_ERROR' } });
    }

    const results = [];
    for (const entry of settings) {
      const [record, created] = await ServiceNowConfigSettings.findOrCreate({
        where: { category: entry.category, key: entry.key },
        defaults: { value: entry.value, description: entry.description || '', isActive: true },
      });
      if (!created) {
        record.value = entry.value;
        if (entry.description) record.description = entry.description;
        await record.save();
      }
      results.push(record);
    }

    logger.info('ServiceNow config settings saved', { count: results.length });
    res.json({ success: true, data: results });
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
    const reportDates = computeReportingDates(startDate, endDate, period);

    const incidents = await ServiceNowIncident.findAll({ where, order: [['openedAt', 'DESC']] });

    // Load state mapping from config
    let stateMapping = {};
    try {
      const stateSetting = await ServiceNowConfigSettings.findOne({ where: { category: 'state_mapping', key: 'incidentStates' } });
      if (stateSetting) stateMapping = JSON.parse(stateSetting.value);
    } catch (_) {}

    const closedStates = ['Resolved', 'Closed', '6', '7'];
    const totalClosed = incidents.filter(i => closedStates.includes(String(i.state))).length;
    const totalReceivedAndClosed = incidents.filter(i =>
      closedStates.includes(String(i.state)) && i.closedAt && new Date(i.closedAt) <= reportDates.end
    ).length;

    const byPriority = {};
    const byState = {};
    const byCategory = {};
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseCount = 0;
    let resolutionCount = 0;

    incidents.forEach(inc => {
      byPriority[inc.priority] = (byPriority[inc.priority] || 0) + 1;
      const stateLabel = stateMapping[String(inc.state)] || inc.state;
      byState[stateLabel] = (byState[stateLabel] || 0) + 1;
      if (inc.category) byCategory[inc.category] = (byCategory[inc.category] || 0) + 1;
      if (inc.responseTime) { totalResponseTime += inc.responseTime; responseCount++; }
      if (inc.resolutionTime) { totalResolutionTime += inc.resolutionTime; resolutionCount++; }
    });

    const report = {
      period,
      reportingPeriod: reportDates,
      totalCount: incidents.length,
      totalClosed,
      totalReceivedAndClosed,
      byPriority,
      byState,
      byCategory,
      averageResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null,
      averageResolutionTime: resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : null,
      stateMapping,
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
    const reportDates = computeReportingDates(startDate, endDate, period);

    const ritms = await ServiceNowRitm.findAll({ where, order: [['openedAt', 'DESC']] });

    // Load state mapping from config
    let stateMapping = {};
    try {
      const stateSetting = await ServiceNowConfigSettings.findOne({ where: { category: 'state_mapping', key: 'ritmStates' } });
      if (stateSetting) stateMapping = JSON.parse(stateSetting.value);
    } catch (_) {}

    const closedStates = ['Fulfilled', 'Closed', 'Closed Complete', '3'];
    const totalClosed = ritms.filter(r => closedStates.includes(String(r.state))).length;
    const totalReceivedAndClosed = ritms.filter(r =>
      closedStates.includes(String(r.state)) && r.fulfilledAt && new Date(r.fulfilledAt) <= reportDates.end
    ).length;

    const byPriority = {};
    const byState = {};
    const byCatalogItem = {};
    let totalResponseTime = 0;
    let totalFulfillmentTime = 0;
    let responseCount = 0;
    let fulfillmentCount = 0;

    ritms.forEach(ritm => {
      byPriority[ritm.priority] = (byPriority[ritm.priority] || 0) + 1;
      const stateLabel = stateMapping[String(ritm.state)] || ritm.state;
      byState[stateLabel] = (byState[stateLabel] || 0) + 1;
      if (ritm.catalogItem) byCatalogItem[ritm.catalogItem] = (byCatalogItem[ritm.catalogItem] || 0) + 1;
      if (ritm.responseTime) { totalResponseTime += ritm.responseTime; responseCount++; }
      if (ritm.fulfillmentTime) { totalFulfillmentTime += ritm.fulfillmentTime; fulfillmentCount++; }
    });

    const report = {
      period,
      reportingPeriod: reportDates,
      totalCount: ritms.length,
      totalClosed,
      totalReceivedAndClosed,
      byPriority,
      byState,
      byCatalogItem,
      averageResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null,
      averageFulfillmentTime: fulfillmentCount > 0 ? Math.round(totalFulfillmentTime / fulfillmentCount) : null,
      stateMapping,
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

    // Check if SLA config and business hours exist
    const [slaConfigs, businessHours] = await Promise.all([
      ServiceNowSlaConfig.findAll({ where: { isActive: true } }),
      ServiceNowBusinessHours.findAll(),
    ]);

    const hasSlaConfig = slaConfigs.length > 0;
    const hasBusinessHours = businessHours.length > 0;

    if (!hasSlaConfig || !hasBusinessHours) {
      return res.json({
        success: true,
        data: {
          period,
          hasSlaConfig,
          hasBusinessHours,
          message: !hasSlaConfig && !hasBusinessHours
            ? 'SLA Configuration and Business Hours are not configured. Please configure them in the Configuration section.'
            : !hasSlaConfig
              ? 'SLA Configuration is not available. Please configure SLA targets in the Configuration section.'
              : 'Business Hours are not configured. Please configure business hours in the Configuration section.',
          incidentSla: null,
          ritmSla: null,
        },
      });
    }

    // Build business hours lookup for SLA calculation
    const bhMap = {};
    businessHours.forEach(bh => { bhMap[bh.dayOfWeek] = bh; });

    const [incidents, ritms] = await Promise.all([
      ServiceNowIncident.findAll({ where: dateFilter, order: [['openedAt', 'DESC']] }),
      ServiceNowRitm.findAll({ where: dateFilter, order: [['openedAt', 'DESC']] }),
    ]);

    // Build SLA lookup map
    const slaMap = {};
    slaConfigs.forEach(s => { slaMap[`${s.recordType}:${s.priority}`] = s; });

    // Calculate reporting period details
    const reportDates = computeReportingDates(startDate, endDate, period);
    const closedStates = ['Resolved', 'Closed', '6', '7'];

    const incidentsClosed = incidents.filter(i => closedStates.includes(String(i.state)));
    const incidentsReceivedAndClosed = incidents.filter(i =>
      closedStates.includes(String(i.state)) && i.closedAt && new Date(i.closedAt) <= reportDates.end
    );

    // Incident SLA compliance - calculate dynamically using business hours
    let incResponseMet = 0, incResponseBreached = 0;
    let incResolutionMet = 0, incResolutionBreached = 0;
    const incByPriority = {};
    const incidentSlaDetails = [];

    for (const inc of incidents) {
      const sla = slaMap[`incident:${inc.priority}`];

      // Calculate response time in business minutes (openedAt to closedAt)
      let respBreached = null;
      let respMinutes = null;
      if (sla && inc.closedAt) {
        respMinutes = await calculateBusinessMinutes(inc.openedAt, inc.closedAt);
        respBreached = respMinutes > sla.responseTimeMinutes;
      }

      // Calculate resolution time in business minutes (openedAt to closedAt)
      let resolBreached = null;
      let resolMinutes = null;
      if (sla && inc.closedAt) {
        resolMinutes = await calculateBusinessMinutes(inc.openedAt, inc.closedAt);
        resolBreached = resolMinutes > sla.resolutionTimeMinutes;
      }

      if (respBreached === true) incResponseBreached++;
      else if (respBreached === false) incResponseMet++;
      if (resolBreached === true) incResolutionBreached++;
      else if (resolBreached === false) incResolutionMet++;

      if (!incByPriority[inc.priority]) {
        incByPriority[inc.priority] = {
          total: 0, responseTarget: sla?.responseTimeMinutes || null, resolutionTarget: sla?.resolutionTimeMinutes || null,
          responseMet: 0, responseBreached: 0, resolutionMet: 0, resolutionBreached: 0,
        };
      }
      const p = incByPriority[inc.priority];
      p.total++;
      if (respBreached === true) p.responseBreached++;
      else if (respBreached === false) p.responseMet++;
      if (resolBreached === true) p.resolutionBreached++;
      else if (resolBreached === false) p.resolutionMet++;

      incidentSlaDetails.push({
        id: inc.id,
        number: inc.number,
        shortDescription: inc.shortDescription,
        priority: inc.priority,
        state: inc.state,
        openedAt: inc.openedAt,
        closedAt: inc.closedAt,
        slaResponseMet: respBreached === null ? null : !respBreached,
        responseMinutes: respMinutes,
        slaResolutionMet: resolBreached === null ? null : !resolBreached,
        resolutionMinutes: resolMinutes,
      });
    }

    // Calculate compliance percentages per priority
    Object.values(incByPriority).forEach(p => {
      const respTotal = p.responseMet + p.responseBreached;
      const resolTotal = p.resolutionMet + p.resolutionBreached;
      p.responseCompliance = respTotal > 0 ? Math.round((p.responseMet / respTotal) * 100) : null;
      p.resolutionCompliance = resolTotal > 0 ? Math.round((p.resolutionMet / resolTotal) * 100) : null;
    });

    const incRespTotal = incResponseMet + incResponseBreached;
    const incResolTotal = incResolutionMet + incResolutionBreached;

    const incidentSla = {
      total: incidents.length,
      totalClosed: incidentsClosed.length,
      totalReceivedAndClosed: incidentsReceivedAndClosed.length,
      responseMet: incResponseMet,
      responseBreached: incResponseBreached,
      resolutionMet: incResolutionMet,
      resolutionBreached: incResolutionBreached,
      responseCompliancePercent: incRespTotal > 0 ? Math.round((incResponseMet / incRespTotal) * 100) : null,
      resolutionCompliancePercent: incResolTotal > 0 ? Math.round((incResolutionMet / incResolTotal) * 100) : null,
      byPriority: incByPriority,
      incidents: incidentSlaDetails,
    };

    // RITM SLA compliance
    const ritmsClosed = ritms.filter(r => ['Fulfilled', 'Closed', 'Closed Complete', '3'].includes(String(r.state)));
    const ritmsReceivedAndClosed = ritms.filter(r =>
      ['Fulfilled', 'Closed', 'Closed Complete', '3'].includes(String(r.state)) && r.fulfilledAt && new Date(r.fulfilledAt) <= reportDates.end
    );

    let ritmResponseMet = 0, ritmResponseBreached = 0;
    let ritmFulfillmentMet = 0, ritmFulfillmentBreached = 0;
    const ritmByPriority = {};

    for (const ritm of ritms) {
      const sla = slaMap[`ritm:${ritm.priority}`];
      
      // Calculate response time in business minutes (openedAt to fulfilledAt)
      let respBreached = null;
      if (sla && ritm.fulfilledAt) {
        const respMinutes = await calculateBusinessMinutes(ritm.openedAt, ritm.fulfilledAt);
        respBreached = respMinutes > sla.responseTimeMinutes;
      }

      // Calculate fulfillment time in business minutes (openedAt to closedAt)
      let fulfBreached = null;
      if (sla && ritm.closedAt) {
        const fulfMinutes = await calculateBusinessMinutes(ritm.openedAt, ritm.closedAt);
        fulfBreached = fulfMinutes > sla.resolutionTimeMinutes;
      }

      if (respBreached === true) ritmResponseBreached++;
      else if (respBreached === false) ritmResponseMet++;
      if (fulfBreached === true) ritmFulfillmentBreached++;
      else if (fulfBreached === false) ritmFulfillmentMet++;

      if (!ritmByPriority[ritm.priority]) {
        ritmByPriority[ritm.priority] = {
          total: 0, responseTarget: sla?.responseTimeMinutes || null, fulfillmentTarget: sla?.resolutionTimeMinutes || null,
          responseMet: 0, responseBreached: 0, fulfillmentMet: 0, fulfillmentBreached: 0,
        };
      }
      const p = ritmByPriority[ritm.priority];
      p.total++;
      if (respBreached === true) p.responseBreached++;
      else if (respBreached === false) p.responseMet++;
      if (fulfBreached === true) p.fulfillmentBreached++;
      else if (fulfBreached === false) p.fulfillmentMet++;
    }

    Object.values(ritmByPriority).forEach(p => {
      const respTotal = p.responseMet + p.responseBreached;
      const fulfTotal = p.fulfillmentMet + p.fulfillmentBreached;
      p.responseCompliance = respTotal > 0 ? Math.round((p.responseMet / respTotal) * 100) : null;
      p.fulfillmentCompliance = fulfTotal > 0 ? Math.round((p.fulfillmentMet / fulfTotal) * 100) : null;
    });

    const ritmRespTotal = ritmResponseMet + ritmResponseBreached;
    const ritmFulfTotal = ritmFulfillmentMet + ritmFulfillmentBreached;

    const ritmSla = {
      total: ritms.length,
      totalClosed: ritmsClosed.length,
      totalReceivedAndClosed: ritmsReceivedAndClosed.length,
      responseMet: ritmResponseMet,
      responseBreached: ritmResponseBreached,
      fulfillmentMet: ritmFulfillmentMet,
      fulfillmentBreached: ritmFulfillmentBreached,
      responseCompliancePercent: ritmRespTotal > 0 ? Math.round((ritmResponseMet / ritmRespTotal) * 100) : null,
      fulfillmentCompliancePercent: ritmFulfTotal > 0 ? Math.round((ritmFulfillmentMet / ritmFulfTotal) * 100) : null,
      byPriority: ritmByPriority,
    };

    // Build SLA explanation for UI
    const slaExplanation = {
      businessHours: businessHours.filter(bh => bh.isBusinessDay).map(bh => ({
        day: bh.dayName,
        start: bh.startTime,
        end: bh.endTime,
      })),
      slaTargets: slaConfigs.map(s => ({
        recordType: s.recordType,
        priority: s.priority,
        responseTimeMinutes: s.responseTimeMinutes,
        resolutionTimeMinutes: s.resolutionTimeMinutes,
      })),
      calculationMethod: 'SLA compliance is calculated by comparing actual response/resolution times against configured SLA targets. Times are measured in calendar minutes from the opened_at timestamp.',
    };

    const report = {
      period,
      hasSlaConfig: true,
      hasBusinessHours: true,
      reportingPeriod: reportDates,
      incidentSla,
      ritmSla,
      slaTargets: slaConfigs,
      slaExplanation,
    };

    logger.info('ServiceNow SLA report generated', { period, incidents: incidents.length, ritms: ritms.length });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// Helper: compute reporting period date range
function computeReportingDates(startDate, endDate, period) {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate), label: `${startDate} to ${endDate}` };
  }
  const now = new Date();
  let start, end;
  if (period === 'daily') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = now.getDay();
    start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return { start, end, label: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}` };
}

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
