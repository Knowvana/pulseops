// ============================================================================
// ServiceNow Service — PulseOps UI
//
// PURPOSE: Encapsulates all API calls for the ServiceNow integration module.
// Provides methods for health checks, CRUD operations on incidents/RITMs/
// changes, connection config, SLA config, business hours, reports, and
// data management (demo data, hard reset).
//
// ARCHITECTURE: Uses ApiClient for all HTTP calls and Logger for structured
// logging. All methods return { success, data, error } objects. URLs are
// read from the centralized urls.json config.
//
// USED BY:
//   - src/modules/servicenow/context/ServiceNowContext.jsx — State management
//   - src/modules/servicenow/components/*                  — UI components
//
// USAGE:
//   import ServiceNowService from '@modules/servicenow/services/servicenowService';
//   const result = await ServiceNowService.getHealth();
// ============================================================================
import { ApiClient, Logger } from '@shared';
import urls from '@shared/config/urls.json';
import logMessages from '@shared/config/logs.json';

const LOG_SRC = 'ServiceNowService';
const snLogs = logMessages.messages.servicenow;

const ServiceNowService = {

  // ─── HEALTH & STATS ──────────────────────────────────────────────────────
  async getHealth() {
    try {
      Logger.info(LOG_SRC, snLogs.healthChecked);
      const res = await ApiClient.get(urls.servicenowHealthEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.healthChecked, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async getStats() {
    try {
      const res = await ApiClient.get(urls.servicenowStatsEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, 'Failed to fetch stats', { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── INCIDENTS ───────────────────────────────────────────────────────────
  async getIncidents(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = query ? `${urls.servicenowIncidentsEndpoint}?${query}` : urls.servicenowIncidentsEndpoint;
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.incidentsFetched, { count: res.data?.length });
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.incidentsFetched, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async createIncident(data) {
    try {
      const res = await ApiClient.post(urls.servicenowIncidentsEndpoint, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async updateIncident(id, data) {
    try {
      const res = await ApiClient.put(`${urls.servicenowIncidentsEndpoint}/${id}`, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── RITMS ───────────────────────────────────────────────────────────────
  async getRitms(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = query ? `${urls.servicenowRitmsEndpoint}?${query}` : urls.servicenowRitmsEndpoint;
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.ritmsFetched, { count: res.data?.length });
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.ritmsFetched, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async createRitm(data) {
    try {
      const res = await ApiClient.post(urls.servicenowRitmsEndpoint, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async updateRitm(id, data) {
    try {
      const res = await ApiClient.put(`${urls.servicenowRitmsEndpoint}/${id}`, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── CHANGES ─────────────────────────────────────────────────────────────
  async getChanges(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = query ? `${urls.servicenowChangesEndpoint}?${query}` : urls.servicenowChangesEndpoint;
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.changesFetched, { count: res.data?.length });
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.changesFetched, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async createChange(data) {
    try {
      const res = await ApiClient.post(urls.servicenowChangesEndpoint, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async updateChange(id, data) {
    try {
      const res = await ApiClient.put(`${urls.servicenowChangesEndpoint}/${id}`, data);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── CONNECTION CONFIG ───────────────────────────────────────────────────
  async getConnectionConfig() {
    try {
      const res = await ApiClient.get(urls.servicenowConnectionEndpoint);
      Logger.info(LOG_SRC, snLogs.configFetched);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.configFetched, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async saveConnectionConfig(data) {
    try {
      const res = await ApiClient.put(urls.servicenowConnectionEndpoint, data);
      Logger.info(LOG_SRC, snLogs.connectionSaved);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.connectionSaved, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async testConnection() {
    try {
      const res = await ApiClient.post(urls.servicenowConnectionTestEndpoint);
      Logger.info(LOG_SRC, snLogs.connectionTested, { status: res.data?.status });
      return { success: res.success !== false, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.connectionTested, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── SLA CONFIG ──────────────────────────────────────────────────────────
  async getSlaConfig() {
    try {
      const res = await ApiClient.get(urls.servicenowSlaConfigEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async saveSlaConfig(configs) {
    try {
      const res = await ApiClient.put(urls.servicenowSlaConfigEndpoint, { configs });
      Logger.info(LOG_SRC, snLogs.slaConfigSaved);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.slaConfigSaved, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── BUSINESS HOURS ──────────────────────────────────────────────────────
  async getBusinessHours() {
    try {
      const res = await ApiClient.get(urls.servicenowBusinessHoursEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async saveBusinessHours(hours) {
    try {
      const res = await ApiClient.put(urls.servicenowBusinessHoursEndpoint, { hours });
      Logger.info(LOG_SRC, snLogs.businessHoursSaved);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.businessHoursSaved, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── REPORTS ─────────────────────────────────────────────────────────────
  async getIncidentReport(period = 'monthly', startDate = null, endDate = null) {
    try {
      let url = `${urls.servicenowReportsIncidentsEndpoint}?period=${period}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.reportGenerated, { type: 'incidents', period, startDate, endDate });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getRitmReport(period = 'monthly', startDate = null, endDate = null) {
    try {
      let url = `${urls.servicenowReportsRitmsEndpoint}?period=${period}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.reportGenerated, { type: 'ritms', period, startDate, endDate });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getSlaReport(period = 'monthly', startDate = null, endDate = null) {
    try {
      let url = `${urls.servicenowReportsSlaEndpoint}?period=${period}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.reportGenerated, { type: 'sla', period, startDate, endDate });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getChangeReport(period = 'monthly', startDate = null, endDate = null) {
    try {
      let url = `${urls.servicenowReportsChangesEndpoint}?period=${period}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.reportGenerated, { type: 'changes', period, startDate, endDate });
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── SCHEMA INFO ───────────────────────────────────────────────────────
  async getSchemaInfo() {
    try {
      const res = await ApiClient.get(urls.servicenowSchemaInfoEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, 'Failed to fetch schema info', { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── SYNC ─────────────────────────────────────────────────────────────
  async triggerSync() {
    try {
      const res = await ApiClient.post(urls.servicenowSyncEndpoint);
      Logger.info(LOG_SRC, 'Sync triggered');
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, 'Sync failed', { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async getSyncStatus() {
    try {
      const res = await ApiClient.get(urls.servicenowSyncStatusEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── SYNC SCHEDULE ────────────────────────────────────────────────────
  async getSyncSchedule() {
    try {
      const res = await ApiClient.get(urls.servicenowSyncScheduleEndpoint);
      return { success: true, data: res.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async saveSyncSchedule(data) {
    try {
      const res = await ApiClient.put(urls.servicenowSyncScheduleEndpoint, data);
      Logger.info(LOG_SRC, 'Sync schedule saved');
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, 'Failed to save sync schedule', { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── DATA MANAGEMENT ────────────────────────────────────────────────────
  async loadDemoData() {
    try {
      const res = await ApiClient.post(urls.servicenowDemoDataEndpoint);
      Logger.info(LOG_SRC, snLogs.demoLoaded);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.demoLoaded, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async removeDemoData() {
    try {
      const res = await ApiClient.delete(urls.servicenowDemoDataEndpoint);
      Logger.info(LOG_SRC, snLogs.demoRemoved);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.demoRemoved, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async hardReset() {
    try {
      const res = await ApiClient.delete(urls.servicenowAllDataEndpoint);
      Logger.info(LOG_SRC, snLogs.hardReset);
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.hardReset, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ─── CONFIG SETTINGS ────────────────────────────────────────────────────
  async getConfigSettings(category = null) {
    try {
      let url = urls.servicenowConfigSettingsEndpoint;
      if (category) url += `?category=${category}`;
      const res = await ApiClient.get(url);
      Logger.info(LOG_SRC, snLogs.configFetched, { category });
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.configFetched, { error: err.message });
      return { success: false, error: err.message };
    }
  },

  async saveConfigSettings(settings) {
    try {
      const res = await ApiClient.put(urls.servicenowConfigSettingsEndpoint, { settings });
      Logger.info(LOG_SRC, snLogs.connectionSaved, { count: settings.length });
      return { success: true, data: res.data };
    } catch (err) {
      Logger.error(LOG_SRC, snLogs.connectionSaved, { error: err.message });
      return { success: false, error: err.message };
    }
  },
};

export default ServiceNowService;
