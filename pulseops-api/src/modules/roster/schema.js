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
 * @returns {Promise<{success: boolean}>}
 */
export async function wipeModuleData() {
  try {
    await ShiftRoasterLeave.destroy({ where: {}, truncate: true, cascade: true });
    await ShiftRoasterEmployee.destroy({ where: {}, truncate: true, cascade: true });
    await ShiftRoasterShift.destroy({ where: {}, truncate: true, cascade: true });
    await RosterSchedule.destroy({ where: {}, truncate: true, cascade: true });
    await RosterConfig.destroy({ where: {}, truncate: true, cascade: true });
    return { success: true };
  } catch (err) {
    logger.error('Failed to wipe ShiftRoaster data', { error: err.message });
    throw err;
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
