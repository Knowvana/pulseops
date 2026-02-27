// ============================================================================
// RosterDashboard Component — PulseOps UI
//
// PURPOSE: Main planner grid for the Shift Roster module. Displays the
// generated schedule in daily, weekly, or monthly view modes. Supports
// inline editing of shift assignments via a floating modal. Includes the
// live current-shift header bar.
//
// ARCHITECTURE: Module-specific component. Consumes shared roster state
// from RosterContext via useRoster(). All UI elements follow the shared
// brand/surface color palette.
// ============================================================================
import React, { useState } from 'react';
import {
  List, CalendarDays, Grid, ChevronLeft, ChevronRight,
  RefreshCw, Download, Users, AlertCircle, Edit2, X, Save, CheckCircle2,
  Clock, Calendar, Timer, UserCheck, Loader2, LayoutGrid, Table2
} from 'lucide-react';
import { EmptyState } from '@shared';
import messages from '@shared/config/messages.json';
import { getSafeDateKey } from '@modules/roster/utils/rosterUtils';
import { WEEKDAYS } from '@modules/roster/utils/rosterConstants';
import { useRoster } from '@modules/roster/context/RosterContext';

// --- Edit Modal Component ---
const EditShiftModal = ({ isOpen, onClose, dateKey, shift, assignedIds, employees, onSave }) => {
  const [selected, setSelected] = useState([]);

  React.useEffect(() => {
    if (isOpen) setSelected(assignedIds || []);
  }, [isOpen, assignedIds]);

  if (!isOpen || !shift) return null;

  const toggleEmp = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(e => e !== id));
    else setSelected([...selected, id]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
        <div className={`p-6 border-b border-surface-100 flex justify-between items-center ${shift.color} bg-opacity-10 shrink-0`}>
          <div>
            <h3 className="text-xl font-extrabold text-surface-800 tracking-tight flex items-center gap-2">
              Edit {shift.label}
            </h3>
            <p className="text-xs font-medium text-surface-500 mt-1">Date: <span className="font-mono">{dateKey}</span> • Time: <span className="font-mono">{shift.time}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/50 text-surface-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-surface-50/50">
          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3 ml-2">Select Staff</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {employees.map(emp => {
              const isSelected = selected.includes(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmp(emp.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-50 border-brand-200 shadow-sm'
                      : 'bg-white border-surface-200 hover:border-brand-300 hover:bg-surface-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    isSelected ? 'bg-brand-500 border-brand-600 text-white' : 'bg-surface-50 border-surface-300'
                  }`}>
                    {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                  </div>
                  <span className={`text-sm font-semibold truncate ${isSelected ? 'text-brand-900' : 'text-surface-700'}`}>{emp.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 bg-white border-t border-surface-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(selected)} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-surface-800 text-white shadow-lg hover:bg-surface-900 active:scale-95 transition-all flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default function RosterDashboard({ onNavigateToConfig }) {
  const {
    schedule, employees, shifts, viewMode, setViewMode,
    currentDate, navigateDate, getDisplayDateRange,
    handleGenerate, downloadCSV, generationError, handleUpdateSchedule,
    currentShiftInfo, shiftTimeLeft, dataLoading, hasData, handleDataAction,
  } = useRoster();

  const [editingShift, setEditingShift] = useState(null);
  const [layoutMode, setLayoutMode] = useState('grid');

  const openEditModal = (dateKey, shiftId, currentWorkers) => {
    setEditingShift({ dateKey, shiftId, currentWorkers });
  };

  const handleSaveEdit = (newWorkers) => {
    handleUpdateSchedule(editingShift.dateKey, editingShift.shiftId, newWorkers);
    setEditingShift(null);
  };

  const cs = currentShiftInfo;

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <EmptyState
        module="roster_planner"
        onPrimaryAction={() => onNavigateToConfig?.()}
        onSecondaryAction={() => handleDataAction({ type: 'load_demo', title: 'Load Demo Data', desc: messages.confirm.loadDemoData })}
      />
    );
  }

  const renderDailyView = () => {
    const dateKey = getSafeDateKey(currentDate);
    const daySchedule = schedule?.[dateKey] || {};
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

    return (
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-surface-100">
          <h3 className="text-xl font-extrabold text-surface-800 tracking-tight">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
          <p className="text-sm text-surface-500 font-medium mt-1">{isWeekend ? 'Weekend Schedule' : 'Weekday Schedule'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-50/80 border-b border-surface-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-surface-500 uppercase tracking-widest">Shift</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-surface-500 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-surface-500 uppercase tracking-widest">Required</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-surface-500 uppercase tracking-widest">Assigned</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-surface-500 uppercase tracking-widest">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {shifts.map(shift => {
                const workers = daySchedule[shift.id] || [];
                const required = isWeekend ? shift.reqWeekend : shift.reqWeekday;
                return (
                  <tr
                    key={shift.id}
                    onClick={() => openEditModal(dateKey, shift.id, workers)}
                    className="hover:bg-surface-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${shift.color.split(' ')[0].replace('100', '500')} shadow-sm`}></div>
                        <span className="font-bold text-surface-800">{shift.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-surface-600">{shift.time}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-100 text-surface-700 font-bold text-sm">{required}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        workers.length >= required ? 'bg-green-100 text-green-700' : 
                        workers.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {workers.length}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {workers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {workers.slice(0, 3).map(empId => {
                              const emp = employees.find(e => e.id === empId);
                              return (
                                <span key={empId} className={`text-xs font-bold px-2 py-1 rounded-md border ${shift.color} bg-opacity-30 shadow-sm`}>
                                  {emp?.name || 'Unknown'}
                                </span>
                              );
                            })}
                            {workers.length > 3 && (
                              <span className="text-xs font-bold px-2 py-1 rounded-md bg-surface-100 text-surface-600 border border-surface-200">
                                +{workers.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-surface-400 italic">Click to assign staff</span>
                        )}
                        <div className="ml-auto opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity">
                          <Edit2 size={16} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWeeklyView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }

    return (
      <div className="space-y-4">
        {weekDays.map(dateObj => {
          const dateKey = getSafeDateKey(dateObj);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          const daySchedule = schedule?.[dateKey] || {};

          return (
            <div key={dateKey} className={`bg-white rounded-2xl border ${isWeekend ? 'border-orange-200 bg-orange-50/10' : 'border-surface-200'} shadow-sm overflow-hidden`}>
              <div className={`px-5 py-3 border-b flex justify-between items-center ${isWeekend ? 'bg-orange-50/40' : 'bg-surface-50/50'}`}>
                <div className="flex items-baseline gap-3">
                  <span className={`text-lg font-extrabold tracking-tight ${isWeekend ? 'text-orange-800' : 'text-surface-800'}`}>{WEEKDAYS[dateObj.getDay()]}</span>
                  <span className="text-xs font-medium text-surface-500">{dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {isWeekend && <span className="text-[10px] uppercase font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md tracking-wider border border-orange-200">Weekend</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-surface-100">
                {shifts.map(shift => {
                  const workers = daySchedule[shift.id] || [];
                  return (
                    <div
                      key={shift.id}
                      onClick={() => openEditModal(dateKey, shift.id, workers)}
                      className="p-4 cursor-pointer group hover:bg-brand-50/30 transition-colors relative"
                    >
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity"><Edit2 size={14} /></div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${shift.color.split(' ')[0].replace('100', '400')}`}></div>
                        <span className="text-sm font-bold text-surface-700">{shift.label}</span>
                        <span className="text-[10px] font-mono font-medium text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded border border-surface-100 ml-auto mr-5">{workers.length} staff</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {workers.length > 0 ? workers.map(empId => {
                          const emp = employees.find(e => e.id === empId);
                          return <span key={empId} className={`text-[11px] font-bold px-2 py-1 rounded-md border ${shift.color} bg-opacity-40 whitespace-nowrap shadow-sm`}>{emp?.name}</span>;
                        }) : <span className="text-[10px] text-surface-400 italic bg-surface-50 px-2 py-1 rounded-md border border-dashed border-surface-200">Unstaffed - Click to add</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthlyGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const emptySlots = Array.from({ length: firstDayOfMonth });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[600px]">
        <div className="grid grid-cols-7 border-b border-surface-200 bg-surface-50/80 shrink-0">
          {WEEKDAYS.map(d => <div key={d} className="py-3 text-center text-xs font-bold text-surface-500 uppercase tracking-widest">{d}</div>)}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-50/30">
          <div className="grid grid-cols-7 auto-rows-[minmax(160px,auto)]">
            {emptySlots.map((_, i) => <div key={`empty-${i}`} className="bg-surface-50/30 border-b border-r border-surface-100 min-h-[160px]"></div>)}
            {days.map(day => {
              const dateObj = new Date(year, month, day);
              const dateKey = getSafeDateKey(dateObj);
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              const daySchedule = schedule?.[dateKey] || {};
              return (
                <div key={day} className={`min-h-[160px] p-3 border-b border-r border-surface-100 flex flex-col bg-white hover:bg-surface-50/50 transition-colors ${isWeekend ? 'bg-orange-50/10' : ''}`}>
                  <div className="flex justify-between items-start mb-2.5 px-1 shrink-0">
                    <span className={`text-sm font-bold ${isWeekend ? 'text-orange-600' : 'text-surface-700'}`}>{day}</span>
                    {isWeekend && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shadow-sm"></span>}
                  </div>
                  <div className="flex-1 space-y-2 pr-1">
                    {shifts.map(shift => {
                      const workers = daySchedule[shift.id] || [];
                      return (
                        <div
                          key={shift.id}
                          onClick={() => openEditModal(dateKey, shift.id, workers)}
                          className={`group cursor-pointer rounded-lg border ${shift.color} bg-opacity-20 p-2 shadow-sm hover:ring-2 ring-brand-400/30 transition-all relative`}
                        >
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-brand-600 bg-white/90 backdrop-blur rounded p-1 shadow-sm"><Edit2 size={12} /></div>
                          <div className="flex justify-between items-center mb-1.5 pr-4">
                            <span className="text-[10px] font-extrabold uppercase opacity-80 tracking-wider truncate">{shift.label}</span>
                            <span className="text-[10px] bg-white/90 px-1.5 rounded font-bold shadow-sm">{workers.length}</span>
                          </div>
                          <div className="text-xs leading-tight text-surface-700 font-medium transition-all">
                            {workers.length > 0 ? workers.map(eid => employees.find(e => e.id === eid)?.name).join(', ') : <span className="text-surface-400 italic">Empty</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const getShiftColor = (shiftId) => {
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.color || 'bg-surface-100 text-surface-600';
  };

  const getShiftLabel = (shiftId) => {
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.label || 'Unknown';
  };

  const getShiftTime = (shiftId) => {
    const shift = shifts.find(s => s.id === shiftId);
    return shift?.time || '—';
  };

  const renderDailyGridView = () => {
    const dateKey = getSafeDateKey(currentDate);
    const daySchedule = schedule?.[dateKey] || {};
    const EMPLOYEE_COL_WIDTH = 'w-48';
    const DAY_COL_WIDTH = 'w-44';
    const ROW_HEIGHT = 'h-24';

    return (
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
        {/* Header Row */}
        <div className="flex shrink-0 border-b-2 border-surface-300">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 border-r-2 border-surface-300 p-4 flex items-end justify-start`}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">EMPLOYEE / ROLE</p>
          </div>
          <div className={`${DAY_COL_WIDTH} flex-shrink-0 py-4 px-3 text-center bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600`}>
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">{WEEKDAYS[currentDate.getDay()]}</p>
            <p className="text-2xl font-extrabold text-white">{currentDate.getDate()}</p>
            <p className="text-[10px] text-white/70 font-semibold mt-0.5">{currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 overflow-y-auto custom-scrollbar border-r-2 border-surface-300 bg-gradient-to-b from-surface-100 to-surface-50`}>
            <div className="divide-y-2 divide-surface-300">
              {employees.map(emp => (
                <div key={emp.id} className={`${ROW_HEIGHT} p-4 bg-white hover:bg-surface-50/80 transition-colors flex items-center border-b border-surface-200`}>
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-md">
                      {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-surface-800 truncate">{emp.name}</p>
                      <p className="text-[10px] text-surface-500 font-medium truncate">{emp.role || 'Staff'}</p>
                      {emp.hoursWorked && <p className="text-[10px] font-semibold text-teal-600 mt-1">{emp.hoursWorked}h</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="inline-flex">
              <div className={`flex-shrink-0 ${DAY_COL_WIDTH} divide-y-2 divide-surface-300 bg-emerald-50/10`}>
                {employees.map(emp => (
                  <div key={emp.id} className={`${ROW_HEIGHT} p-3 hover:bg-surface-50/50 transition-colors flex items-center justify-center border-b border-surface-200`}>
                    <div className="w-full space-y-1.5 flex flex-col items-center justify-center">
                      {shifts.map(shift => {
                        const workers = daySchedule[shift.id] || [];
                        const isAssigned = workers.includes(emp.id);
                        if (!isAssigned) return null;
                        return (
                          <div key={shift.id} onClick={() => openEditModal(dateKey, shift.id, workers)} className={`group cursor-pointer rounded-lg p-2 text-center transition-all hover:shadow-md hover:scale-105 relative overflow-hidden border-2 w-full ${getShiftColor(shift.id)} bg-opacity-30 border-opacity-50`}>
                            <p className="text-[9px] font-extrabold uppercase tracking-wider leading-tight">{getShiftLabel(shift.id)}</p>
                            <p className="text-[8px] font-semibold mt-0.5 opacity-75">{getShiftTime(shift.id)}</p>
                            <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-brand-600 transition-opacity"><Edit2 size={10} /></div>
                          </div>
                        );
                      })}
                      {shifts.filter(s => (daySchedule[s.id] || []).includes(emp.id)).length === 0 && (
                        <div className="rounded-lg p-2 text-center bg-surface-200/40 border-2 border-surface-300/40 w-full">
                          <p className="text-[9px] font-semibold text-surface-500">OFF</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWeeklyGridView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }

    const EMPLOYEE_COL_WIDTH = 'w-48';
    const DAY_COL_WIDTH = 'w-44';
    const ROW_HEIGHT = 'h-24';

    return (
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
        <div className="flex shrink-0 border-b-2 border-surface-300">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 border-r-2 border-surface-300 p-4 flex items-end justify-start`}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">EMPLOYEE / ROLE</p>
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar">
            <div className="flex">
              {weekDays.map((day, idx) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div key={idx} className={`${DAY_COL_WIDTH} flex-shrink-0 py-4 px-3 text-center border-r-2 border-surface-300 last:border-r-0 ${isWeekend ? 'bg-gradient-to-br from-indigo-400 via-purple-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600'}`}>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">{WEEKDAYS[day.getDay()]}</p>
                    <p className="text-2xl font-extrabold text-white">{day.getDate()}</p>
                    <p className="text-[10px] text-white/70 font-semibold mt-0.5">{day.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 overflow-y-auto custom-scrollbar border-r-2 border-surface-300 bg-gradient-to-b from-surface-100 to-surface-50`}>
            <div className="divide-y-2 divide-surface-300">
              {employees.map(emp => (
                <div key={emp.id} className={`${ROW_HEIGHT} p-4 bg-white hover:bg-surface-50/80 transition-colors flex items-center border-b border-surface-200`}>
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-md">
                      {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-surface-800 truncate">{emp.name}</p>
                      <p className="text-[10px] text-surface-500 font-medium truncate">{emp.role || 'Staff'}</p>
                      {emp.hoursWorked && <p className="text-[10px] font-semibold text-teal-600 mt-1">{emp.hoursWorked}h</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="inline-flex">
              {weekDays.map((day, dayIdx) => {
                const dateKey = getSafeDateKey(day);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const daySchedule = schedule?.[dateKey] || {};
                return (
                  <div key={dayIdx} className={`flex-shrink-0 ${DAY_COL_WIDTH} border-r-2 border-surface-300 last:border-r-0 divide-y-2 divide-surface-300 ${isWeekend ? 'bg-indigo-50/10' : 'bg-emerald-50/10'}`}>
                    {employees.map(emp => (
                      <div key={emp.id} className={`${ROW_HEIGHT} p-3 hover:bg-surface-50/50 transition-colors flex items-center justify-center border-b border-surface-200`}>
                        <div className="w-full space-y-1.5 flex flex-col items-center justify-center">
                          {shifts.map(shift => {
                            const workers = daySchedule[shift.id] || [];
                            const isAssigned = workers.includes(emp.id);
                            if (!isAssigned) return null;
                            return (
                              <div key={shift.id} onClick={() => openEditModal(dateKey, shift.id, workers)} className={`group cursor-pointer rounded-lg p-2 text-center transition-all hover:shadow-md hover:scale-105 relative overflow-hidden border-2 w-full ${getShiftColor(shift.id)} bg-opacity-30 border-opacity-50`}>
                                <p className="text-[9px] font-extrabold uppercase tracking-wider leading-tight">{getShiftLabel(shift.id)}</p>
                                <p className="text-[8px] font-semibold mt-0.5 opacity-75">{getShiftTime(shift.id)}</p>
                                <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-brand-600 transition-opacity"><Edit2 size={10} /></div>
                              </div>
                            );
                          })}
                          {shifts.filter(s => (daySchedule[s.id] || []).includes(emp.id)).length === 0 && (
                            <div className="rounded-lg p-2 text-center bg-surface-200/40 border-2 border-surface-300/40 w-full">
                              <p className="text-[9px] font-semibold text-surface-500">OFF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyGridView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const EMPLOYEE_COL_WIDTH = 'w-48';
    const DAY_COL_WIDTH = 'w-32';
    const ROW_HEIGHT = 'h-20';

    return (
      <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full">
        <div className="flex shrink-0 border-b-2 border-surface-300">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 border-r-2 border-surface-300 p-4 flex items-end justify-start`}>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">EMPLOYEE / ROLE</p>
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar">
            <div className="flex">
              {monthDays.map((day) => {
                const dateObj = new Date(year, month, day);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                return (
                  <div key={day} className={`${DAY_COL_WIDTH} flex-shrink-0 py-3 px-2 text-center border-r-2 border-surface-300 last:border-r-0 ${isWeekend ? 'bg-gradient-to-br from-indigo-400 via-purple-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600'}`}>
                    <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mb-0.5">{WEEKDAYS[dateObj.getDay()]}</p>
                    <p className="text-xl font-extrabold text-white">{day}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className={`${EMPLOYEE_COL_WIDTH} flex-shrink-0 overflow-y-auto custom-scrollbar border-r-2 border-surface-300 bg-gradient-to-b from-surface-100 to-surface-50`}>
            <div className="divide-y-2 divide-surface-300">
              {employees.map(emp => (
                <div key={emp.id} className={`${ROW_HEIGHT} p-3 bg-white hover:bg-surface-50/80 transition-colors flex items-center border-b border-surface-200`}>
                  <div className="flex items-start gap-2 w-full">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-md">
                      {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-surface-800 truncate">{emp.name}</p>
                      <p className="text-[9px] text-surface-500 font-medium truncate">{emp.role || 'Staff'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <div className="inline-flex">
              {monthDays.map((day) => {
                const dateObj = new Date(year, month, day);
                const dateKey = getSafeDateKey(dateObj);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const daySchedule = schedule?.[dateKey] || {};
                return (
                  <div key={day} className={`flex-shrink-0 ${DAY_COL_WIDTH} border-r-2 border-surface-300 last:border-r-0 divide-y-2 divide-surface-300 ${isWeekend ? 'bg-indigo-50/10' : 'bg-emerald-50/10'}`}>
                    {employees.map(emp => (
                      <div key={emp.id} className={`${ROW_HEIGHT} p-2 hover:bg-surface-50/50 transition-colors flex items-center justify-center border-b border-surface-200`}>
                        <div className="w-full space-y-0.5 flex flex-col items-center justify-center">
                          {shifts.map(shift => {
                            const workers = daySchedule[shift.id] || [];
                            const isAssigned = workers.includes(emp.id);
                            if (!isAssigned) return null;
                            return (
                              <div key={shift.id} onClick={() => openEditModal(dateKey, shift.id, workers)} className={`group cursor-pointer rounded p-1 text-center transition-all hover:shadow-md hover:scale-105 relative overflow-hidden border w-full text-[7px] ${getShiftColor(shift.id)} bg-opacity-30 border-opacity-50`}>
                                <p className="font-extrabold uppercase leading-tight">{getShiftLabel(shift.id)}</p>
                              </div>
                            );
                          })}
                          {shifts.filter(s => (daySchedule[s.id] || []).includes(emp.id)).length === 0 && (
                            <div className="rounded p-1 text-center bg-surface-200/40 border border-surface-300/40 w-full">
                              <p className="text-[7px] font-semibold text-surface-500">OFF</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-5 animate-in fade-in duration-300">
      {/* ─── Current Shift Header Bar ─────────────────────────────────── */}
      {cs?.currentShift && (
        <div className="shrink-0 bg-gradient-to-r from-brand-600 via-teal-600 to-brand-700 rounded-2xl p-4 text-white shadow-lg shadow-brand-600/20 flex flex-wrap items-center gap-6">
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
            <Users size={14} className="text-white/70" />
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

      {generationError && (
        <div className="shrink-0 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 shadow-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold text-base mb-0.5">Generation Paused</h3>
            <p className="text-sm font-medium">{generationError}</p>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-surface-100 p-1 rounded-xl border border-surface-200/60 shadow-inner">
            <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'day' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><List size={16} /> Daily</button>
            <button onClick={() => setViewMode('week')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><CalendarDays size={16} /> Weekly</button>
            <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><Grid size={16} /> Monthly</button>
          </div>
          <div className="flex bg-surface-100 p-1 rounded-xl border border-surface-200/60 shadow-inner">
            <button onClick={() => setLayoutMode('grid')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${layoutMode === 'grid' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><LayoutGrid size={16} /> Grid</button>
            <button onClick={() => setLayoutMode('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${layoutMode === 'table' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><Table2 size={16} /> Table</button>
          </div>
          <div className="flex items-center bg-surface-50 border border-surface-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => navigateDate(-1)} className="p-1.5 hover:bg-white rounded-lg transition-colors"><ChevronLeft size={18} /></button>
            <span className="w-56 text-center font-bold text-surface-700 text-sm">{getDisplayDateRange()}</span>
            <button onClick={() => navigateDate(1)} className="p-1.5 hover:bg-white rounded-lg transition-colors"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="flex gap-3 w-full xl:w-auto">
          <button onClick={handleGenerate} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 active:scale-95 transition-all"><RefreshCw size={16} /> Auto-Generate</button>
          <button onClick={downloadCSV} disabled={!schedule} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-surface-300 hover:bg-surface-50 text-surface-700 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"><Download size={16} /> Export</button>
        </div>
      </div>

      {/* Grid Area */}
      {!schedule ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-surface-200 border-dashed animate-in fade-in min-h-0">
          <Users className="text-surface-300 mb-4" size={56} />
          <h3 className="text-xl font-extrabold text-surface-800 mb-1">No Active Schedule</h3>
          <p className="text-surface-500 font-medium text-sm">Check your configuration and click Auto-Generate to build the roster.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-500">
          {viewMode === 'day' && layoutMode === 'grid' && renderDailyGridView()}
          {viewMode === 'day' && layoutMode === 'table' && <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">{renderDailyView()}</div>}
          {viewMode === 'week' && layoutMode === 'grid' && renderWeeklyGridView()}
          {viewMode === 'week' && layoutMode === 'table' && <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">{renderWeeklyView()}</div>}
          {viewMode === 'month' && layoutMode === 'grid' && renderMonthlyGridView()}
          {viewMode === 'month' && layoutMode === 'table' && renderMonthlyGrid()}
        </div>
      )}

      {/* Floating Edit Modal */}
      <EditShiftModal
        isOpen={editingShift !== null}
        onClose={() => setEditingShift(null)}
        dateKey={editingShift?.dateKey}
        shift={shifts.find(s => s.id === editingShift?.shiftId)}
        assignedIds={editingShift?.currentWorkers}
        employees={employees}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
