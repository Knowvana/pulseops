// ============================================================================
// RosterReports Component — PulseOps UI
//
// PURPOSE: Compliance and utilization reporting for the Shift Roster module.
// Displays per-employee timeline, shift counts, days worked, offs, and leaves
// in a rich data table with color-coded status cells.
//
// ARCHITECTURE: Module-specific component. Pure view — no side effects.
// Receives schedule, employees, shifts, leaves, and view state as props.
// ============================================================================
import React from 'react';
import {
  ChevronLeft, ChevronRight, Info, CalendarDays,
  CheckCircle2, CalendarX2, Users, BarChart3, List, Grid
} from 'lucide-react';
import { getSafeDateKey } from '@modules/roster/utils/rosterUtils';
import { WEEKDAYS } from '@modules/roster/utils/rosterConstants';

export default function RosterReports({
  schedule, employees, shifts, leaves, currentDate,
  viewMode, setViewMode, navigateDate, getDisplayDateRange
}) {
  if (!schedule) {
    return (
      <div className="text-center py-24 bg-white rounded-2xl border-2 border-surface-200 border-dashed h-full flex flex-col items-center justify-center">
        <BarChart3 className="mx-auto text-surface-300 mb-5" size={56} />
        <h3 className="text-xl font-bold text-surface-800 mb-2">No Data Available</h3>
        <p className="text-surface-500 font-medium">Generate a roster first to view compliance and utilization reports.</p>
      </div>
    );
  }

  let datesToRender = [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (viewMode === 'day') {
    datesToRender.push(new Date(currentDate));
  } else if (viewMode === 'week') {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      datesToRender.push(d);
    }
  } else {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      datesToRender.push(new Date(year, month, i));
    }
  }

  const capacityPerWeek = employees.length * 5;
  const slotsNeededPerWeek = shifts.reduce((sum, shift) => sum + (shift.reqWeekday * 5) + (shift.reqWeekend * 2), 0);
  const excessCapacity = capacityPerWeek - slotsNeededPerWeek;

  const reportData = employees.map(emp => {
    let daysWorked = 0, totalLeaves = 0, totalOffs = 0;
    const weeklyOffTracker = {};
    const dailyStatus = [];
    const shiftCounts = {};
    shifts.forEach(s => shiftCounts[s.id] = 0);

    datesToRender.forEach(d => {
      const dateKey = getSafeDateKey(d);
      const daySchedule = schedule[dateKey];
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = getSafeDateKey(weekStart);

      if (weeklyOffTracker[weekKey] === undefined) weeklyOffTracker[weekKey] = 0;

      let status = 'standby';
      let workedShiftObj = null;
      let shiftCode = '';
      let shiftName = '';

      const isOnLeave = leaves.some(l => l.empId === emp.id && l.date === dateKey);

      if (isOnLeave) {
        status = 'leave'; totalLeaves++;
      } else if (daySchedule) {
        for (const shift of shifts) {
          if (daySchedule[shift.id]?.includes(emp.id)) {
            workedShiftObj = shift;
            break;
          }
        }
        if (workedShiftObj) {
          status = 'worked';
          daysWorked++;
          shiftCounts[workedShiftObj.id]++;
          shiftCode = workedShiftObj.label.substring(0, 3).toUpperCase();
          shiftName = workedShiftObj.label;
        } else {
          if (weeklyOffTracker[weekKey] < 2) {
            status = 'off'; weeklyOffTracker[weekKey]++; totalOffs++;
          } else {
            status = 'standby';
          }
        }
      }
      dailyStatus.push({ day: d.getDate(), dayName: WEEKDAYS[d.getDay()], status, fullDate: dateKey, shiftCode, shiftName });
    });

    const weeks = [];
    let currentWeek = [];
    dailyStatus.forEach(ds => {
      currentWeek.push(ds);
      if (ds.dayName === 'Sat' || ds === dailyStatus[dailyStatus.length - 1]) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    return { ...emp, daysWorked, totalOffs, totalLeaves, shiftCounts, weeks };
  });

  return (
    <div className="flex flex-col h-full space-y-5 animate-in fade-in duration-300 min-h-0">

      {/* View Mode Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-4 rounded-2xl border border-surface-200 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-surface-100 p-1.5 rounded-xl border border-surface-200/60 shadow-inner">
            <button onClick={() => setViewMode('day')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'day' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><List size={16} /> Daily</button>
            <button onClick={() => setViewMode('week')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><CalendarDays size={16} /> Weekly</button>
            <button onClick={() => setViewMode('month')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-brand-600 border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}><Grid size={16} /> Monthly</button>
          </div>
          <div className="flex items-center bg-surface-50 border border-surface-200 rounded-xl p-1.5 shadow-sm">
            <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronLeft size={18} /></button>
            <span className="w-64 text-center font-bold text-surface-700 text-sm">{getDisplayDateRange()}</span>
            <button onClick={() => navigateDate(1)} className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronRight size={18} /></button>
          </div>
        </div>

        {viewMode === 'month' && excessCapacity > 0 && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2 flex items-center gap-3 text-brand-800">
            <Info className="shrink-0 text-brand-600" size={18} />
            <div className="text-xs font-medium">Surplus Capacity: <strong>{excessCapacity} unassigned shifts/week</strong> will be marked as Standby (Gray).</div>
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-surface-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse min-w-max">
            <thead className="bg-surface-50 text-surface-500 border-b border-surface-200 shadow-[0_1px_0_0_#e2e8f0] sticky top-0 z-30">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider sticky left-0 top-0 bg-surface-50 z-40 w-56 border-r border-surface-200 shadow-[1px_0_0_0_#e2e8f0]">Employee Record</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider border-r border-surface-100">Timeline Overview</th>
                <th className="px-4 py-4 font-bold uppercase tracking-wider text-center border-r border-surface-100 bg-emerald-50/50 text-emerald-700">Total Worked</th>
                {shifts.map(shift => (
                  <th key={shift.id} className="px-4 py-4 font-bold uppercase tracking-wider text-center border-r border-surface-100">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full shadow-sm ${shift.color.split(' ')[0]}`}></div>
                      {shift.label}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-4 font-bold uppercase tracking-wider text-center border-r border-surface-100 text-rose-600 bg-rose-50/50">Total Offs</th>
                <th className="px-4 py-4 font-bold uppercase tracking-wider text-center text-amber-600 bg-amber-50/50">Leaves</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {reportData.map((row) => (
                <tr key={row.id} className="hover:bg-surface-50/80 transition-colors group">
                  <td className="px-6 py-3 font-bold text-surface-800 flex items-center gap-4 sticky left-0 bg-white z-20 w-56 border-r border-surface-100 shadow-[1px_0_0_0_#f1f5f9] group-hover:bg-surface-50/80">
                    <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-black shrink-0 border border-brand-100 shadow-sm">
                      {row.name.charAt(0)}
                    </div>
                    <span className="truncate text-sm">{row.name}</span>
                  </td>
                  <td className="px-6 py-2 border-r border-surface-100">
                    <div className="flex gap-4 items-center w-max py-1">
                      {row.weeks.map((week, wIdx) => (
                        <div key={wIdx} className="flex gap-1.5 p-1.5 bg-surface-50/60 rounded-xl border border-surface-100 shadow-inner">
                          {week.map(status => {
                            let cellClasses = '';
                            let badgeClasses = '';
                            const isWeekend = status.dayName === 'Sat' || status.dayName === 'Sun';

                            if (status.status === 'worked') {
                              cellClasses = isWeekend ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700/80' : 'bg-emerald-50 border-emerald-200 text-emerald-800';
                              badgeClasses = 'bg-emerald-100/80 text-emerald-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]';
                            } else if (status.status === 'off') {
                              cellClasses = isWeekend ? 'bg-rose-50/50 border-rose-100 text-rose-700/80' : 'bg-rose-50 border-rose-200 text-rose-800';
                              badgeClasses = 'bg-rose-100/80 text-rose-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]';
                            } else if (status.status === 'leave') {
                              cellClasses = isWeekend ? 'bg-amber-50/50 border-amber-100 text-amber-700/80' : 'bg-amber-50 border-amber-200 text-amber-800';
                              badgeClasses = 'bg-amber-100/80 text-amber-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]';
                            } else {
                              cellClasses = 'bg-surface-50 border-surface-200 text-surface-400';
                              badgeClasses = 'bg-surface-200/50 text-surface-500';
                            }

                            return (
                              <div key={status.day} title={`Date: ${status.fullDate} - ${status.status.toUpperCase()} ${status.shiftName ? '(' + status.shiftName + ')' : ''}`}
                                className={`shrink-0 flex flex-col justify-between w-11 h-[52px] rounded-lg border ${cellClasses} transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default p-1.5`}
                              >
                                <div className="flex justify-between items-start leading-none">
                                  <span className="text-[11px] font-bold">{status.day}</span>
                                  <span className="text-[7px] font-bold uppercase tracking-widest opacity-50 mt-[1px]">{status.dayName.substring(0, 2)}</span>
                                </div>
                                <div className="flex justify-center w-full mt-auto">
                                  {status.status === 'worked' ? (
                                    <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1 py-[2px] rounded w-full text-center truncate ${badgeClasses}`}>{status.shiftCode}</span>
                                  ) : (
                                    <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1 py-[2px] rounded w-full text-center ${badgeClasses}`}>
                                      {status.status === 'off' ? 'OFF' : status.status === 'leave' ? 'LEAVE' : '-'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-black text-emerald-700 bg-emerald-50/30 text-base border-r border-surface-100">{row.daysWorked}</td>
                  {shifts.map(shift => (
                    <td key={shift.id} className="px-4 py-3 text-center font-bold text-surface-600 text-sm border-r border-surface-100">
                      {row.shiftCounts[shift.id] > 0 ? (
                        <span className={`px-2.5 py-1 rounded-md ${shift.color} bg-opacity-30 shadow-sm border`}>{row.shiftCounts[shift.id]}</span>
                      ) : (
                        <span className="text-surface-300 font-medium">-</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center border-r border-surface-100">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold shadow-sm border ${row.totalOffs >= (viewMode === 'month' ? 8 : viewMode === 'week' ? 2 : 0) ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                      {row.totalOffs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center bg-amber-50/10">
                    {row.totalLeaves > 0 ? <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">{row.totalLeaves}</span> : <span className="text-surface-300 font-bold">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
