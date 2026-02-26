// ============================================================================
// SystemLog Model — PulseOps API
//
// PURPOSE: Sequelize model for system and API logs. Stores structured logs
// with source, event, API metadata, and request/response details.
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const SystemLog = sequelize.define('SystemLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    index: true,
  },
  level: {
    type: DataTypes.ENUM('debug', 'info', 'warn', 'error'),
    defaultValue: 'info',
    allowNull: false,
    index: true,
  },
  source: {
    type: DataTypes.ENUM('UI', 'API', 'Database', 'System'),
    allowNull: false,
    index: true,
  },
  event: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    index: true,
  },
  userEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  result: {
    type: DataTypes.ENUM('success', 'warning', 'failure'),
    defaultValue: 'success',
    allowNull: false,
    index: true,
  },
  apiUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  httpMethod: {
    type: DataTypes.ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'),
    allowNull: true,
  },
  responseCode: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true,
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  requestBody: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  responseBody: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'system_logs',
  timestamps: false,
  indexes: [
    { fields: ['timestamp', 'level'] },
    { fields: ['source', 'event'] },
    { fields: ['userId', 'timestamp'] },
    { fields: ['responseCode', 'timestamp'] },
  ],
});

export default SystemLog;
