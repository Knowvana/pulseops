// ============================================================================
// ServiceNow Sync Scheduler — PulseOps API
//
// PURPOSE: Production-grade scheduler that auto-syncs data from ServiceNow
// APIs to the local PulseOps database at configured intervals. Reads schedule
// config from ServiceNowConfigSettings table.
//
// ARCHITECTURE: Uses node-cron for scheduling. Reads sync config from DB on
// startup and whenever config is updated. Supports syncing incidents, RITMs,
// and changes independently.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — starts/stops scheduler
//   - src/app.js — could be initialized on startup
//
// INTEGRATION FLOW:
//   Config saved → scheduler updated → cron job fires → fetches from SN API →
//   upserts into local DB → logs results
// ============================================================================
import logger from '#core/logger.js';
import ServiceNowConfigSettings from '#modules/servicenow/models/ServiceNowConfigSettings.js';
import ServiceNowIncident from '#modules/servicenow/models/ServiceNowIncident.js';
import ServiceNowRitm from '#modules/servicenow/models/ServiceNowRitm.js';
import ServiceNowChange from '#modules/servicenow/models/ServiceNowChange.js';

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONNECTION_CONFIG_PATH = join(__dirname, '..', 'config', 'servicenow_connection.json');

let syncTimer = null;
let lastSyncTime = null;
let syncStatus = 'idle';
let syncResults = null;

function readConnectionConfig() {
  try {
    const raw = readFileSync(CONNECTION_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('SyncScheduler: Failed to read connection config', { error: err.message });
    return null;
  }
}

async function getSyncScheduleConfig() {
  try {
    const settings = await ServiceNowConfigSettings.findAll({
      where: { category: 'sync', isActive: true },
    });
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    return {
      enabled: config.syncEnabled === 'true',
      intervalMinutes: parseInt(config.syncIntervalMinutes) || 60,
      syncIncidents: config.syncIncidents !== 'false',
      syncRitms: config.syncRitms !== 'false',
      syncChanges: config.syncChanges !== 'false',
    };
  } catch (err) {
    logger.warn('SyncScheduler: Failed to read sync config from DB', { error: err.message });
    return { enabled: false, intervalMinutes: 60, syncIncidents: true, syncRitms: true, syncChanges: true };
  }
}

async function getSyncFilterConfig() {
  try {
    const settings = await ServiceNowConfigSettings.findAll({
      where: { category: 'sync_filter', isActive: true },
    });
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    return {
      assignmentGroup: config.assignmentGroup || '',
      fromDate: config.fromDate || '',
    };
  } catch (err) {
    logger.warn('SyncScheduler: Failed to read sync filter config', { error: err.message });
    return { assignmentGroup: '', fromDate: '' };
  }
}

async function fetchFromServiceNow(connConfig, endpoint, filters = {}) {
  let url = `${connConfig.instanceUrl}/api/now/table/${endpoint}?sysparm_limit=1000&sysparm_display_value=true`;
  
  const queryParts = [];
  if (filters.assignmentGroup) {
    queryParts.push(`assignment_group=${filters.assignmentGroup}`);
  }
  if (filters.fromDate) {
    queryParts.push(`opened_at>=${filters.fromDate}`);
  }
  if (queryParts.length > 0) {
    url += `&sysparm_query=${queryParts.join('^')}`;
  }

  const auth = Buffer.from(`${connConfig.username}:${connConfig.password}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data: data.result || [] };
  } catch (err) {
    logger.error(`SyncScheduler: Failed to fetch ${endpoint}`, { error: err.message });
    return { success: false, error: err.message, data: [] };
  }
}

async function syncIncidents(connConfig, filters) {
  // Full refresh: delete existing non-demo incidents then re-sync
  await ServiceNowIncident.destroy({ where: { isDemo: false } });

  const result = await fetchFromServiceNow(connConfig, 'incident', filters);
  if (!result.success) {
    logger.error('SyncScheduler: Failed to fetch incidents from ServiceNow', { error: result.error });
    return { synced: 0, error: result.error };
  }

  logger.info('SyncScheduler: Fetched incidents from ServiceNow', { count: result.data.length });
  let synced = 0;
  let failed = 0;
  
  for (const inc of result.data) {
    try {
      const openedAt = inc.opened_at ? new Date(inc.opened_at) : new Date();
      const resolvedAt = inc.resolved_at ? new Date(inc.resolved_at) : null;
      const closedAt = inc.closed_at ? new Date(inc.closed_at) : null;
      
      let responseTime = null;
      if (resolvedAt) {
        responseTime = Math.round((resolvedAt - openedAt) / (1000 * 60));
      }
      
      let resolutionTime = null;
      if (closedAt) {
        resolutionTime = Math.round((closedAt - openedAt) / (1000 * 60));
      }
      
      const incidentData = {
        sysId: inc.sys_id || null,
        number: inc.number,
        shortDescription: inc.short_description || '',
        description: inc.description || '',
        priority: inc.priority || '',
        severity: inc.severity || '',
        state: inc.state || '',
        category: inc.category || '',
        subcategory: inc.subcategory || '',
        assignmentGroup: typeof inc.assignment_group === 'object' ? (inc.assignment_group?.display_value || '') : (inc.assignment_group || ''),
        assignedTo: typeof inc.assigned_to === 'object' ? (inc.assigned_to?.display_value || '') : (inc.assigned_to || ''),
        caller: typeof inc.caller_id === 'object' ? (inc.caller_id?.display_value || '') : (inc.caller_id || ''),
        openedBy: typeof inc.opened_by === 'object' ? (inc.opened_by?.display_value || '') : (inc.opened_by || ''),
        resolvedBy: typeof inc.resolved_by === 'object' ? (inc.resolved_by?.display_value || '') : (inc.resolved_by || ''),
        closedBy: typeof inc.closed_by === 'object' ? (inc.closed_by?.display_value || '') : (inc.closed_by || ''),
        contactType: inc.contact_type || '',
        impact: inc.impact || '',
        urgency: inc.urgency || '',
        closeCode: inc.close_code || null,
        closeNotes: inc.close_notes || null,
        openedAt,
        resolvedAt,
        closedAt,
        responseTime,
        resolutionTime,
        isDemo: false,
      };
      
      logger.debug('SyncScheduler: Upserting incident', { 
        number: inc.number, 
        priority: inc.priority, 
        state: inc.state,
        severity: inc.severity 
      });
      
      await ServiceNowIncident.upsert(incidentData);
      synced++;
    } catch (err) {
      failed++;
      logger.warn('SyncScheduler: Failed to upsert incident', { 
        number: inc.number, 
        error: err.message,
        priority: inc.priority,
        state: inc.state,
        severity: inc.severity,
        stack: err.stack
      });
    }
  }
  
  logger.info('SyncScheduler: Incident sync completed', { 
    total: result.data.length, 
    synced, 
    failed 
  });
  
  return { synced, total: result.data.length, failed };
}

async function syncRitms(connConfig, filters) {
  await ServiceNowRitm.destroy({ where: { isDemo: false } });

  const result = await fetchFromServiceNow(connConfig, 'sc_req_item', filters);
  if (!result.success) return { synced: 0, error: result.error };

  let synced = 0;
  for (const ritm of result.data) {
    try {
      const openedAt = ritm.opened_at ? new Date(ritm.opened_at) : new Date();
      const fulfilledAt = ritm.closed_at ? new Date(ritm.closed_at) : null;
      
      let fulfillmentTime = null;
      if (fulfilledAt) {
        fulfillmentTime = Math.round((fulfilledAt - openedAt) / (1000 * 60));
      }
      
      await ServiceNowRitm.upsert({
        number: ritm.number,
        shortDescription: ritm.short_description || '',
        description: ritm.description || '',
        state: ritm.state || '',
        priority: ritm.priority || '',
        catalogItem: typeof ritm.cat_item === 'object' ? (ritm.cat_item?.display_value || '') : (ritm.cat_item || ''),
        requestedFor: typeof ritm.request === 'object' ? (ritm.request?.display_value || '') : (ritm.request || ''),
        requestedBy: typeof ritm.opened_by === 'object' ? (ritm.opened_by?.display_value || '') : (ritm.opened_by || ''),
        assignmentGroup: typeof ritm.assignment_group === 'object' ? (ritm.assignment_group?.display_value || '') : (ritm.assignment_group || ''),
        assignedTo: typeof ritm.assigned_to === 'object' ? (ritm.assigned_to?.display_value || '') : (ritm.assigned_to || ''),
        openedAt,
        fulfilledAt,
        fulfillmentTime,
        isDemo: false,
      });
      synced++;
    } catch (err) {
      logger.warn('SyncScheduler: Failed to upsert RITM', { number: ritm.number, error: err.message });
    }
  }
  return { synced, total: result.data.length };
}

async function syncChanges(connConfig, filters) {
  await ServiceNowChange.destroy({ where: { isDemo: false } });

  const result = await fetchFromServiceNow(connConfig, 'change_request', filters);
  if (!result.success) return { synced: 0, error: result.error };

  let synced = 0;
  for (const chg of result.data) {
    try {
      await ServiceNowChange.upsert({
        number: chg.number,
        shortDescription: chg.short_description || '',
        description: chg.description || '',
        type: chg.type || '',
        state: chg.state || '',
        risk: chg.risk || '',
        impact: chg.impact || '',
        category: chg.category || '',
        assignmentGroup: typeof chg.assignment_group === 'object' ? (chg.assignment_group?.display_value || '') : (chg.assignment_group || ''),
        assignedTo: typeof chg.assigned_to === 'object' ? (chg.assigned_to?.display_value || '') : (chg.assigned_to || ''),
        requestedBy: typeof chg.requested_by === 'object' ? (chg.requested_by?.display_value || '') : (chg.requested_by || ''),
        plannedStartDate: chg.start_date ? new Date(chg.start_date) : null,
        plannedEndDate: chg.end_date ? new Date(chg.end_date) : null,
        openedAt: chg.opened_at ? new Date(chg.opened_at) : new Date(),
        isDemo: false,
      });
      synced++;
    } catch (err) {
      logger.warn('SyncScheduler: Failed to upsert change', { number: chg.number, error: err.message });
    }
  }
  return { synced, total: result.data.length };
}

async function runSync() {
  const connConfig = readConnectionConfig();
  if (!connConfig || !connConfig.instanceUrl) {
    logger.warn('SyncScheduler: No connection config found, skipping sync');
    syncStatus = 'error';
    syncResults = { error: 'No connection configuration' };
    return syncResults;
  }

  const scheduleConfig = await getSyncScheduleConfig();
  const syncFilters = await getSyncFilterConfig();
  syncStatus = 'running';
  const results = { startedAt: new Date().toISOString(), incidents: null, ritms: null, changes: null };

  try {
    if (scheduleConfig.syncIncidents) {
      results.incidents = await syncIncidents(connConfig, syncFilters);
    }
    if (scheduleConfig.syncRitms) {
      results.ritms = await syncRitms(connConfig, syncFilters);
    }
    if (scheduleConfig.syncChanges) {
      results.changes = await syncChanges(connConfig, syncFilters);
    }

    results.completedAt = new Date().toISOString();
    lastSyncTime = results.completedAt;
    syncStatus = 'idle';
    syncResults = results;

    logger.info('SyncScheduler: Sync completed', results);
    return results;
  } catch (err) {
    syncStatus = 'error';
    syncResults = { error: err.message };
    logger.error('SyncScheduler: Sync failed', { error: err.message });
    return syncResults;
  }
}

function startScheduler(intervalMinutes) {
  stopScheduler();
  const ms = (intervalMinutes || 60) * 60 * 1000;
  syncTimer = setInterval(runSync, ms);
  logger.info(`SyncScheduler: Started with interval ${intervalMinutes} minutes`);
}

function stopScheduler() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    logger.info('SyncScheduler: Stopped');
  }
}

async function initScheduler() {
  try {
    const config = await getSyncScheduleConfig();
    if (config.enabled) {
      startScheduler(config.intervalMinutes);
    }
  } catch (err) {
    logger.warn('SyncScheduler: Failed to initialize', { error: err.message });
  }
}

function getSchedulerStatus() {
  return {
    running: !!syncTimer,
    status: syncStatus,
    lastSyncTime,
    lastResults: syncResults,
  };
}

export default {
  runSync,
  startScheduler,
  stopScheduler,
  initScheduler,
  getSchedulerStatus,
  getSyncScheduleConfig,
};
