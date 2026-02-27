// ============================================================================
// ServiceNowBusinessHours Model — PulseOps API
//
// PURPOSE: Stores configurable business hours and business days for the
// ServiceNow module. Used to calculate SLA compliance by adjusting
// incident/RITM response and resolution times to only count business hours.
//
// ARCHITECTURE: Module-specific table (servicenow_business_hours). Created
// when the ServiceNow module is enabled. Each record represents one day of
// the week with start/end hours and whether it's a business day.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — Business hours CRUD
//   - src/modules/servicenow/schema.js                  — Schema definition
//   - SLA calculation engine uses these to compute business-hour durations
//
// INTEGRATION FLOW:
//   Admin configures business hours → saved to DB → SLA engine reads them →
//   Reports adjust time calculations to only count working hours
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowBusinessHours = sequelize.define('ServiceNowBusinessHours', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Day of the week (0=Sunday, 1=Monday, ... 6=Saturday)',
    validate: { min: 0, max: 6 },
  },
  dayName: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Day name (e.g., Monday, Tuesday)',
  },
  isBusinessDay: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this day is a business day',
  },
  startTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '09:00',
    comment: 'Business hours start time (HH:mm)',
  },
  endTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: '17:00',
    comment: 'Business hours end time (HH:mm)',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_business_hours',
  timestamps: true,
  indexes: [
    { fields: ['dayOfWeek'], unique: true },
    { fields: ['isBusinessDay'] },
    { fields: ['isDemo'] },
  ],
});

export default ServiceNowBusinessHours;
