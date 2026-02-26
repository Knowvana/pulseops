// ============================================================================
// ShiftRosterApp — PulseOps UI (ShiftRoaster Module)
//
// PURPOSE: Root component for the ShiftRoaster module. Manages all roster
// state (employees, shifts, leaves, schedule) and orchestrates the
// sub-components (Dashboard, Config, Reports, Settings). Includes a
// current shift header bar showing live shift details.
//
// ARCHITECTURE: Pure content component. Navigation is managed by parent
// PlatformDashboard via activeTab/onTabChange props. Data is fetched
// from the API (shiftroaster_* tables) and persisted to the database.
// Settings view uses the universal SettingsConfig component.
//
// USED BY:
//   - PlatformDashboard.jsx → renders when activeModuleId === 'shiftroaster'
//
// INTEGRATION FLOW:
//   PlatformDashboard switches to shiftroaster → ShiftRosterApp mounts →
//   fetches current shift from API → renders header + active tab view
// ============================================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  Calendar, Settings as SettingsIcon, Clock, Users as UsersIcon,
  UserCheck, Timer, Database, Trash2, Loader2
} from 'lucide-react';
import { ConfirmationModal, EmptyState, SettingsConfig, Logger, ApiClient, loadRosterDemo } from '@shared';
import logsConfig from '@shared/config/logs.json';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import urls from '@shared/config/urls.json';
import RosterDashboard from '@modules/roster/components/RosterDashboard';
import RosterReports from '@modules/roster/components/RosterReports';
import RosterConfigPage from '@modules/roster/views/RosterConfigPage';
import { generateRoster, getSafeDateKey } from '@modules/roster/utils/rosterUtils';

export default function ShiftRosterApp({ activeTab = 'dashboard', onTabChange }) {
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

  // --- Fetch roster data from API on mount ---
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

  // --- Data Actions (load demo, delete all) ---
  const handleDataAction = (action) => setConfirmAction(action);

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    if (confirmAction.type === 'load_demo') {
      const demo = loadRosterDemo();
      setEmployees(demo.employees);
      setShifts(demo.shifts);
      setLeaves([]);
      setSchedule(null);
      Logger.info('ShiftRoster', logsConfig.messages.roster.demoLoaded);
    } else if (confirmAction.type === 'delete_all') {
      setEmployees([]);
      setShifts([]);
      setLeaves([]);
      setSchedule(null);
      setGenerationError(null);
      Logger.info('ShiftRoster', logsConfig.messages.roster.dataCleared);
    }

    setIsProcessing(false);
    setProcessSuccess(true);
  }, [confirmAction]);

  const handleSuccessClose = useCallback(() => {
    setConfirmAction(null);
    setProcessSuccess(false);
    if (onTabChange) onTabChange('dashboard');
  }, [onTabChange]);

  const handleCancelAction = useCallback(() => {
    setConfirmAction(null);
    setProcessSuccess(false);
  }, []);

  const hasData = employees.length > 0 || shifts.length > 0;

  // --- Render content based on active tab ---
  const renderContent = () => {
    if (dataLoading) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      );
    }

    if (!hasData && activeTab === 'dashboard') {
      return (
        <EmptyState
          module="roster_planner"
          onPrimaryAction={() => onTabChange?.('config')}
          onSecondaryAction={() => handleDataAction({ type: 'load_demo', title: 'Load Demo Data', desc: messages.confirm.loadDemoData })}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <RosterDashboard
            schedule={schedule}
            employees={employees}
            shifts={shifts}
            viewMode={viewMode}
            setViewMode={setViewMode}
            currentDate={currentDate}
            navigateDate={navigateDate}
            getDisplayDateRange={getDisplayDateRange}
            handleGenerate={handleGenerate}
            downloadCSV={downloadCSV}
            generationError={generationError}
            onUpdateSchedule={handleUpdateSchedule}
          />
        );
      case 'reports':
        return (
          <RosterReports
            schedule={schedule}
            employees={employees}
            shifts={shifts}
            leaves={leaves}
            currentDate={currentDate}
            viewMode={viewMode}
            setViewMode={setViewMode}
            navigateDate={navigateDate}
            getDisplayDateRange={getDisplayDateRange}
          />
        );
      case 'config':
        return (
          <RosterConfigPage
            shifts={shifts}
            setShifts={setShifts}
            employees={employees}
            setEmployees={setEmployees}
            leaves={leaves}
            setLeaves={setLeaves}
            onDataAction={handleDataAction}
          />
        );
      default:
        return null;
    }
  };

  const cs = currentShiftInfo;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── Current Shift Header Bar ─────────────────────────────────── */}
      {cs?.currentShift && (
        <div className="bg-gradient-to-r from-brand-600 via-teal-600 to-brand-700 rounded-2xl p-4 text-white shadow-lg shadow-brand-600/20 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Current Shift</p>
              <p className="text-lg font-extrabold">{cs.currentShift.label}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-white/20 hidden md:block" />

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-white/70" />
            <span className="text-sm font-semibold">{cs.currentShift.startTime} — {cs.currentShift.endTime}</span>
          </div>

          <div className="h-8 w-px bg-white/20 hidden md:block" />

          {shiftTimeLeft && (
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-white/70" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Time Left</p>
                <p className="text-lg font-extrabold font-mono tracking-wider">{shiftTimeLeft}</p>
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-white/20 hidden md:block" />

          <div className="flex items-center gap-2">
            <UsersIcon size={14} className="text-white/70" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Resources Available</p>
              <p className="text-lg font-extrabold">{cs.availableResources ?? '—'} / {cs.totalEmployees ?? '—'}</p>
            </div>
          </div>

          {cs.shiftLead && (
            <>
              <div className="h-8 w-px bg-white/20 hidden md:block" />
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-white/70" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Shift Lead</p>
                  <p className="text-sm font-bold">{cs.shiftLead}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Active Tab Content ───────────────────────────────────────── */}
      {renderContent()}

      {/* Confirmation Modal Overlay */}
      <ConfirmationModal
        action={confirmAction}
        isProcessing={isProcessing}
        isSuccess={processSuccess}
        onConfirm={handleConfirm}
        onCancel={handleCancelAction}
        onSuccessClose={handleSuccessClose}
      />
    </div>
  );
}
