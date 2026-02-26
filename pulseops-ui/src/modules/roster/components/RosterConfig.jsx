// ============================================================================
// RosterConfig Component — PulseOps UI
//
// PURPOSE: Configuration panel for the Shift Roster module. Allows users
// to manage shift parameters (capacity requirements), planned leaves,
// and the employee resource pool. Supports conditional rendering for
// different configuration sections.
//
// ARCHITECTURE: Module-specific component. Uses roster constants for
// color palette. All form state is local to this component — parent
// only receives the final state updates via setter props. Shift form
// is displayed in a modal dialog using the shared Modal component.
// ============================================================================
import React, { useState } from 'react';
import { Trash2, Plus, CalendarX2, Users } from 'lucide-react';
import { Modal, Button } from '@shared';
import { COLORS } from '@modules/roster/utils/rosterConstants';
import uiText from '@shared/config/uiElementsText.json';

const rosterTxt = uiText.shiftRoster?.config || {};

const ShiftBadge = ({ shift, className = '' }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${shift.color} ${className}`}>
    <span className="truncate">{shift.label}</span>
  </div>
);

export default function RosterConfig({
  shifts = [],
  setShifts,
  employees = [],
  setEmployees,
  leaves = [],
  setLeaves,
  showOnlyShifts = false,
  showOnlyResourcePool = false,
  showOnlyLeaves = false,
}) {
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShift, setNewShift] = useState({ label: '', time: '', color: COLORS[0].value, reqWeekday: 0, reqWeekend: 0 });
  const [newLeave, setNewLeave] = useState({ empId: '', date: '' });
  const [newEmployeeName, setNewEmployeeName] = useState('');

  const addShift = () => {
    if (!newShift.label || !newShift.time) return;
    const id = newShift.label.toLowerCase().replace(/\s+/g, '-');
    setShifts([...shifts, { ...newShift, id, reqWeekday: Number(newShift.reqWeekday), reqWeekend: Number(newShift.reqWeekend) }]);
    setNewShift({ label: '', time: '', color: COLORS[0].value, reqWeekday: 0, reqWeekend: 0 });
    setShowShiftModal(false);
  };

  const removeShift = (id) => { if (shifts.length > 1) setShifts(shifts.filter(s => s.id !== id)); };
  const updateShiftReq = (id, field, value) => setShifts(shifts.map(s => s.id === id ? { ...s, [field]: Number(value) } : s));

  const addLeave = () => {
    if (!newLeave.empId || !newLeave.date) return;
    setLeaves([...leaves, { ...newLeave, id: Date.now().toString() }]);
    setNewLeave({ empId: '', date: '' });
  };
  const removeLeave = (id) => setLeaves(leaves.filter(l => l.id !== id));

  const addEmployee = () => {
    if (!newEmployeeName.trim()) return;
    const newEmp = { id: `emp-${Date.now()}`, name: newEmployeeName, role: 'Operator' };
    setEmployees([...employees, newEmp]);
    setNewEmployeeName('');
  };
  const removeEmployee = (id) => setEmployees(employees.filter(e => e.id !== id));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* SHIFT SCHEDULE - Show only when showOnlyShifts is true */}
      {showOnlyShifts && (
      <div className="bg-white p-8 rounded-3xl border border-surface-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-50 to-teal-50 text-brand-600 rounded-xl"><Plus size={24} /></div>
            <div>
              <h2 className="text-xl font-extrabold text-surface-800">{rosterTxt.shiftSchedule?.title || 'Shift Schedule'}</h2>
              <p className="text-sm text-surface-500 font-medium">{rosterTxt.shiftSchedule?.description || 'Define capacity requirements per shift'}</p>
            </div>
          </div>
          <Button variant="primary" onClick={() => setShowShiftModal(true)} icon={<Plus size={16} />}>
            {rosterTxt.shiftSchedule?.addButton || 'Add Shift'}
          </Button>
        </div>
        
        {/* Shift Grid */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-12 gap-4 px-4 text-xs font-bold text-surface-500 uppercase tracking-wider">
            <div className="col-span-5">{rosterTxt.shiftSchedule?.columns?.shiftDetails || 'Shift Details'}</div>
            <div className="col-span-3 text-center">{rosterTxt.shiftSchedule?.columns?.weekdayReq || 'Weekday Req'}</div>
            <div className="col-span-3 text-center">{rosterTxt.shiftSchedule?.columns?.weekendReq || 'Weekend Req'}</div>
            <div className="col-span-1"></div>
          </div>
          {shifts && shifts.length > 0 ? (
            shifts.map(shift => (
              <div key={shift.id} className="grid grid-cols-12 gap-4 items-center p-4 rounded-xl border border-surface-100 bg-gradient-to-r from-surface-50 to-white hover:border-surface-200 hover:shadow-sm transition-all">
                <div className="col-span-5">
                  <ShiftBadge shift={shift} className="w-fit mb-1.5" />
                  <span className="text-[11px] font-bold text-surface-400 font-mono ml-1">{shift.time}</span>
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" value={shift.reqWeekday} onChange={(e) => updateShiftReq(shift.id, 'reqWeekday', e.target.value)} className="w-full text-center text-sm font-bold px-3 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" value={shift.reqWeekend} onChange={(e) => updateShiftReq(shift.id, 'reqWeekend', e.target.value)} className="w-full text-center text-sm font-bold px-3 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeShift(shift.id)} className="text-surface-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-surface-200 rounded-2xl text-surface-400 text-sm font-medium">
              No shifts configured yet. Click "Add Shift" to create one.
            </div>
          )}
        </div>
      </div>
      )}

      {/* PLANNED LEAVES - Show only when showOnlyLeaves is true */}
      {showOnlyLeaves && (
      <div className="bg-white p-8 rounded-3xl border border-surface-200 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-500 rounded-xl"><CalendarX2 size={24} /></div>
          <div>
            <h2 className="text-xl font-extrabold text-surface-800">{rosterTxt.plannedLeaves?.title || 'Planned Leaves'}</h2>
            <p className="text-sm font-medium text-surface-500">{rosterTxt.plannedLeaves?.description || 'Manage employee leave schedules'}</p>
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          <select className="flex-1 text-sm font-medium px-4 py-3 rounded-xl border border-surface-200 bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={newLeave.empId} onChange={e => setNewLeave({ ...newLeave, empId: e.target.value })}>
            <option value="">Select Employee...</option>
            {employees && employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <input type="date" className="w-48 text-sm font-medium px-4 py-3 rounded-xl border border-surface-200 focus:ring-2 focus:ring-brand-500 outline-none" value={newLeave.date} onChange={e => setNewLeave({ ...newLeave, date: e.target.value })} />
          <Button variant="success" onClick={addLeave} disabled={!newLeave.empId || !newLeave.date}>
            {rosterTxt.plannedLeaves?.addButton || 'Add Leave'}
          </Button>
        </div>
        {leaves && leaves.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {leaves.map(leave => {
              const empName = employees?.find(e => e.id === leave.empId)?.name || 'Unknown';
              return (
                <div key={leave.id} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 hover:shadow-sm transition-shadow">
                  <div className="text-sm font-bold text-amber-900">{empName}</div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold bg-white px-3 py-1.5 rounded-lg text-amber-700 shadow-sm border border-amber-100">{leave.date}</span>
                    <button onClick={() => removeLeave(leave.id)} className="text-amber-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="text-center py-10 border-2 border-dashed border-surface-200 rounded-2xl text-surface-400 text-sm font-medium">{rosterTxt.plannedLeaves?.noData || 'No upcoming leaves registered.'}</div>}
      </div>
      )}

      {/* RESOURCE POOL - Show only when showOnlyResourcePool is true */}
      {showOnlyResourcePool && (
      <div className="bg-white p-8 rounded-3xl border border-surface-200 shadow-sm flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-gradient-to-br from-brand-50 to-teal-50 text-brand-600 rounded-xl"><Users size={24} /></div>
          <div>
            <h2 className="text-xl font-extrabold text-surface-800">{rosterTxt.resourcePool?.title || 'Resource Pool'}</h2>
            <p className="text-sm font-medium text-surface-500">{rosterTxt.resourcePool?.description?.replace('{count}', employees?.length || 0) || `Managing ${employees?.length || 0} active resources`}</p>
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          <input type="text" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEmployee()} placeholder={rosterTxt.resourcePool?.inputPlaceholder || 'Enter new employee name...'} className="flex-1 px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm" />
          <Button variant="primary" onClick={addEmployee} disabled={!newEmployeeName.trim()} icon={<Plus size={16} />}>
            {rosterTxt.resourcePool?.addButton || 'Add'}
          </Button>
        </div>
        <div className="overflow-auto max-h-96 custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-surface-50 to-surface-100 text-surface-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">{rosterTxt.resourcePool?.columns?.name || 'Name'}</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">{rosterTxt.resourcePool?.columns?.role || 'Role'}</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-right">{rosterTxt.resourcePool?.columns?.action || 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {employees && employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gradient-to-r hover:from-surface-50 hover:to-white group transition-colors">
                  <td className="px-4 py-3 font-bold text-surface-800 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 flex items-center justify-center text-xs font-black shadow-inner border border-brand-200/50">{emp.name.charAt(0)}</div>{emp.name}
                  </td>
                  <td className="px-4 py-3 text-surface-500 font-medium text-sm">{emp.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeEmployee(emp.id)} className="text-surface-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* SHIFT FORM MODAL */}
      <Modal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        title={rosterTxt.shiftSchedule?.form?.title || 'Add New Shift'}
        size="md"
      >
        <div className="space-y-5">
          {/* Shift Label */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-2">{rosterTxt.shiftSchedule?.form?.shiftLabel || 'Shift Label'}</label>
            <input
              type="text"
              placeholder={rosterTxt.shiftSchedule?.form?.shiftPlaceholder || 'e.g., Morning, Evening'}
              value={newShift.label}
              onChange={(e) => setNewShift({ ...newShift, label: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm"
            />
          </div>

          {/* Shift Time */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-2">{rosterTxt.shiftSchedule?.form?.timeLabel || 'Shift Time'}</label>
            <input
              type="text"
              placeholder={rosterTxt.shiftSchedule?.form?.timePlaceholder || 'e.g., 09:00 - 17:00'}
              value={newShift.time}
              onChange={(e) => setNewShift({ ...newShift, time: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-3">{rosterTxt.shiftSchedule?.form?.colorLabel || 'Shift Color'}</label>
            <div className="flex gap-3 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.label}
                  onClick={() => setNewShift({ ...newShift, color: c.value })}
                  className={`w-10 h-10 rounded-full border-2 shadow-sm transition-all ${c.value.split(' ')[0]} ${
                    newShift.color === c.value ? 'border-surface-800 scale-110 ring-4 ring-surface-200' : 'border-transparent hover:scale-105'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Weekday Requirement */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-2">{rosterTxt.shiftSchedule?.form?.weekdayLabel || 'Weekday Requirement'}</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={newShift.reqWeekday || ''}
              onChange={(e) => setNewShift({ ...newShift, reqWeekday: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm"
            />
          </div>

          {/* Weekend Requirement */}
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-2">{rosterTxt.shiftSchedule?.form?.weekendLabel || 'Weekend Requirement'}</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={newShift.reqWeekend || ''}
              onChange={(e) => setNewShift({ ...newShift, reqWeekend: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-surface-100">
            <Button
              variant="secondary"
              onClick={() => setShowShiftModal(false)}
              className="flex-1"
            >
              {rosterTxt.shiftSchedule?.form?.cancelButton || 'Cancel'}
            </Button>
            <Button
              variant="primary"
              onClick={addShift}
              disabled={!newShift.label || !newShift.time}
              className="flex-1"
            >
              {rosterTxt.shiftSchedule?.form?.submitButton || 'Create Shift'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
