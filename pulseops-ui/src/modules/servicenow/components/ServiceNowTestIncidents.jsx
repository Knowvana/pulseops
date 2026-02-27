import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import { PlusCircle, RefreshCw, Save } from 'lucide-react';

const txt = uiText.serviceNow.testIncidents || {
  pageTitle: 'Test Incidents',
  pageSubtitle: 'Create and update incidents quickly for SLA monitoring tests',
  form: {
    number: 'Number',
    shortDescription: 'Short Description',
    priority: 'Priority',
    state: 'State',
    create: 'Create Incident',
  },
  grid: {
    title: 'Existing Incidents',
    empty: 'No incidents yet',
    update: 'Update',
    saving: 'Saving...'
  },
};

const PRIORITIES = ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'];
const STATES = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];

const generateIncidentNumber = () => {
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INC${stamp}${rand}`;
};

export default function ServiceNowTestIncidents() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    number: generateIncidentNumber(),
    shortDescription: '',
    priority: PRIORITIES[2],
    state: STATES[0],
  });

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await ServiceNowService.getIncidents();
    if (res.success) setRows(res.data || []);
    else setError(res.error || 'Failed to load incidents');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.shortDescription) return;
    setSubmitting(true);
    setError('');
    const res = await ServiceNowService.createIncident({
      number: form.number,
      shortDescription: form.shortDescription,
      priority: form.priority,
      state: form.state,
      category: 'General',
      impact: '3 - Low',
      urgency: '3 - Low',
    });
    if (res.success) {
      await load();
      setForm({ number: generateIncidentNumber(), shortDescription: '', priority: PRIORITIES[2], state: STATES[0] });
    } else {
      setError(res.error || 'Create incident failed');
    }
    setSubmitting(false);
  };

  const handleUpdate = async (row) => {
    setUpdatingId(row.id);
    setError('');
    const res = await ServiceNowService.updateIncident(row.id, { state: row.state, priority: row.priority, shortDescription: row.shortDescription });
    if (res.success) {
      await load();
    } else {
      setError(res.error || 'Update incident failed');
    }
    setUpdatingId(null);
  };

  const updateLocalRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle}</h1>
          <p className="text-surface-500 text-sm mt-1">{txt.pageSubtitle}</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

      {/* Create Form */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col text-xs text-surface-500 gap-1 md:col-span-2">
            {txt.form.shortDescription}
            <input value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })}
              className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none" placeholder="Short description" />
          </label>
          <label className="flex flex-col text-xs text-surface-500 gap-1">
            {txt.form.priority}
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-surface-500 gap-1">
            {txt.form.state}
            <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
              className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none">
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={handleCreate} disabled={submitting || !form.number || !form.shortDescription}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-60">
            <PlusCircle size={16} /> {txt.form.create}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-violet-50 to-purple-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-800">{txt.grid.title}</h3>
        </div>
        <div className="overflow-auto max-h-[520px] custom-scrollbar">
          <table className="w-full text-xs">
            <thead className="bg-surface-50 sticky top-0 z-10">
              <tr>
                {['Number', 'Summary', 'Priority', 'State', 'Action'].map(head => (
                  <th key={head} className="px-3 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap border-b border-surface-200">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-surface-400">{txt.grid.empty}</td></tr>
              )}
              {rows.map(row => (
                <tr key={row.id || row.number} className="border-t border-surface-50 hover:bg-violet-50/30 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-surface-800">{row.number}</td>
                  <td className="px-3 py-2 max-w-[240px]">
                    <input value={row.shortDescription || ''} onChange={e => updateLocalRow(row.id, 'shortDescription', e.target.value)}
                      className="w-full px-2 py-1 border border-surface-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-500 outline-none" />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select value={row.priority} onChange={e => updateLocalRow(row.id, 'priority', e.target.value)}
                      className="px-2 py-1 border border-surface-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-500 outline-none">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select value={row.state} onChange={e => updateLocalRow(row.id, 'state', e.target.value)}
                      className="px-2 py-1 border border-surface-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-500 outline-none">
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => handleUpdate(row)} disabled={updatingId === row.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60">
                      <Save size={14} /> {updatingId === row.id ? txt.grid.saving : txt.grid.update}
                    </button>
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
