// ============================================================================
// ShiftRosterApp — PulseOps UI
//
// PURPOSE: Root component for the Shift Roster Planner module. Manages all
// roster state (employees, shifts, leaves, schedule) and orchestrates the
// sub-components (Dashboard, Config, Reports, Settings).
//
// ARCHITECTURE: Self-contained module. Uses ModuleLayout for consistent
// sidebar navigation. Uses ConfirmationModal + useConfirmAction hook for
// destructive actions. All demo data comes from demoDataService.
// Exports as default — registered in moduleRegistry.js.
// ============================================================================
import React, { useState, useCallback } from 'react';
import { Calendar, BarChart3, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { ModuleLayout, ConfirmationModal, EmptyState, SettingsModal, Logger, loadRosterDemo } from '@shared';
import logsConfig from '@shared/config/logs.json';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import RosterDashboard from '@modules/roster/components/RosterDashboard';
import RosterConfig from '@modules/roster/components/RosterConfig';
import RosterReports from '@modules/roster/components/RosterReports';
import RosterSettings from '@modules/roster/components/RosterSettings';
import { generateRoster, getSafeDateKey } from '@modules/roster/utils/rosterUtils';

const rosterTxt = uiText.shiftRoster;

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Planner', icon: Calendar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'config', label: 'Configuration', icon: Sliders },
];

export default function ShiftRosterApp() {
  // --- Core Roster State ---
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // --- Navigation & View ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);

  // --- Confirmation Modal ---
  const [confirmAction, setConfirmAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processSuccess, setProcessSuccess] = useState(false);

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
    const totalWeekdaySlots = shifts.reduce((sum, s) => sum + s.reqWeekday, 0);
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
    setActiveTab('dashboard');
  }, []);

  const handleCancelAction = useCallback(() => {
    setConfirmAction(null);
    setProcessSuccess(false);
  }, []);

  // --- Tab change handler ---
  const handleTabChange = useCallback((tab) => {
    if (tab === 'settings') {
      setShowSettings(true);
    } else {
      setActiveTab(tab);
    }
  }, []);

  // --- Check if roster has data ---
  const hasData = employees.length > 0 || shifts.length > 0;

  // --- Render content based on active tab ---
  const renderContent = () => {
    if (!hasData && activeTab === 'dashboard') {
      return (
        <EmptyState
          module="roster_planner"
          onPrimaryAction={() => setActiveTab('config')}
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
          <RosterConfig
            shifts={shifts}
            setShifts={setShifts}
            employees={employees}
            setEmployees={setEmployees}
            leaves={leaves}
            setLeaves={setLeaves}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ModuleLayout
      title={rosterTxt.sideNav.title}
      subtitle={rosterTxt.sideNav.subtitle}
      icon={Calendar}
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Roster Settings"
        icon={SettingsIcon}
        tabs={[
          { id: 'data', label: 'Data Management', icon: SettingsIcon },
        ]}
        initialTab="data"
      >
        {(tab) => tab === 'data' && <RosterSettings onDataAction={(action) => { setShowSettings(false); handleDataAction(action); }} />}
      </SettingsModal>
    </ModuleLayout>
  );
}
