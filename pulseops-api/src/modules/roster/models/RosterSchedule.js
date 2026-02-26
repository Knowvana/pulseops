// ============================================================================
// RosterSchedule Model — PulseOps API
//
// PURPOSE: Stores generated roster schedules. Each record represents a
// full month's schedule stored as a JSON blob alongside metadata.
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const RosterSchedule = sequelize.define('RosterSchedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 12 },
  },
  schedule: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'shiftroaster_schedules',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['year', 'month'] },
  ],
});

export default RosterSchedule;
