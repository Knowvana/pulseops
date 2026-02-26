// ============================================================================
// ShiftRoasterShift Model — PulseOps API
//
// PURPOSE: Stores individual shift definitions (e.g., Morning, Afternoon, Night).
// Each shift has a label, time range, color, and staffing requirements.
//
// ARCHITECTURE: Module-specific table (shiftroaster_shifts). Created when the
// ShiftRoaster module is enabled via the StepWizard. Part of the ShiftRoaster
// module's required schema.
//
// USED BY:
//   - src/modules/roster/routes/rosterRoutes.js — CRUD for shifts
//   - src/modules/roster/schema.js              — Schema definition
//
// INTEGRATION FLOW:
//   Admin enables module → schema.js creates table → API serves shift data →
//   UI RosterConfig reads/writes shifts → RosterDashboard displays them
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ShiftRoasterShift = sequelize.define('ShiftRoasterShift', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Shift display name (e.g., Morning, Afternoon, Night)',
  },
  shortCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Short code for compact views (e.g., M, A, N)',
  },
  startTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'Shift start time in HH:mm format',
  },
  endTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'Shift end time in HH:mm format',
  },
  color: {
    type: DataTypes.STRING(255),
    defaultValue: 'bg-slate-100 text-slate-800 border-slate-200',
    comment: 'Tailwind CSS color classes for UI display',
  },
  reqWeekday: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Minimum staff required on weekdays',
  },
  reqWeekend: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Minimum staff required on weekends',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'shiftroaster_shifts',
  timestamps: true,
});

export default ShiftRoasterShift;
