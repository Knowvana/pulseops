import React, { useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import { AlertTriangle, CheckCircle2, Clock, Hourglass, RefreshCw } from 'lucide-react';

const txt = uiText.serviceNow.dailyMonitoring || {
  pageTitle: 'Daily Monitoring',
  pageSubtitle: 'Live view of incidents and RITMs at risk of breach',
  stats: {
    incNew: 'New Incidents Today',
    ritmNew: 'New RITMs Today',
    incAtRisk: 'Incidents at Risk',
    ritmAtRisk: 'RITMs at Risk',
  },
  grids: {
    incidentsTitle: 'Incidents',
    ritmsTitle: 'RITMs',
    empty: 'No records for today',
    acknowledge: 'Acknowledge',
    acknowledged: 'Acknowledged',
    slaBreachIn: 'SLA Breach In',
  },
};

function StatTile({ label, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white border border-surface-200 rounded-xl shadow-sm">
      <div className={`p-2 rounded-lg text-white bg-gradient-to-br ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-xl font-bold text-surface-900">{value}</p>
      </div>
    </div>
  );
}

function DataRow({ row, onAck, ackLabel, isAcking }) {
  return (
    <tr className="border-t border-surface-50 hover:bg-violet-50/30 transition-colors">
      <td className="px-3 py-2 whitespace-nowrap font-semibold text-surface-800">{row.number}</td>
      <td className="px-3 py-2 max-w-[220px] truncate text-surface-700" title={row.shortDescription}>{row.shortDescription}</td>
      <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.priority}</td>
      <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.state}</td>
      <td className="px-3 py-2 whitespace-nowrap text-surface-600">{row.slaBreachIn}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button
          onClick={() => onAck(row)}
          disabled={isAcking || row.acknowledged}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${row.acknowledged
            ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
            : 'border-violet-200 text-violet-700 bg-white hover:bg-violet-50 disabled:opacity-60'}`}
        >
          {row.acknowledged ? ackLabel.done : ackLabel.cta}
        </button>
      </td>
    </tr>
  );
}

export default function ServiceNowDailyMonitoring() {
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [ritms, setRitms] = useState([]);
  const [stats, setStats] = useState({ incNew: 0, ritmNew: 0, incAtRisk: 0, ritmAtRisk: 0 });

  const loadData = async () => {
    setLoading(true);
    // Placeholder: replace with real API when available
    // Using existing ServiceNowService hooks to align with module pattern
    const todayIncidents = await ServiceNowService.getIncidentReport?.('daily');
    const todayRitms = await ServiceNowService.getRitmReport?.('daily');
    // Fallback demo data if not implemented
    const incData = todayIncidents?.data?.incidents || [];
    const ritmData = todayRitms?.data?.ritms || [];
    const mapRow = (item) => ({
      number: item.number,
      shortDescription: item.shortDescription,
      priority: item.priority,
      state: item.state,
      slaBreachIn: item.slaBreachIn || '45m',
      acknowledged: false,
      id: item.id,
    });
    const incRows = incData.map(mapRow);
    const ritmRows = ritmData.map(mapRow);
    setIncidents(incRows);
    setRitms(ritmRows);
    setStats({
      incNew: incRows.length,
      ritmNew: ritmRows.length,
      incAtRisk: incRows.filter(r => r.slaBreachIn && r.slaBreachIn !== '—').length,
      ritmAtRisk: ritmRows.filter(r => r.slaBreachIn && r.slaBreachIn !== '—').length,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const acknowledge = async (row, type) => {
    setAckLoading(true);
    try {
      await ServiceNowService.updateIncident?.(row.id, { comment: 'Acknowledged: triage in progress.' });
      if (type === 'inc') {
        setIncidents(prev => prev.map(r => r.id === row.id ? { ...r, acknowledged: true } : r));
      } else {
        setRitms(prev => prev.map(r => r.id === row.id ? { ...r, acknowledged: true } : r));
      }
    } finally {
      setAckLoading(false);
    }
  };

  const grids = useMemo(() => ([
    { title: txt.grids.incidentsTitle, rows: incidents, kind: 'inc' },
    { title: txt.grids.ritmsTitle, rows: ritms, kind: 'ritm' },
  ]), [incidents, ritms]);

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle}</h1>
          <p className="text-surface-500 text-sm mt-1">{txt.pageSubtitle}</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label={txt.stats.incNew} value={stats.incNew} icon={CheckCircle2} color="from-emerald-500 to-teal-600" />
        <StatTile label={txt.stats.ritmNew} value={stats.ritmNew} icon={CheckCircle2} color="from-blue-500 to-indigo-600" />
        <StatTile label={txt.stats.incAtRisk} value={stats.incAtRisk} icon={AlertTriangle} color="from-amber-500 to-orange-600" />
        <StatTile label={txt.stats.ritmAtRisk} value={stats.ritmAtRisk} icon={AlertTriangle} color="from-red-500 to-rose-600" />
      </div>

      {/* Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {grids.map(grid => (
          <div key={grid.title} className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-violet-50 to-purple-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-800 flex items-center gap-2"><Hourglass size={14} /> {grid.title}</h3>
              <span className="text-xs text-surface-500">{txt.grids.slaBreachIn}</span>
            </div>
            <div className="overflow-auto max-h-[420px] custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 sticky top-0 z-10">
                  <tr>
                    {['Number', 'Summary', 'Priority', 'State', 'Breach In', 'Action'].map(head => (
                      <th key={head} className="px-3 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap border-b border-surface-200">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-surface-400">{txt.grids.empty}</td></tr>
                  )}
                  {grid.rows.map(row => (
                    <DataRow
                      key={row.id || row.number}
                      row={row}
                      onAck={(r) => acknowledge(r, grid.kind)}
                      ackLabel={{ cta: txt.grids.acknowledge, done: txt.grids.acknowledged }}
                      isAcking={ackLoading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
