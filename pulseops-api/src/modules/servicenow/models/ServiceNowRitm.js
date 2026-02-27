// ============================================================================
// ServiceNowRitm Model — PulseOps API
//
// PURPOSE: Stores ServiceNow Requested Item (RITM) records. Each RITM
// represents a service catalog request with number, description, state,
// requested for, assignment details, and timestamps for SLA tracking.
//
// ARCHITECTURE: Module-specific table (servicenow_ritms). Created when
// the ServiceNow module is enabled via the StepWizard.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — CRUD for RITMs
//   - src/modules/servicenow/schema.js                  — Schema definition
//
// INTEGRATION FLOW:
//   Admin enables module → schema.js creates table → API serves RITM data →
//   UI Reports reads/writes RITMs → Dashboard displays counts
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowRitm = sequelize.define('ServiceNowRitm', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'RITM number (e.g., RITM0010001)',
  },
  shortDescription: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Brief description of the request',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full detailed description of the request',
  },
  state: {
    type: DataTypes.STRING(50),
    defaultValue: '1',
    comment: 'Current RITM state (numeric or text from ServiceNow)',
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: '3',
    comment: 'RITM priority level (1=Critical, 2=High, 3=Medium, 4=Low)',
  },
  catalogItem: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Service catalog item name',
  },
  requestedFor: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Person the request is for',
  },
  requestedBy: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Person who submitted the request',
  },
  assignmentGroup: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Team/group assigned to fulfill',
  },
  assignedTo: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Individual assigned to the RITM',
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When the RITM was opened',
  },
  fulfilledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the RITM was fulfilled',
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the RITM was closed',
  },
  responseTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Time to first response in minutes (calculated)',
  },
  fulfillmentTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Time to fulfillment in minutes (calculated)',
  },
  slaResponseBreached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether SLA response time was breached',
  },
  slaFulfillmentBreached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether SLA fulfillment time was breached',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_ritms',
  timestamps: true,
  indexes: [
    { fields: ['number'], unique: true },
    { fields: ['state'] },
    { fields: ['priority'] },
    { fields: ['openedAt'] },
    { fields: ['isDemo'] },
  ],
});

export default ServiceNowRitm;
