// ============================================================================
// ServiceNowChange Model — PulseOps API
//
// PURPOSE: Stores ServiceNow Change Request records. Each change has a number,
// type, risk, state, assignment details, and implementation window timestamps.
//
// ARCHITECTURE: Module-specific table (servicenow_changes). Created when
// the ServiceNow module is enabled via the StepWizard.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — CRUD for changes
//   - src/modules/servicenow/schema.js                  — Schema definition
//
// INTEGRATION FLOW:
//   Admin enables module → schema.js creates table → API serves change data →
//   UI Reports reads/writes changes → Dashboard displays counts
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowChange = sequelize.define('ServiceNowChange', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'Change number (e.g., CHG0010001)',
  },
  shortDescription: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Brief description of the change',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full detailed description of the change',
  },
  type: {
    type: DataTypes.STRING(50),
    defaultValue: 'normal',
    comment: 'Change request type (normal, standard, emergency)',
  },
  state: {
    type: DataTypes.STRING(50),
    defaultValue: 'new',
    comment: 'Current change state',
  },
  risk: {
    type: DataTypes.STRING(50),
    defaultValue: 'moderate',
    comment: 'Risk assessment level',
  },
  impact: {
    type: DataTypes.STRING(20),
    defaultValue: '2',
    comment: 'Business impact level (1=High, 2=Medium, 3=Low)',
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Change category (e.g., Hardware, Software, Network)',
  },
  assignmentGroup: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Team/group assigned to implement',
  },
  assignedTo: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Individual assigned to the change',
  },
  requestedBy: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Person who requested the change',
  },
  plannedStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Planned implementation start date',
  },
  plannedEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Planned implementation end date',
  },
  actualStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Actual implementation start date',
  },
  actualEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Actual implementation end date',
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When the change was opened',
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the change was closed',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_changes',
  timestamps: true,
  indexes: [
    { fields: ['number'], unique: true },
    { fields: ['state'] },
    { fields: ['type'] },
    { fields: ['openedAt'] },
    { fields: ['isDemo'] },
  ],
});

export default ServiceNowChange;
