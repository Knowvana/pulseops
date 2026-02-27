// ============================================================================
// ShiftRoaster Module Schema — PulseOps API
//
// PURPOSE: Defines the database schema requirements for the ShiftRoaster
// module. Exports functions to create tables, verify schema, and load
// demo data. Called by the module enable flow from moduleRoutes.js.
//
// ARCHITECTURE: Each module has a schema.js that exports:
//   - createSchema()   — Creates all module-specific tables
//   - verifySchema()   — Checks if all required tables exist
//   - loadDemoData()   — Seeds demo data into module tables
//   - wipeDemoData()   — Removes all module data
//   - getRequiredTables() — Returns list of required table names
//
// USED BY:
//   - src/core/routes/moduleRoutes.js — POST /api/modules/:id/initialize
//   - src/core/routes/moduleRoutes.js — POST /api/modules/:id/demo-data
//
// INTEGRATION FLOW:
//   Admin clicks Enable Module → StepWizard → POST /api/modules/shiftroaster/initialize
//   → this file's createSchema() → tables created → module marked initialized
// ============================================================================
import sequelize from '#core/database/sequelize.js';
import logger, { logMessages } from '#core/logger.js';
import queryService from '#core/database/queryService.js';
import { createRequire } from 'module';

// Import all module models (this registers them with Sequelize)
import ShiftRoasterShift from './models/ShiftRoasterShift.js';
import ShiftRoasterEmployee from './models/ShiftRoasterEmployee.js';
import ShiftRoasterLeave from './models/ShiftRoasterLeave.js';
import RosterSchedule from './models/RosterSchedule.js';
import RosterConfig from './models/RosterConfig.js';

const require = createRequire(import.meta.url);
const demoData = require('./demoData.json');

const REQUIRED_TABLES = [
  'shiftroaster_shifts',
  'shiftroaster_employees',
  'shiftroaster_leaves',
  'shiftroaster_config',
  'shiftroaster_schedules',
];

/**
 * Create all ShiftRoaster module tables.
 * @returns {Promise<{success: boolean, tables: string[]}>}
 */
export async function createSchema() {
  try {
    logger.info(logMessages.database.syncing + ' (ShiftRoaster module)');

    const models = [
      ShiftRoasterShift,
      ShiftRoasterEmployee,
      ShiftRoasterLeave,
      RosterSchedule,
      RosterConfig,
    ];

    for (const model of models) {
      await model.sync({ alter: true });
    }

    logger.info(logMessages.database.schemaCreated + ' (ShiftRoaster module)');

    const schema = queryService.getSchema();
    return {
      success: true,
      message: 'Module schema created successfully',
      schema,
      tables: REQUIRED_TABLES,
      tableCount: REQUIRED_TABLES.length,
    };
  } catch (err) {
    logger.error(logMessages.database.syncFailed + ' (ShiftRoaster module)', { error: err.message });
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
 * Load demo data for the ShiftRoaster module.
 * @returns {Promise<{success: boolean, counts: Object}>}
 */
export async function loadDemoData() {
  try {
    logger.info(logMessages.database.seedingDemo + ' (ShiftRoaster module)');

    // Seed shifts
    const shiftCounts = { shifts: 0, employees: 0, leaves: 0 };
    for (const shift of demoData.shifts) {
      await ShiftRoasterShift.findOrCreate({
        where: { label: shift.label },
        defaults: shift,
      });
      shiftCounts.shifts++;
    }

    // Seed employees
    for (const emp of demoData.employees) {
      await ShiftRoasterEmployee.findOrCreate({
        where: { name: emp.name },
        defaults: emp,
      });
      shiftCounts.employees++;
    }

    // Seed leaves
    for (const leave of demoData.leaves) {
      const employee = await ShiftRoasterEmployee.findOne({ where: { name: leave.employeeName } });
      if (employee) {
        await ShiftRoasterLeave.create({
          employeeId: employee.id,
          startDate: leave.startDate,
          endDate: leave.endDate,
          leaveType: leave.leaveType,
          reason: leave.reason,
        });
        shiftCounts.leaves++;
      }
    }

    logger.info(logMessages.database.seedComplete + ' (ShiftRoaster module)', shiftCounts);
    return {
      success: true,
      message: 'Demo data loaded successfully',
      counts: shiftCounts,
    };
  } catch (err) {
    logger.error(logMessages.database.syncFailed + ' (ShiftRoaster demo data)', { error: err.message });
    throw err;
  }
}

/**
 * Wipe all ShiftRoaster module data.
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
      const rosterEnums = enums.filter(e => e.startsWith('enum_shiftroaster'));
      for (const typeName of rosterEnums) {
        await queryService.dropEnumType(typeName);
        logger.info(`Dropped enum type ${typeName}`);
      }
    } catch (_) {}

    // Final verification - check all tables are gone
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
    
    logger.info('ShiftRoaster hard reset completed', { droppedTables, droppedCount, notFoundCount, hasErrors, success });
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
    logger.error('Failed to wipe ShiftRoaster data', { error: err.message, stack: err.stack });
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
  wipeModuleData,
  getRequiredTables,
};
