// ============================================================================
// ShiftRoasterLeave Model — PulseOps API
//
// PURPOSE: Stores planned leave records for employees. Used by the roster
// generation algorithm to exclude employees from shifts during their leave.
//
// ARCHITECTURE: Module-specific table (shiftroaster_leaves). Created when
// the ShiftRoaster module is enabled via the StepWizard.
//
// USED BY:
//   - src/modules/roster/routes/rosterRoutes.js — CRUD for leaves
//   - src/modules/roster/schema.js              — Schema definition
//
// INTEGRATION FLOW:
//   RosterConfig manages leaves → generateRoster() checks leaves →
//   employees on leave are excluded from shift assignments
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '../../../core/database/sequelize.js';

const ShiftRoasterLeave = sequelize.define('ShiftRoasterLeave', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Reference to shiftroaster_employees.id',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  leaveType: {
    type: DataTypes.STRING(50),
    defaultValue: 'planned',
    comment: 'Leave type: planned, sick, emergency, training',
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved',
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'shiftroaster_leaves',
  timestamps: true,
  indexes: [
    { fields: ['employeeId'] },
    { fields: ['startDate', 'endDate'] },
  ],
});

export default ShiftRoasterLeave;
