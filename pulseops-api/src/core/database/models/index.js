// ============================================================================
// Model Index — PulseOps API
//
// PURPOSE: Central barrel export for all Sequelize models. Ensures all
// models are imported and registered before sync. Defines associations.
// ============================================================================
import User from './User.js';
import SystemConfig from './SystemConfig.js';
import SystemLog from './SystemLog.js';
import RosterSchedule from '../../../modules/roster/models/RosterSchedule.js';
import RosterConfig from '../../../modules/roster/models/RosterConfig.js';

const models = {
  User,
  SystemConfig,
  SystemLog,
  RosterSchedule,
  RosterConfig,
};

export { User, SystemConfig, SystemLog, RosterSchedule, RosterConfig };
export default models;
