// ============================================================================
// Model Index — PulseOps API
//
// PURPOSE: Central barrel export for all Sequelize models. Ensures all
// models are imported and registered before sync. Defines associations.
//
// ARCHITECTURE: Core system models (system_* tables) are always loaded.
// Module-specific models are loaded here for Sequelize registration but
// their tables are only created when the module is initialized via the
// StepWizard flow.
//
// USED BY:
//   - src/server.js                   — Syncs core models on startup
//   - src/core/routes/databaseRoutes.js — Stats, schema status
//   - src/core/routes/moduleRoutes.js — Module enable/disable
//   - src/modules/roster/schema.js    — Module schema creation
//
// INTEGRATION FLOW:
//   server.js imports models → syncs core tables → seeds default data →
//   moduleRoutes.js reads SystemModule for module state
// ============================================================================

// --- Core System Models (always created on startup) ---
import User from './User.js';
import SystemConfig from './SystemConfig.js';
import SystemLog from './SystemLog.js';
import SystemModule from './SystemModule.js';

// --- Module Models (registered but tables created on module enable) ---
import RosterSchedule from '#modules/roster/models/RosterSchedule.js';
import RosterConfig from '#modules/roster/models/RosterConfig.js';
import ShiftRoasterShift from '#modules/roster/models/ShiftRoasterShift.js';
import ShiftRoasterEmployee from '#modules/roster/models/ShiftRoasterEmployee.js';
import ShiftRoasterLeave from '#modules/roster/models/ShiftRoasterLeave.js';

// --- ServiceNow Module Models ---
import ServiceNowIncident from '#modules/servicenow/models/ServiceNowIncident.js';
import ServiceNowRitm from '#modules/servicenow/models/ServiceNowRitm.js';
import ServiceNowChange from '#modules/servicenow/models/ServiceNowChange.js';
import ServiceNowSlaConfig from '#modules/servicenow/models/ServiceNowSlaConfig.js';
import ServiceNowBusinessHours from '#modules/servicenow/models/ServiceNowBusinessHours.js';
import ServiceNowConnectionConfig from '#modules/servicenow/models/ServiceNowConnectionConfig.js';

// --- Associations ---
ShiftRoasterLeave.belongsTo(ShiftRoasterEmployee, { foreignKey: 'employeeId', as: 'employee' });
ShiftRoasterEmployee.hasMany(ShiftRoasterLeave, { foreignKey: 'employeeId', as: 'leaves' });

const models = {
  // Core
  User,
  SystemConfig,
  SystemLog,
  SystemModule,
  // ShiftRoaster Module
  RosterSchedule,
  RosterConfig,
  ShiftRoasterShift,
  ShiftRoasterEmployee,
  ShiftRoasterLeave,
  // ServiceNow Module
  ServiceNowIncident,
  ServiceNowRitm,
  ServiceNowChange,
  ServiceNowSlaConfig,
  ServiceNowBusinessHours,
  ServiceNowConnectionConfig,
};

export {
  User, SystemConfig, SystemLog, SystemModule,
  RosterSchedule, RosterConfig,
  ShiftRoasterShift, ShiftRoasterEmployee, ShiftRoasterLeave,
  ServiceNowIncident, ServiceNowRitm, ServiceNowChange,
  ServiceNowSlaConfig, ServiceNowBusinessHours, ServiceNowConnectionConfig,
};
export default models;
