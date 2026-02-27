// ============================================================================
// ServiceNow Module Schema — PulseOps API
//
// PURPOSE: Defines the database schema requirements for the ServiceNow
// integration module. Exports functions to create tables, verify schema,
// load demo data, and wipe module data. Called by the module enable flow
// from moduleRoutes.js.
//
// ARCHITECTURE: Each module has a schema.js that exports:
//   - createSchema()       — Creates all module-specific tables
//   - verifySchema()       — Checks if all required tables exist
//   - loadDemoData()       — Seeds demo data into module tables
//   - wipeDemoData()       — Removes demo data only
//   - wipeModuleData()     — Removes all module data (hard reset)
//   - getRequiredTables()  — Returns list of required table names
//
// USED BY:
//   - src/core/routes/moduleRoutes.js — POST /api/modules/:id/initialize
//   - src/core/routes/moduleRoutes.js — POST /api/modules/:id/demo-data
//
// INTEGRATION FLOW:
//   Admin clicks Enable Module → StepWizard → POST /api/modules/servicenow/initialize
//   → this file's createSchema() → tables created → module marked initialized
// ============================================================================
import logger, { logMessages } from '#core/logger.js';
import queryService from '#core/database/queryService.js';

import ServiceNowIncident from './models/ServiceNowIncident.js';
import ServiceNowRitm from './models/ServiceNowRitm.js';
import ServiceNowChange from './models/ServiceNowChange.js';
import ServiceNowSlaConfig from './models/ServiceNowSlaConfig.js';
import ServiceNowBusinessHours from './models/ServiceNowBusinessHours.js';
import ServiceNowConfigSettings from './models/ServiceNowConfigSettings.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const demoData = require('./demoData_ServiceNow.json');

const REQUIRED_TABLES = [
  'servicenow_incidents',
  'servicenow_ritms',
  'servicenow_changes',
  'servicenow_sla_config',
  'servicenow_business_hours',
  'servicenow_config_settings',
];

/**
 * Create all ServiceNow module tables.
 * @returns {Promise<{success: boolean, tables: string[]}>}
 */
export async function createSchema() {
  try {
    logger.info(logMessages.database.syncing + ' (ServiceNow module)');

    const models = [
      ServiceNowIncident,
      ServiceNowRitm,
      ServiceNowChange,
      ServiceNowSlaConfig,
      ServiceNowBusinessHours,
      ServiceNowConfigSettings,
    ];

    const tablesCreated = [];
    for (const model of models) {
      await model.sync({ alter: true });
      // Sequelize v6 getTableName() returns an object: { tableName, schema, delimiter }
      // We need to extract just the tableName string
      const tableNameObj = model.getTableName();
      const tableName = typeof tableNameObj === 'string' 
        ? tableNameObj 
        : (typeof tableNameObj === 'object' && tableNameObj.tableName 
            ? tableNameObj.tableName 
            : model.tableName || 'unknown');
      
      const attrs = model.rawAttributes;
      const columns = Object.keys(attrs).map(col => ({
        name: col,
        type: attrs[col].type?.key || attrs[col].type?.constructor?.name || 'UNKNOWN',
        allowNull: attrs[col].allowNull !== false,
      }));
      tablesCreated.push({ name: tableName, columns, columnCount: columns.length });
    }

    logger.info(logMessages.database.schemaCreated + ' (ServiceNow module)');

    return {
      success: true,
      message: 'ServiceNow module schema created successfully',
      tables: tablesCreated,
      tableCount: tablesCreated.length,
    };
  } catch (err) {
    logger.error(logMessages.database.syncFailed + ' (ServiceNow module)', { error: err.message });
    throw err;
  }
}

/**
 * Verify all required tables exist.
 * @returns {Promise<{initialized: boolean, existing: string[], missing: string[]}>}
 */
export async function verifySchema() {
  try {
    const tableNames = await queryService.getTablesBySchema();
    const existing = REQUIRED_TABLES.filter(t => tableNames.includes(t));
    const missing = REQUIRED_TABLES.filter(t => !tableNames.includes(t));

    return {
      initialized: missing.length === 0,
      existing,
      missing,
      total: REQUIRED_TABLES.length,
    };
  } catch (err) {
    return { initialized: false, existing: [], missing: REQUIRED_TABLES, total: REQUIRED_TABLES.length };
  }
}

/**
 * Helper: compute a date offset from now in days (supports fractional days).
 * @param {number|null} offsetDays — Days relative to now (negative = past)
 * @returns {Date|null}
 */
function offsetDate(offsetDays) {
  if (offsetDays === null || offsetDays === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/**
 * Load demo data for the ServiceNow module.
 * Seeds 10 incidents, 10 RITMs, 10 changes, SLA configs, business hours,
 * and a demo connection config.
 * @returns {Promise<{success: boolean, counts: Object}>}
 */
export async function loadDemoData() {
  try {
    logger.info(logMessages.database.seedingDemo + ' (ServiceNow module)');

    const counts = { incidents: 0, ritms: 0, changes: 0, slaConfigs: 0, businessHours: 0 };

    // --- Seed Incidents ---
    for (const inc of demoData.incidents) {
      await ServiceNowIncident.findOrCreate({
        where: { number: inc.number },
        defaults: {
          ...inc,
          openedAt: offsetDate(inc.openedAtOffset),
          resolvedAt: offsetDate(inc.resolvedAtOffset),
          closedAt: inc.state === 'Closed' ? offsetDate(inc.resolvedAtOffset) : null,
          slaResponseBreached: false,
          slaResolutionBreached: false,
          isDemo: true,
        },
      });
      counts.incidents++;
    }

    // Calculate SLA breaches for incidents
    const slaConfigs = demoData.slaConfig.filter(s => s.recordType === 'incident');
    const allIncidents = await ServiceNowIncident.findAll({ where: { isDemo: true } });
    for (const incident of allIncidents) {
      const sla = slaConfigs.find(s => s.priority === incident.priority);
      if (sla && incident.responseTime !== null) {
        incident.slaResponseBreached = incident.responseTime > sla.responseTimeMinutes;
      }
      if (sla && incident.resolutionTime !== null) {
        incident.slaResolutionBreached = incident.resolutionTime > sla.resolutionTimeMinutes;
      }
      await incident.save();
    }

    // --- Seed RITMs ---
    for (const ritm of demoData.ritms) {
      await ServiceNowRitm.findOrCreate({
        where: { number: ritm.number },
        defaults: {
          ...ritm,
          openedAt: offsetDate(ritm.openedAtOffset),
          fulfilledAt: offsetDate(ritm.fulfilledAtOffset),
          closedAt: ritm.state === 'Closed' ? offsetDate(ritm.fulfilledAtOffset) : null,
          slaResponseBreached: false,
          slaFulfillmentBreached: false,
          isDemo: true,
        },
      });
      counts.ritms++;
    }

    // Calculate SLA breaches for RITMs
    const ritmSlaConfigs = demoData.slaConfig.filter(s => s.recordType === 'ritm');
    const allRitms = await ServiceNowRitm.findAll({ where: { isDemo: true } });
    for (const ritm of allRitms) {
      const sla = ritmSlaConfigs.find(s => s.priority === ritm.priority);
      if (sla && ritm.responseTime !== null) {
        ritm.slaResponseBreached = ritm.responseTime > sla.responseTimeMinutes;
      }
      if (sla && ritm.fulfillmentTime !== null) {
        ritm.slaFulfillmentBreached = ritm.fulfillmentTime > sla.resolutionTimeMinutes;
      }
      await ritm.save();
    }

    // --- Seed Changes ---
    for (const chg of demoData.changes) {
      await ServiceNowChange.findOrCreate({
        where: { number: chg.number },
        defaults: {
          ...chg,
          openedAt: offsetDate(chg.openedAtOffset),
          plannedStartDate: offsetDate(chg.plannedStartOffset),
          plannedEndDate: offsetDate(chg.plannedEndOffset),
          actualStartDate: offsetDate(chg.actualStartOffset),
          actualEndDate: offsetDate(chg.actualEndOffset),
          closedAt: chg.state === 'Closed' ? offsetDate(chg.actualEndOffset || chg.plannedEndOffset) : null,
          isDemo: true,
        },
      });
      counts.changes++;
    }

    // --- Seed SLA Configs ---
    for (const sla of demoData.slaConfig) {
      await ServiceNowSlaConfig.findOrCreate({
        where: { priority: sla.priority, recordType: sla.recordType },
        defaults: {
          ...sla,
          isActive: true,
          isDemo: true,
        },
      });
      counts.slaConfigs++;
    }

    // --- Seed Business Hours ---
    for (const bh of demoData.businessHours) {
      await ServiceNowBusinessHours.findOrCreate({
        where: { dayOfWeek: bh.dayOfWeek },
        defaults: {
          ...bh,
          isDemo: true,
        },
      });
      counts.businessHours++;
    }

    logger.info(logMessages.database.seedComplete + ' (ServiceNow module)', counts);
    return {
      success: true,
      message: 'ServiceNow demo data loaded successfully',
      counts,
    };
  } catch (err) {
    logger.error(logMessages.database.syncFailed + ' (ServiceNow demo data)', { error: err.message });
    throw err;
  }
}

/**
 * Wipe only demo data from ServiceNow module tables.
 * @returns {Promise<{success: boolean}>}
 */
export async function wipeDemoData() {
  try {
    await ServiceNowIncident.destroy({ where: { isDemo: true } });
    await ServiceNowRitm.destroy({ where: { isDemo: true } });
    await ServiceNowChange.destroy({ where: { isDemo: true } });
    await ServiceNowSlaConfig.destroy({ where: { isDemo: true } });
    await ServiceNowBusinessHours.destroy({ where: { isDemo: true } });
    logger.info('ServiceNow demo data removed successfully');
    return { success: true };
  } catch (err) {
    logger.error('Failed to wipe ServiceNow demo data', { error: err.message });
    throw err;
  }
}

/**
 * Wipe ALL ServiceNow module data (hard reset).
 * Drops all module tables from the database using queryService.dropTable().
 * @returns {Promise<{success: boolean, droppedTables: Array}>}
 */
export async function wipeModuleData() {
  const droppedTables = [];
  let hasErrors = false;

  try {
    const existingTables = await queryService.getTablesBySchema();
    logger.info('wipeModuleData: Existing tables in schema', { existingTables, requiredTables: REQUIRED_TABLES });

    // Drop tables one at a time, waiting for each to complete
    for (const tableName of REQUIRED_TABLES) {
      if (!existingTables.includes(tableName)) {
        logger.warn(`Table not found in schema: ${tableName}`, { existingTables });
        droppedTables.push({ name: tableName, status: 'not_found' });
        continue;
      }
      try {
        logger.info(`Attempting to drop table: ${tableName}`);
        await queryService.dropTable(tableName);
        logger.info(`Successfully dropped table: ${tableName}`);
        
        // Verify this specific table is gone before moving to next
        const stillExists = await queryService.tableExists(tableName);
        if (stillExists) {
          logger.error(`Table still exists after DROP: ${tableName}`);
          droppedTables.push({ name: tableName, status: 'failed', error: 'Table still exists after DROP' });
          hasErrors = true;
        } else {
          droppedTables.push({ name: tableName, status: 'dropped' });
        }
      } catch (err) {
        logger.error(`Failed to drop table ${tableName}`, { error: err.message, stack: err.stack });
        droppedTables.push({ name: tableName, status: 'error', error: err.message });
        hasErrors = true;
      }
    }

    // Drop orphaned enum types created by Sequelize for this module
    try {
      const enums = await queryService.getEnumTypes();
      const snEnums = enums.filter(e => e.startsWith('enum_servicenow'));
      for (const typeName of snEnums) {
        await queryService.dropEnumType(typeName);
        logger.info(`Dropped enum type ${typeName}`);
      }
    } catch (_) {}

    // Verify tables are actually gone
    const remaining = await queryService.getTablesBySchema();
    logger.info('wipeModuleData: Remaining tables after drop attempt', { remaining, droppedTables });
    for (const entry of droppedTables) {
      if (entry.status === 'dropped' && remaining.includes(entry.name)) {
        logger.error(`Table still exists after DROP: ${entry.name}`, { remaining });
        entry.status = 'failed';
        entry.error = 'Table still exists after DROP — check database permissions';
        hasErrors = true;
      }
    }

    const droppedCount = droppedTables.filter(t => t.status === 'dropped').length;
    const notFoundCount = droppedTables.filter(t => t.status === 'not_found').length;
    
    // If all tables were not found, this is not a successful operation
    const success = droppedCount > 0 && !hasErrors;
    
    logger.info('ServiceNow hard reset completed', { droppedTables, droppedCount, notFoundCount, hasErrors, success });
    return {
      success,
      droppedTables,
      droppedCount,
      notFoundCount,
      message: droppedCount > 0 
        ? `Dropped ${droppedCount} of ${REQUIRED_TABLES.length} tables`
        : notFoundCount === REQUIRED_TABLES.length
          ? 'No tables found - schema may not be initialized'
          : 'Failed to drop tables',
    };
  } catch (err) {
    logger.error('Failed to wipe ServiceNow data', { error: err.message, stack: err.stack });
    return { success: false, droppedTables, droppedCount: 0, message: `Error during wipe: ${err.message}` };
  }
}

/**
 * Get the list of required table names for this module.
 * @returns {string[]}
 */
export function getRequiredTables() {
  return REQUIRED_TABLES;
}

export default {
  createSchema,
  verifySchema,
  loadDemoData,
  wipeDemoData,
  wipeModuleData,
  getRequiredTables,
};
