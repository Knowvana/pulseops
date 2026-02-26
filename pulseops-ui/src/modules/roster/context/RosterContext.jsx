// ============================================================================
// RosterContext — PulseOps UI (Roster Module)
//
// PURPOSE: Centralized state management for the Shift Roster module.
// Holds all shared state (shifts, employees, leaves, schedule, etc.)
// so that every roster view/component can consume it via useRoster().
//
// ARCHITECTURE: React Context + Provider pattern. The manifest wraps
// all roster views inside <RosterProvider>, and each view calls
// useRoster() instead of receiving props from a monolithic parent.
//
// STATE OWNED:
//   - shifts, employees, leaves (fetched from API on mount)
//   - schedule, generationError (local generation state)
//   - currentShiftInfo, shiftTimeLeft (live shift header)
//   - viewMode, currentDate (navigation)
//   - confirmAction, isProcessing, processSuccess (confirmation modal)
//   - dataLoading (initial fetch indicator)
//
// USED BY:
//   - RosterDashboard, RosterReports, RosterConfig, RosterDataManagement
//   - roster/manifest.jsx wraps views in <RosterProvider>
// ============================================================================
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ApiClient, ConfirmationModal, Logger } from '@shared';
import logsConfig from '@shared/config/logs.json';
import urls from '@shared/config/urls.json';
import messages from '@shared/config/messages.json';
import RosterService from '@modules/roster/services/rosterService';
import { generateRoster, getSafeDateKey } from '@modules/roster/utils/rosterUtils';

const RosterContext = createContext(null);

export function useRoster() {
  const ctx = useContext(RosterContext);
  if (!ctx) throw new Error('useRoster must be used inside <RosterProvider>');
  return ctx;
}

export default function RosterProvider({ children }) {
  // --- Core Roster State ---
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // --- Current Shift Header State ---
  const [currentShiftInfo, setCurrentShiftInfo] = useState(null);
  const [shiftTimeLeft, setShiftTimeLeft] = useState('');

  // --- Navigation & View ---
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Confirmation Modal ---
  const [confirmAction, setConfirmAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processSuccess, setProcessSuccess] = useState(false);

  // --- Initial data fetch ---
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchRosterData = async () => {
      setDataLoading(true);
      try {
        const [shiftsRes, employeesRes, leavesRes, shiftRes] = await Promise.allSettled([
          ApiClient.get(urls.rosterShiftsEndpoint),
          ApiClient.get(urls.rosterEmployeesEndpoint),
          ApiClient.get(urls.rosterLeavesEndpoint),
          ApiClient.get(urls.rosterCurrentShiftEndpoint),
        ]);
        if (shiftsRes.status === 'fulfilled' && shiftsRes.value?.data) setShifts(shiftsRes.value.data);
        if (employeesRes.status === 'fulfilled' && employeesRes.value?.data) setEmployees(employeesRes.value.data);
        if (leavesRes.status === 'fulfilled' && leavesRes.value?.data) setLeaves(leavesRes.value.data);
        if (shiftRes.status === 'fulfilled' && shiftRes.value?.data) setCurrentShiftInfo(shiftRes.value.data);
      } catch {
        // Module may not be initialized yet
      } finally {
        setDataLoading(false);
      }
    };
    fetchRosterData();
  }, []);

  // --- Refresh current shift info periodically ---
  useEffect(() => {
    const fetchCurrentShift = async () => {
      try {
        const response = await ApiClient.get(urls.rosterCurrentShiftEndpoint);
        if (response?.data) setCurrentShiftInfo(response.data);
      } catch {
        // Module may not be initialized yet
      }
    };
    const interval = setInterval(fetchCurrentShift, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- Countdown timer for shift end ---
  useEffect(() => {
    if (!currentShiftInfo?.currentShift?.endTime) {
      setShiftTimeLeft('');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const [endH, endM] = currentShiftInfo.currentShift.endTime.split(':').map(Number);
      let endDate = new Date(now);
      endDate.setHours(endH, endM, 0, 0);
      if (endDate <= now) endDate.setDate(endDate.getDate() + 1);
      const diffMs = endDate - now;
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setShiftTimeLeft(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentShiftInfo]);

  // --- Date Navigation ---
  const navigateDate = useCallback((direction) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'day') d.setDate(d.getDate() + direction);
      else if (viewMode === 'week') d.setDate(d.getDate() + (7 * direction));
      else d.setMonth(d.getMonth() + direction);
      return d;
    });
  }, [viewMode]);

  const getDisplayDateRange = useCallback(() => {
    if (viewMode === 'day') return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate, viewMode]);

  // --- Roster Generation ---
  const handleGenerate = useCallback(() => {
    setGenerationError(null);
    if (employees.length === 0 || shifts.length === 0) {
      setGenerationError('Please add at least one employee and one shift before generating.');
      Logger.warn('ShiftRoster', logsConfig.messages.roster.generationFailed, { employees: employees.length, shifts: shifts.length });
      return;
    }
    const totalWeekdaySlots = shifts.reduce((sum, s) => sum + (s.reqWeekday || 1), 0);
    if (totalWeekdaySlots > employees.length) {
      setGenerationError(`Not enough employees (${employees.length}) to fill ${totalWeekdaySlots} weekday slots across all shifts.`);
      Logger.warn('ShiftRoster', logsConfig.messages.roster.generationFailed, { employees: employees.length, totalWeekdaySlots });
      return;
    }
    const { roster } = generateRoster(employees, shifts, currentDate.getFullYear(), currentDate.getMonth() + 1, leaves);
    setSchedule(roster);
    Logger.info('ShiftRoster', logsConfig.messages.roster.generated, { month: currentDate.getMonth() + 1, year: currentDate.getFullYear() });
  }, [employees, shifts, leaves, currentDate]);

  // --- Schedule Update (inline edit) ---
  const handleUpdateSchedule = useCallback((dateKey, shiftId, newWorkers) => {
    setSchedule(prev => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], [shiftId]: newWorkers },
    }));
    Logger.info('ShiftRoster', logsConfig.messages.roster.shiftEdited, { dateKey, shiftId, workers: newWorkers.length });
  }, []);

  // --- CSV Export ---
  const downloadCSV = useCallback(() => {
    if (!schedule) return;
    const rows = [['Date', ...shifts.map(s => s.label)]];
    Object.keys(schedule).sort().forEach(dateKey => {
      const day = schedule[dateKey];
      rows.push([dateKey, ...shifts.map(s => (day[s.id] || []).map(eid => employees.find(e => e.id === eid)?.name || eid).join('; '))]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster-${getSafeDateKey(currentDate)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schedule, shifts, employees, currentDate]);

  // --- Refresh data from API (used after data actions) ---
  const refreshData = useCallback(async () => {
    const [shiftsRes, employeesRes, leavesRes] = await Promise.allSettled([
      ApiClient.get(urls.rosterShiftsEndpoint),
      ApiClient.get(urls.rosterEmployeesEndpoint),
      ApiClient.get(urls.rosterLeavesEndpoint),
    ]);
    if (shiftsRes.status === 'fulfilled' && shiftsRes.value?.data) setShifts(shiftsRes.value.data);
    if (employeesRes.status === 'fulfilled' && employeesRes.value?.data) setEmployees(employeesRes.value.data);
    if (leavesRes.status === 'fulfilled' && leavesRes.value?.data) setLeaves(leavesRes.value.data);
    setSchedule(null);
  }, []);

  // --- Data Actions (load demo, remove demo, hard reset) ---
  const handleDataAction = useCallback((action) => setConfirmAction(action), []);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;
    setIsProcessing(true);

    try {
      if (confirmAction.type === 'load_demo') {
        Logger.info('ShiftRoster', 'Loading demo data via API');
        const result = await RosterService.loadDemoData();
        if (result.success) {
          await refreshData();
          Logger.info('ShiftRoster', logsConfig.messages.roster.demoLoaded);
        } else {
          throw new Error(result.error?.message || 'Failed to load demo data');
        }
      } else if (confirmAction.type === 'remove_demo') {
        Logger.info('ShiftRoster', 'Removing demo data via API');
        const result = await RosterService.removeDemoData();
        if (result.success) {
          await refreshData();
          Logger.info('ShiftRoster', 'Demo data removed successfully');
        } else {
          throw new Error(result.error?.message || 'Failed to remove demo data');
        }
      } else if (confirmAction.type === 'hard_reset') {
        Logger.warn('ShiftRoster', 'Performing hard reset of roster data');
        const result = await RosterService.hardResetRosterData();
        if (result.success) {
          setEmployees([]);
          setShifts([]);
          setLeaves([]);
          setSchedule(null);
          setGenerationError(null);
          Logger.info('ShiftRoster', 'Hard reset completed successfully');
        } else {
          throw new Error(result.error?.message || 'Failed to hard reset');
        }
      }

      setIsProcessing(false);
      setProcessSuccess(true);
    } catch (err) {
      Logger.error('ShiftRoster', 'Data action failed', { error: err.message });
      setIsProcessing(false);
      setProcessSuccess(false);
      setConfirmAction(null);
    }
  }, [confirmAction, refreshData]);

  const handleSuccessClose = useCallback(() => {
    setConfirmAction(null);
    setProcessSuccess(false);
  }, []);

  const handleCancelAction = useCallback(() => {
    setConfirmAction(null);
    setProcessSuccess(false);
  }, []);

  const hasData = employees.length > 0 || shifts.length > 0;

  // --- Context value ---
  const value = useMemo(() => ({
    // Core data
    employees, setEmployees,
    shifts, setShifts,
    leaves, setLeaves,
    schedule, setSchedule,
    generationError,
    dataLoading,
    hasData,

    // Current shift header
    currentShiftInfo,
    shiftTimeLeft,

    // Navigation
    viewMode, setViewMode,
    currentDate, setCurrentDate,
    navigateDate,
    getDisplayDateRange,

    // Actions
    handleGenerate,
    handleUpdateSchedule,
    downloadCSV,
    handleDataAction,

    // Confirmation modal
    confirmAction,
    isProcessing,
    processSuccess,
    handleConfirm,
    handleSuccessClose,
    handleCancelAction,
  }), [
    employees, shifts, leaves, schedule, generationError, dataLoading, hasData,
    currentShiftInfo, shiftTimeLeft,
    viewMode, currentDate, navigateDate, getDisplayDateRange,
    handleGenerate, handleUpdateSchedule, downloadCSV, handleDataAction,
    confirmAction, isProcessing, processSuccess, handleConfirm, handleSuccessClose, handleCancelAction,
  ]);

  return (
    <RosterContext.Provider value={value}>
      {children}
      <ConfirmationModal
        action={confirmAction}
        isProcessing={isProcessing}
        isSuccess={processSuccess}
        onConfirm={handleConfirm}
        onCancel={handleCancelAction}
        onSuccessClose={handleSuccessClose}
      />
    </RosterContext.Provider>
  );
}
