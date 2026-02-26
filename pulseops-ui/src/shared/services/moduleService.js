// ============================================================================
// ModuleService — PulseOps UI
//
// PURPOSE: Frontend service for communicating with the /api/modules
// endpoints. Handles listing, enabling, disabling, initializing schema,
// and loading demo data for platform modules.
//
// ARCHITECTURE: Uses ApiClient for all HTTP calls. All module state is
// persisted in the database (system_modules table), ensuring Kubernetes
// pod restarts do not lose module configuration.
//
// USED BY:
//   - moduleRegistry.js      — Fetches enabled modules for navigation
//   - Admin Modules Page     — Lists all modules, enable/disable
//   - StepWizard             — Initialize schema, load demo data
//   - TopNav                 — Filters visible modules by enabled state
//
// INTEGRATION FLOW:
//   UI calls ModuleService → ApiClient → /api/modules → SystemModule table →
//   response drives navigation and module visibility
// ============================================================================
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import urls from '@shared/config/urls.json';
import logsConfig from '@shared/config/logs.json';

const MODULE_URL = urls.modulesEndpoint;

const ModuleService = {
  /**
   * Fetch all modules from the database. Filtered by user role on the server.
   * @returns {Promise<Array>} List of module records
   */
  async getAll() {
    try {
      const response = await ApiClient.get(MODULE_URL);
      return response?.data || [];
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'getAll', error: err.message });
      return [];
    }
  },

  /**
   * Get a single module by its moduleId.
   * @param {string} moduleId
   * @returns {Promise<Object|null>}
   */
  async getById(moduleId) {
    try {
      const response = await ApiClient.get(`${MODULE_URL}/${moduleId}`);
      return response?.data || null;
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'getById', moduleId, error: err.message });
      return null;
    }
  },

  /**
   * Check if a module's schema is initialized.
   * @param {string} moduleId
   * @returns {Promise<Object>} { initialized, existing, missing }
   */
  async checkStatus(moduleId) {
    try {
      const response = await ApiClient.get(`${MODULE_URL}/${moduleId}/status`);
      return response?.data || { initialized: false, existing: [], missing: [] };
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'checkStatus', moduleId, error: err.message });
      return { initialized: false, existing: [], missing: [], error: err.message };
    }
  },

  /**
   * Initialize module schema (create database tables).
   * @param {string} moduleId
   * @returns {Promise<Object>}
   */
  async initializeSchema(moduleId) {
    try {
      const response = await ApiClient.post(`${MODULE_URL}/${moduleId}/initialize`);
      Logger.info('ModuleService', logsConfig.messages.database.schemaCreated, { moduleId });
      return response?.data || {};
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.database.syncFailed || 'Schema init failed', { moduleId, error: err.message });
      throw err;
    }
  },

  /**
   * Enable a module (must be initialized first).
   * @param {string} moduleId
   * @returns {Promise<Object>}
   */
  async enable(moduleId) {
    try {
      const response = await ApiClient.post(`${MODULE_URL}/${moduleId}/enable`);
      Logger.info('ModuleService', logsConfig.messages.platform.configSaved, { action: 'enable', moduleId });
      return response?.data || {};
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'enable', moduleId, error: err.message });
      throw err;
    }
  },

  /**
   * Disable a module (core modules cannot be disabled).
   * @param {string} moduleId
   * @returns {Promise<Object>}
   */
  async disable(moduleId) {
    try {
      const response = await ApiClient.post(`${MODULE_URL}/${moduleId}/disable`);
      Logger.info('ModuleService', logsConfig.messages.platform.configSaved, { action: 'disable', moduleId });
      return response?.data || {};
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'disable', moduleId, error: err.message });
      throw err;
    }
  },

  /**
   * Load demo data for a module.
   * @param {string} moduleId
   * @returns {Promise<Object>}
   */
  async loadDemoData(moduleId) {
    try {
      const response = await ApiClient.post(`${MODULE_URL}/${moduleId}/demo-data`);
      Logger.info('ModuleService', logsConfig.messages.database.demoDataLoaded, { moduleId });
      return response?.data || {};
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'loadDemoData', moduleId, error: err.message });
      throw err;
    }
  },

  /**
   * Wipe all data for a module.
   * @param {string} moduleId
   * @returns {Promise<Object>}
   */
  async wipeData(moduleId) {
    try {
      const response = await ApiClient.delete(`${MODULE_URL}/${moduleId}/data`);
      Logger.info('ModuleService', logsConfig.messages.database.dataWiped, { moduleId });
      return response?.data || {};
    } catch (err) {
      Logger.error('ModuleService', logsConfig.messages.common.actionFailed, { action: 'wipeData', moduleId, error: err.message });
      throw err;
    }
  },
};

export default ModuleService;
