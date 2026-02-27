// ============================================================================
// ServiceNow Context — PulseOps UI
//
// PURPOSE: Centralized state management for the ServiceNow integration module.
// Provides state for health/stats, connection config, SLA config, business
// hours, and data management actions. Exposes actions and confirmation modal
// handling through React Context.
//
// ARCHITECTURE: Follows the same pattern as RosterContext — a provider wraps
// all ServiceNow views, and a useServiceNow() hook provides access to state
// and actions. Confirmation modals for destructive actions use the shared
// ConfirmationModal pattern.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — wraps views in <ServiceNowProvider>
//   - src/modules/servicenow/components/* — all ServiceNow UI components
//
// USAGE:
//   const { health, stats, refreshDashboard, ... } = useServiceNow();
// ============================================================================
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Logger } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';

const ServiceNowContext = createContext(null);

export function useServiceNow() {
  const ctx = useContext(ServiceNowContext);
  if (!ctx) throw new Error('useServiceNow must be used inside <ServiceNowProvider>');
  return ctx;
}

export default function ServiceNowProvider({ children }) {
  // --- Dashboard State ---
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // --- Connection Config State ---
  const [connectionConfig, setConnectionConfig] = useState(null);
  const [connectionLoading, setConnectionLoading] = useState(false);

  // --- SLA Config State ---
  const [slaConfig, setSlaConfig] = useState([]);
  const [slaLoading, setSlaLoading] = useState(false);

  // --- Business Hours State ---
  const [businessHours, setBusinessHours] = useState([]);
  const [businessHoursLoading, setBusinessHoursLoading] = useState(false);

  // --- Confirmation Modal ---
  const [confirmAction, setConfirmAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processSuccess, setProcessSuccess] = useState(false);

  // --- Initial data fetch ---
  const [dataLoading, setDataLoading] = useState(true);

  // ─── Dashboard refresh ────────────────────────────────────────────────────
  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        ServiceNowService.getHealth(),
        ServiceNowService.getStats(),
      ]);
      if (healthRes.success) setHealth(healthRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      Logger.error('ServiceNowContext', 'Dashboard refresh failed', { error: err.message });
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // ─── Connection Config ────────────────────────────────────────────────────
  const fetchConnectionConfig = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const res = await ServiceNowService.getConnectionConfig();
      if (res.success) setConnectionConfig(res.data);
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const saveConnectionConfig = useCallback(async (data) => {
    setConnectionLoading(true);
    try {
      const res = await ServiceNowService.saveConnectionConfig(data);
      if (res.success) {
        setConnectionConfig(res.data);
        return { success: true };
      }
      return { success: false, error: res.error };
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const res = await ServiceNowService.testConnection();
      if (res.success) {
        await fetchConnectionConfig();
      }
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [fetchConnectionConfig]);

  // ─── SLA Config ───────────────────────────────────────────────────────────
  const fetchSlaConfig = useCallback(async () => {
    setSlaLoading(true);
    try {
      const res = await ServiceNowService.getSlaConfig();
      if (res.success) setSlaConfig(res.data || []);
    } finally {
      setSlaLoading(false);
    }
  }, []);

  const saveSlaConfig = useCallback(async (configs) => {
    setSlaLoading(true);
    try {
      const res = await ServiceNowService.saveSlaConfig(configs);
      if (res.success) {
        setSlaConfig(res.data || []);
        return { success: true };
      }
      return { success: false, error: res.error };
    } finally {
      setSlaLoading(false);
    }
  }, []);

  // ─── Business Hours ───────────────────────────────────────────────────────
  const fetchBusinessHours = useCallback(async () => {
    setBusinessHoursLoading(true);
    try {
      const res = await ServiceNowService.getBusinessHours();
      if (res.success) setBusinessHours(res.data || []);
    } finally {
      setBusinessHoursLoading(false);
    }
  }, []);

  const saveBusinessHours = useCallback(async (hours) => {
    setBusinessHoursLoading(true);
    try {
      const res = await ServiceNowService.saveBusinessHours(hours);
      if (res.success) {
        setBusinessHours(res.data || []);
        return { success: true };
      }
      return { success: false, error: res.error };
    } finally {
      setBusinessHoursLoading(false);
    }
  }, []);

  // ─── Data Management Actions ──────────────────────────────────────────────
  const handleDataAction = useCallback(async (action) => {
    setIsProcessing(true);
    setProcessSuccess(false);
    try {
      let result;
      switch (action) {
        case 'loadDemo':
          result = await ServiceNowService.loadDemoData();
          break;
        case 'removeDemo':
          result = await ServiceNowService.removeDemoData();
          break;
        case 'hardReset':
          result = await ServiceNowService.hardReset();
          break;
        default:
          result = { success: false, error: 'Unknown action' };
      }
      if (result.success) {
        setProcessSuccess(true);
        await refreshDashboard();
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsProcessing(false);
    }
  }, [refreshDashboard]);

  // ─── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setDataLoading(true);
      await refreshDashboard();
      setDataLoading(false);
    }
    init();
  }, [refreshDashboard]);

  const value = {
    // Dashboard
    health,
    stats,
    dashboardLoading,
    refreshDashboard,
    dataLoading,

    // Connection Config
    connectionConfig,
    connectionLoading,
    fetchConnectionConfig,
    saveConnectionConfig,
    testConnection,

    // SLA Config
    slaConfig,
    slaLoading,
    fetchSlaConfig,
    saveSlaConfig,

    // Business Hours
    businessHours,
    businessHoursLoading,
    fetchBusinessHours,
    saveBusinessHours,

    // Data Management
    handleDataAction,

    // Confirmation Modal
    confirmAction,
    setConfirmAction,
    isProcessing,
    processSuccess,
    setProcessSuccess,
  };

  return (
    <ServiceNowContext.Provider value={value}>
      {children}
    </ServiceNowContext.Provider>
  );
}
