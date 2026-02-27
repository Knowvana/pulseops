// ============================================================================
// ServiceNowConfigSettings Model — PulseOps API
//
// PURPOSE: Stores configuration settings for the ServiceNow module, including
// sync schedule configuration. Each setting is a key-value pair with a
// category for grouping.
//
// ARCHITECTURE: Module-specific table (servicenow_config_settings). Created
// when the ServiceNow module is enabled via the StepWizard. Used by the
// sync scheduler to determine polling intervals and sync targets.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — Config CRUD
//   - src/modules/servicenow/utils/syncScheduler.js     — Reads schedule config
//   - src/modules/servicenow/schema.js                  — Schema definition
//
// INTEGRATION FLOW:
//   Admin configures sync schedule → saved to DB → Scheduler reads config →
//   Auto-syncs data from ServiceNow at configured intervals
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowConfigSettings = sequelize.define('ServiceNowConfigSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'sync',
    comment: 'Setting category (sync, general, etc.)',
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Setting key name',
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Setting value (JSON-stringified for complex values)',
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Human-readable description of this setting',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this setting is currently active',
  },
}, {
  tableName: 'servicenow_config_settings',
  timestamps: true,
  indexes: [
    { fields: ['category', 'key'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] },
  ],
});

export default ServiceNowConfigSettings;
