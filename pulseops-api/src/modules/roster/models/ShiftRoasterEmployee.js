// ============================================================================
// ShiftRoasterEmployee Model — PulseOps API
//
// PURPOSE: Stores employee/resource records for the ShiftRoaster module.
// Each employee can be assigned to shifts and has skills, availability,
// and contact information.
//
// ARCHITECTURE: Module-specific table (shiftroaster_employees). Created when
// the ShiftRoaster module is enabled via the StepWizard.
//
// USED BY:
//   - src/modules/roster/routes/rosterRoutes.js — CRUD for employees
//   - src/modules/roster/schema.js              — Schema definition
//
// INTEGRATION FLOW:
//   Admin enables module → schema creates table → RosterConfig manages
//   employees → RosterDashboard assigns them to shifts
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '../../../core/database/sequelize.js';

const ShiftRoasterEmployee = sequelize.define('ShiftRoasterEmployee', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(100),
    defaultValue: 'operator',
    comment: 'Employee role within the roster (e.g., operator, lead, supervisor)',
  },
  skills: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of skill tags for the employee',
  },
  maxShiftsPerWeek: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  isShiftLead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'shiftroaster_employees',
  timestamps: true,
});

export default ShiftRoasterEmployee;
