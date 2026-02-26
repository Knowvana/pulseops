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
import RosterSchedule from '../../../modules/roster/models/RosterSchedule.js';
import RosterConfig from '../../../modules/roster/models/RosterConfig.js';
import ShiftRoasterShift from '../../../modules/roster/models/ShiftRoasterShift.js';
import ShiftRoasterEmployee from '../../../modules/roster/models/ShiftRoasterEmployee.js';
import ShiftRoasterLeave from '../../../modules/roster/models/ShiftRoasterLeave.js';

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
};

export {
  User, SystemConfig, SystemLog, SystemModule,
  RosterSchedule, RosterConfig,
  ShiftRoasterShift, ShiftRoasterEmployee, ShiftRoasterLeave,
};
export default models;
