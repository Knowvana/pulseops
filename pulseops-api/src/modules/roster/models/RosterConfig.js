// ============================================================================
// RosterConfig Model — PulseOps API
//
// PURPOSE: Stores roster configuration (shifts, employees, leaves) as a
// JSON blob. One active config per installation.
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '../../../core/database/sequelize.js';

const RosterConfig = sequelize.define('RosterConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shifts: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  employees: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  leaves: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'roster_config',
  timestamps: true,
});

export default RosterConfig;
