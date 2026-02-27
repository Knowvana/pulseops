// ============================================================================
// ServiceNowSlaConfig Model — PulseOps API
//
// PURPOSE: Stores SLA configuration for the ServiceNow module. Defines
// contract-level SLA targets for incident response time, resolution time,
// and RITM fulfillment time by priority level.
//
// ARCHITECTURE: Module-specific table (servicenow_sla_config). Created when
// the ServiceNow module is enabled via the StepWizard. SLA values are in
// minutes and are compared against actual incident/RITM times to calculate
// SLA compliance reports.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — SLA config CRUD
//   - src/modules/servicenow/schema.js                  — Schema definition
//   - Reports engine uses these targets to calculate compliance %
//
// INTEGRATION FLOW:
//   Admin configures SLAs → saved to DB → Reports compare actuals vs targets
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowSlaConfig = sequelize.define('ServiceNowSlaConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Priority level this SLA applies to (e.g., 1 - Critical)',
  },
  recordType: {
    type: DataTypes.ENUM('incident', 'ritm'),
    allowNull: false,
    defaultValue: 'incident',
    comment: 'Which record type this SLA applies to',
  },
  responseTimeMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    comment: 'Target response time in minutes (business hours)',
  },
  resolutionTimeMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 480,
    comment: 'Target resolution/fulfillment time in minutes (business hours)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this SLA rule is currently active',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_sla_config',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['priority', 'record_type'], unique: true },
    { fields: ['is_active'] },
    { fields: ['is_demo'] },
  ],
});

export default ServiceNowSlaConfig;
