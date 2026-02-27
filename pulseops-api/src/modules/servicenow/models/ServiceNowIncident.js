// ============================================================================
// ServiceNowIncident Model — PulseOps API
//
// PURPOSE: Stores ServiceNow incident records. Each incident has a number,
// short description, priority, state, assignment group, assigned to,
// category, subcategory, and timestamps for SLA measurement.
//
// ARCHITECTURE: Module-specific table (servicenow_incidents). Created when
// the ServiceNow module is enabled via the StepWizard. Part of the
// ServiceNow module's required schema.
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — CRUD for incidents
//   - src/modules/servicenow/schema.js                  — Schema definition
//
// INTEGRATION FLOW:
//   Admin enables module → schema.js creates table → API serves incident data →
//   UI ServiceNowReports reads/writes incidents → Dashboard displays counts
// ============================================================================
import { DataTypes } from 'sequelize';
import sequelize from '#core/database/sequelize.js';

const ServiceNowIncident = sequelize.define('ServiceNowIncident', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'Incident number (e.g., INC0010001)',
  },
  shortDescription: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Brief description of the incident',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full detailed description of the incident',
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: '3',
    comment: 'Incident priority level (1=Critical, 2=High, 3=Medium, 4=Low, 5=Planning)',
  },
  severity: {
    type: DataTypes.STRING(20),
    defaultValue: '2',
    comment: 'Incident severity level (1=High, 2=Medium, 3=Low)',
  },
  state: {
    type: DataTypes.STRING(50),
    defaultValue: '',
    comment: 'Current incident state (numeric or text from ServiceNow)',
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Incident category (e.g., Hardware, Software, Network)',
  },
  subcategory: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Incident subcategory',
  },
  assignmentGroup: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Team/group assigned to resolve',
  },
  assignedTo: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Individual assigned to the incident',
  },
  caller: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Person who reported the incident',
  },
  contactType: {
    type: DataTypes.STRING(50),
    defaultValue: '',
    comment: 'How the incident was reported (phone, email, self-service, walk-in, chat, etc.)',
  },
  impact: {
    type: DataTypes.STRING(20),
    defaultValue: '',
    comment: 'Business impact level (numeric or text from ServiceNow)',
  },
  urgency: {
    type: DataTypes.STRING(20),
    defaultValue: '',
    comment: 'How quickly the incident needs resolution (numeric or text from ServiceNow)',
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When the incident was opened',
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the incident was resolved',
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the incident was closed',
  },
  responseTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Time to first response in minutes (calculated)',
  },
  resolutionTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Time to resolution in minutes (calculated)',
  },
  slaResponseBreached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether SLA response time was breached',
  },
  slaResolutionBreached: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether SLA resolution time was breached',
  },
  isDemo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is demo data',
  },
}, {
  tableName: 'servicenow_incidents',
  timestamps: true,
  indexes: [
    { fields: ['number'], unique: true },
    { fields: ['state'] },
    { fields: ['priority'] },
    { fields: ['openedAt'] },
    { fields: ['isDemo'] },
  ],
});

export default ServiceNowIncident;
