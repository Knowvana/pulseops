// ============================================================================
// SystemModule Model — PulseOps API
//
// PURPOSE: Persists module registration state in the database. Each module's
// enabled/disabled status, initialization state, and schema version are
// tracked here. This ensures pod restarts in Kubernetes do not lose
// module configuration — all state is in the database.
//
// ARCHITECTURE: Core system table (system_modules). The Admin module reads
// and writes to this table via the /api/modules endpoints. When a module
// is enabled via the StepWizard, its schema is created and this record
// is updated with initialized=true.
//
// USED BY:
//   - src/core/routes/moduleRoutes.js  — CRUD for module state
//   - src/server.js                    — Seeds default admin module on startup
//   - src/modules/*/schema.js          — Each module registers its schema needs
//
// INTEGRATION FLOW:
//   UI StepWizard → POST /api/modules/:id/enable → creates schema →
//   updates SystemModule.initialized = true → module appears in TopNav
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const SystemModule = sequelize.define('SystemModule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  moduleId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Unique module identifier matching the module manifest (e.g., platform_admin, shiftroaster)',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Human-readable module name',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  version: {
    type: DataTypes.STRING(20),
    defaultValue: '1.0.0',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Whether the module is enabled and visible in navigation',
  },
  initialized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Whether the module database schema has been created',
  },
  schemaVersion: {
    type: DataTypes.STRING(20),
    defaultValue: '0.0.0',
    comment: 'Current schema version for migration tracking',
  },
  isCore: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Core modules (admin) cannot be disabled',
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Module-specific configuration stored as JSON',
  },
  requiredTables: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'List of table names this module requires',
  },
  roles: {
    type: DataTypes.JSONB,
    defaultValue: ['admin'],
    comment: 'Roles that can access this module',
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Display order in navigation',
  },
  enabledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  enabledBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'system_modules',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['moduleId'] },
    { fields: ['enabled'] },
    { fields: ['isCore'] },
  ],
});

export default SystemModule;
