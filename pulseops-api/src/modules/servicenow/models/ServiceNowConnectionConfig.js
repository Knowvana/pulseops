// ============================================================================
// ServiceNowConnectionConfig Model — PulseOps API
//
// PURPOSE: Stores the ServiceNow instance connection configuration. Contains
// the instance URL, authentication credentials (encrypted), and connection
// status. Password is encrypted at rest using AES-256-GCM.
//
// ARCHITECTURE: Module-specific table (servicenow_connection_config). Created
// when the ServiceNow module is enabled. Only ONE active config row exists.
// Password is encrypted before storage and decrypted only when needed for
// API calls to ServiceNow.
//
// SECURITY:
//   - Password is AES-256-GCM encrypted before storage
//   - Password is NEVER returned in API responses (masked as ***)
//   - Decryption only happens server-side during test-connect and API calls
//   - Encryption key is read from environment variable SERVICENOW_ENCRYPTION_KEY
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — Connection config CRUD
//   - src/modules/servicenow/schema.js                  — Schema definition
//   - Dashboard health checks use this to verify connectivity
//
// INTEGRATION FLOW:
//   Admin configures connection → password encrypted → saved to DB →
//   test-connect decrypts and validates → Dashboard shows health status
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowConnectionConfig = sequelize.define('ServiceNowConnectionConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  instanceUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'ServiceNow instance URL (e.g., https://company.service-now.com)',
  },
  username: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'ServiceNow API username',
  },
  encryptedPassword: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'AES-256-GCM encrypted password (never returned in API responses)',
  },
  authMethod: {
    type: DataTypes.ENUM('basic', 'oauth2'),
    defaultValue: 'basic',
    comment: 'Authentication method for ServiceNow API',
  },
  apiVersion: {
    type: DataTypes.STRING(10),
    defaultValue: 'v2',
    comment: 'ServiceNow REST API version',
  },
  connectionStatus: {
    type: DataTypes.ENUM('connected', 'disconnected', 'error', 'untested'),
    defaultValue: 'untested',
    comment: 'Last known connection status',
  },
  lastTestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the connection was last tested',
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last connection error message (if any)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this is the active configuration',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_connection_config',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['is_active'] },
    { fields: ['is_demo'] },
  ],
});

export default ServiceNowConnectionConfig;
