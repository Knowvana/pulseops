// ============================================================================
// SystemConfig Model — PulseOps API
//
// PURPOSE: Key-value store for platform-wide configuration.
// Used for runtime settings that admins can modify via the UI.
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const SystemConfig = sequelize.define('SystemConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(100),
    defaultValue: 'general',
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'system_config',
  timestamps: true,
});

export default SystemConfig;
