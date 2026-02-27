// ============================================================================
// ServiceNow Reports — PulseOps UI
//
// PURPOSE: Full-featured report viewer for the ServiceNow module. Displays
// Incident, RITM, SLA Compliance, and Change reports with:
//   - Date navigator (prev/next for daily/weekly/monthly)
//   - Generate Report button (reports only on explicit click)
//   - Dynamic time formatting (d/h/m/s)
//   - Reporting period details with received/closed counts
//   - Data grids with pagination, page size selector, internal scroll
//   - State string display from mapping
//   - SLA explanation labels
//   - Combined Incident + RITM SLA compliance in 1 row
//
// ARCHITECTURE: Uses ServiceNowService directly for report fetching (not
// context) to keep report state local. Reads UI text from uiElementsText.json.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered for 'reports' view
// ============================================================================
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { LoadingSpinner } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import {
  BarChart3, Bug, FileText, Shield, GitPullRequest,
  CheckCircle2, Clock, TrendingUp, AlertTriangle, Calendar,
  ChevronLeft, ChevronRight, Loader2, Info, ChevronUp, ChevronDown
} from 'lucide-react';

const txt = uiText.serviceNow.reports;
const gridTxt = txt.grid;

// Custom scrollbar styles for gradient theme
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #c4b5fd, #d8b4fe);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #a78bfa, #c084fc);
  }
`;

const PERIODS = [
  { id: 'daily', label: txt.periodToggle.daily },
  { id: 'weekly', label: txt.periodToggle.weekly },
  { id: 'monthly', label: txt.periodToggle.monthly },
  { id: 'custom', label: 'Custom' },
];

const REPORT_TABS = [
  { id: 'incidents', label: txt.tabs.incidents, icon: Bug },
  { id: 'ritms', label: txt.tabs.ritms, icon: FileText },
  { id: 'sla', label: txt.tabs.sla, icon: Shield },
  { id: 'changes', label: txt.tabs.changes, icon: GitPullRequest },
];

const PAGE_SIZES = [10, 25, 50, 100];

// ─── UTILITY: Dynamic time formatting ────────────────────────────────────────
function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const absMin = Math.abs(minutes);
  if (absMin >= 1440) {
    const d = Math.floor(absMin / 1440);
    const h = Math.floor((absMin % 1440) / 60);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  if (absMin >= 60) {
    const h = Math.floor(absMin / 60);
    const m = Math.round(absMin % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (absMin >= 1) return `${Math.round(absMin)}m`;
  return `${Math.round(absMin * 60)}s`;
}

// ─── UTILITY: Date navigation helpers ────────────────────────────────────────
function computePeriodDates(period, referenceDate) {
  const ref = new Date(referenceDate);
  let start, end;
  if (period === 'daily') {
    start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = ref.getDay();
    start = new Date(ref);
    start.setDate(ref.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  return { start, end };
}

function navigateDate(period, referenceDate, direction) {
  const ref = new Date(referenceDate);
  if (period === 'daily') ref.setDate(ref.getDate() + direction);
  else if (period === 'weekly') ref.setDate(ref.getDate() + direction * 7);
  else ref.setMonth(ref.getMonth() + direction);
  return ref;
}

function formatPeriodLabel(period, referenceDate) {
  const { start, end } = computePeriodDates(period, referenceDate);
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  if (period === 'daily') return start.toLocaleDateString('en-US', { weekday: 'short', ...opts });
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

// ─── REUSABLE SUB-COMPONENTS ─────────────────────────────────────────────────
function StatCard({ label, value, suffix, color = 'from-violet-500 to-purple-600', icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm shadow-[0_0_5px_rgba(139,92,246,0.3),0_0_10px_rgba(147,51,234,0.2)] p-4 text-center">
      {Icon && <Icon size={18} className="text-surface-400 mx-auto mb-1" />}
      <p className={`text-2xl font-bold bg-gradient-to-br ${color} bg-clip-text text-transparent`}>
        {value !== null && value !== undefined ? value : '—'}
        {suffix && <span className="text-xs text-surface-400 ml-1">{suffix}</span>}
      </p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
    </div>
  );
}

function BreakdownTable({ title, data }) {
  if (!data || Object.keys(data).length === 0) return null;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-surface-50 rounded-xl border border-surface-100 p-4">
      <h4 className="text-xs font-bold text-surface-700 mb-3">{title}</h4>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const total = entries.reduce((s, [, v]) => s + v, 0);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-surface-600 flex-1 truncate">{key || '(empty)'}</span>
              <span className="text-xs font-semibold text-surface-800">{count}</span>
              <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-surface-400 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportingPeriodBanner({ report, type }) {
  if (!report?.reportingPeriod) return null;
  const rp = report.reportingPeriod;
  const startLabel = rp.start ? new Date(rp.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const endLabel = rp.end ? new Date(rp.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.reportingPeriod}</p>
          <p className="text-sm font-bold text-surface-900 mt-0.5">{startLabel} – {endLabel}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.totalReceived}</p>
          <p className="text-sm font-bold text-surface-900 mt-0.5">{report.totalCount ?? 0}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.totalClosed}</p>
          <p className="text-sm font-bold text-surface-900 mt-0.5">{report.totalClosed ?? 0}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.receivedAndClosed}</p>
          <p className="text-sm font-bold text-surface-900 mt-0.5">{report.totalReceivedAndClosed ?? 0}</p>
        </div>
      </div>
    </div>
  );
}


// ─── DATA GRID with column separators and resizing ──────────────────────────────────
function DataGrid({ data, columns, columnLabels }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dragCol, setDragCol] = useState(null);
  const [colOrder, setColOrder] = useState(columns);
  const [colWidths, setColWidths] = useState({});
  const [resizeMeta, setResizeMeta] = useState(null);

  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const sortedData = useMemo(() => {
    if (!data || !sortBy) return data || [];
    return [...data].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      // Handle dates if they are strings like '2023-01-01'
      if (typeof aVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(aVal)) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortBy, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paged = useMemo(() => sortedData.slice(page * pageSize, (page + 1) * pageSize), [sortedData, page, pageSize]);

  const handleDragStart = (col) => setDragCol(col);
  const handleDrop = (targetCol) => {
    if (!dragCol || dragCol === targetCol) return;
    const newOrder = [...colOrder];
    const fromIdx = newOrder.indexOf(dragCol);
    const toIdx = newOrder.indexOf(targetCol);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragCol);
    setColOrder(newOrder);
    setDragCol(null);
  };

  const handleMouseMove = useCallback((e) => {
    if (!resizeMeta) return;
    const delta = e.clientX - resizeMeta.startX;
    const newWidth = Math.max(80, resizeMeta.startWidth + delta);
    setColWidths(prev => ({ ...prev, [resizeMeta.col]: `${newWidth}px` }));
  }, [resizeMeta]);

  const handleMouseUp = useCallback(() => {
    setResizeMeta(null);
  }, []);

  const startResize = (e, col) => {
    const thEl = e.currentTarget?.parentElement;
    if (!thEl) return;
    const { width } = thEl.getBoundingClientRect();
    setResizeMeta({ col, startX: e.clientX, startWidth: width });
  };

  // Add event listeners when resizing
  useEffect(() => {
    if (resizeMeta) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizeMeta, handleMouseMove, handleMouseUp]);

  if (!data || data.length === 0) return <p className="text-sm text-surface-500 text-center py-8">{gridTxt.noData}</p>;

  const renderCell = (row, col) => {
    const val = row[col];
    if (val === null || val === undefined) return '—';
    if (col.includes('time') || col.includes('Time')) return formatDuration(val);
    if (col.includes('_at') || col.includes('At') || col.includes('date') || col.includes('Date')) {
      if (!val) return '—';
      return new Date(val).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    if (typeof val === 'boolean') return val ? '✓' : '✗';
    return String(val);
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-100">
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <span>{gridTxt.showing} {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} {gridTxt.of} {data.length} {gridTxt.records}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">{gridTxt.pageSize}:</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="text-xs border border-surface-200 rounded px-2 py-1 focus:ring-2 focus:ring-violet-500 outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Grid with internal scroll */}
      <div className="overflow-auto max-h-[400px] custom-scrollbar">
        <table className="w-full text-xs table-fixed">
          <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              {colOrder.filter(c => columns.includes(c)).map(col => (
                <th key={col} draggable onDragStart={() => handleDragStart(col)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col)}
                  className="px-3 py-2.5 text-left font-semibold text-surface-700 whitespace-nowrap border-b border-surface-200 border-r border-surface-100 cursor-pointer select-none hover:bg-surface-100 relative"
                  style={{ width: colWidths[col] || 'auto', minWidth: '80px' }}>
                  <div onClick={() => {
                    if (sortBy === col) {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy(col);
                      setSortDirection('asc');
                    }
                  }}>
                    <span className="block truncate">
                      {columnLabels?.[col] || col.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </span>
                    {sortBy === col && (sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />)}
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-violet-300 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize(e, col);
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row.id || row.number || i} className="hover:bg-violet-50/30 transition-colors">
                {colOrder.filter(c => columns.includes(c)).map(col => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap border-b border-surface-50 border-r border-surface-100 text-surface-700 truncate" style={{ width: colWidths[col] || 'auto', minWidth: '80px' }}>{renderCell(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-surface-100">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 text-xs font-medium text-surface-600 disabled:opacity-40 hover:text-violet-600">
            <ChevronLeft size={14} /> {gridTxt.prev}
          </button>
          <span className="text-xs text-surface-500">{gridTxt.page} {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-xs font-medium text-surface-600 disabled:opacity-40 hover:text-violet-600">
            {gridTxt.next} <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── INCIDENT REPORT ───────────────────────────────────────────────────────
function IncidentReport({ report, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  const defaultCols = ['number', 'shortDescription', 'priority', 'state', 'category', 'assignmentGroup', 'openedAt', 'responseTime', 'resolutionTime'];

  return (
    <div className="space-y-4">
      <div className="h-px bg-gradient-to-r from-violet-500 to-purple-600"></div>
      <ReportingPeriodBanner report={report} type="incidents" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={txt.incidents.totalCount} value={report.totalCount} color="from-red-500 to-rose-600" icon={Bug} />
        <StatCard label={txt.incidents.avgResponseTime} value={formatDuration(report.averageResponseTime)} color="from-blue-500 to-cyan-600" icon={Clock} />
        <StatCard label={txt.incidents.avgResolutionTime} value={formatDuration(report.averageResolutionTime)} color="from-amber-500 to-orange-600" icon={TrendingUp} />
        <StatCard label={`${Object.keys(report.byCategory || {}).length} Categories`} value={Object.keys(report.byCategory || {}).length} color="from-emerald-500 to-teal-600" icon={BarChart3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownTable title={txt.incidents.byPriority} data={report.byPriority} />
        <BreakdownTable title={txt.incidents.byState} data={report.byState} />
        <BreakdownTable title={txt.incidents.byCategory} data={report.byCategory} />
      </div>
      <div className="h-px bg-gradient-to-r from-violet-500 to-purple-600"></div>
      <h3 className="text-sm font-bold text-surface-800 mt-6">{txt.incidents.gridTitle}</h3>
      <DataGrid data={report.incidents} columns={defaultCols} columnLabels={report.stateMapping ? {} : {}} />
    </div>
  );
}

// ─── RITM REPORT ───────────────────────────────────────────────────────────
function RitmReport({ report, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  const defaultCols = ['number', 'shortDescription', 'priority', 'state', 'catalogItem', 'assignmentGroup', 'openedAt', 'fulfillmentTime'];

  return (
    <div className="space-y-4">
      <ReportingPeriodBanner report={report} type="ritms" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={txt.ritms.totalCount} value={report.totalCount} color="from-blue-500 to-indigo-600" icon={FileText} />
        <StatCard label={txt.ritms.avgResponseTime} value={formatDuration(report.averageResponseTime)} color="from-cyan-500 to-blue-600" icon={Clock} />
        <StatCard label={txt.ritms.avgFulfillmentTime} value={formatDuration(report.averageFulfillmentTime)} color="from-amber-500 to-orange-600" icon={TrendingUp} />
        <StatCard label={`${Object.keys(report.byCatalogItem || {}).length} Catalog Items`} value={Object.keys(report.byCatalogItem || {}).length} color="from-emerald-500 to-teal-600" icon={BarChart3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownTable title={txt.ritms.byPriority} data={report.byPriority} />
        <BreakdownTable title={txt.ritms.byState} data={report.byState} />
        <BreakdownTable title={txt.ritms.byCatalogItem} data={report.byCatalogItem} />
      </div>
      <h3 className="text-sm font-bold text-surface-800 mt-6">{txt.ritms.gridTitle}</h3>
      <DataGrid data={report.ritms} columns={defaultCols} />
    </div>
  );
}

// ─── SLA COMPLIANCE TABLE ────────────────────────────────────────────────────
function SlaComplianceTable({ title, rows, type }) {
  const slaTxt = txt.sla.table;
  if (!rows || rows.length === 0) return null;

  // Sort rows by priority (P1, P2, P3, etc.)
  const sortedRows = [...rows].sort((a, b) => {
    const aPriority = parseInt(a.priorityLabel.replace(/\D/g, '')) || 999;
    const bPriority = parseInt(b.priorityLabel.replace(/\D/g, '')) || 999;
    return aPriority - bPriority;
  });

  const renderSlaCell = (compliance, met, breached, hasTarget, target) => {
    if (!hasTarget) {
      return <span className="text-surface-400 text-xs">— no SLA target</span>;
    }
    if (compliance === null || compliance === undefined) {
      return <span className="text-surface-400">—</span>;
    }
    const barColor = compliance >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : compliance >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-600'
      : 'bg-gradient-to-r from-red-400 to-red-600';
    const textColor = compliance >= 80 ? 'text-emerald-600'
      : compliance >= 50 ? 'text-amber-600'
      : 'text-red-600';
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">Expected:</span>
          <span className="font-semibold text-surface-700">{target ? formatDuration(target) : '—'}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <span>Actual:</span>
            <span className={`font-bold ${textColor}`}>{compliance}%</span>
            <span>({met} met, {breached} breach)</span>
            <div className="h-2 w-12 rounded-full bg-surface-200 overflow-hidden">
              <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all`} style={{ width: `${compliance}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-violet-50 to-purple-50">
        <h3 className="text-sm font-bold text-surface-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap">{slaTxt.priority}</th>
              <th className="px-4 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap">Response</th>
              <th className="px-4 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap">Resolution</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const hasResponseTarget = row.responseTarget !== null && row.responseTarget !== undefined;
              const hasResolutionTarget = row.resolutionTarget !== null && row.resolutionTarget !== undefined;
              return (
                <tr key={i} className={`border-t border-surface-50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-50/40'} hover:bg-violet-50/30 transition-colors`}>
                  <td className="px-4 py-3 font-semibold text-surface-800 whitespace-nowrap align-top">
                    {row.priorityLabel}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {renderSlaCell(row.responseCompliance, row.responseMet, row.responseBreached, hasResponseTarget, row.responseTarget)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {renderSlaCell(row.resolutionCompliance, row.resolutionMet, row.resolutionBreached, hasResolutionTarget, row.resolutionTarget)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SLA INCIDENT DETAILS GRID ───────────────────────────────────────────────
function SlaIncidentGrid({ incidents }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('openedAt');
  const [sortDir, setSortDir] = useState('desc');
  const gridTxtSla = txt.sla.incidentGrid;

  const sorted = useMemo(() => {
    if (!incidents) return [];
    return [...incidents].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && /^\d{4}/.test(av)) { av = new Date(av); bv = new Date(bv); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [incidents, sortBy, sortDir]);

  const totalPages = Math.ceil((sorted.length || 0) / pageSize);
  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? (sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />)
    : null;

  const fmtDt = (v) => v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const SlaBadge = ({ met }) => {
    if (met === null || met === undefined) return <span className="text-surface-400">—</span>;
    return met
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✓ Met</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Breached</span>;
  };

  if (!incidents || incidents.length === 0) return null;

  const cols = [
    { key: 'number',          label: gridTxtSla.number },
    { key: 'shortDescription',label: gridTxtSla.description },
    { key: 'priority',        label: gridTxtSla.priority },
    { key: 'state',           label: gridTxtSla.state },
    { key: 'openedAt',        label: gridTxtSla.openedAt },
    { key: 'closedAt',        label: gridTxtSla.closedAt },
    { key: 'slaResponseMet',  label: gridTxtSla.responseSla },
    { key: 'responseMinutes', label: gridTxtSla.responseTime },
    { key: 'slaResolutionMet',label: gridTxtSla.resolutionSla },
    { key: 'resolutionMinutes',label: gridTxtSla.resolutionTime },
  ];

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-violet-50 to-purple-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-surface-800">{gridTxtSla.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">{gridTxt.showing} {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} {gridTxt.of} {sorted.length} {gridTxt.records}</span>
          <span className="text-xs text-surface-500">{gridTxt.pageSize}:</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="text-xs border border-surface-200 rounded px-2 py-1 focus:ring-2 focus:ring-violet-500 outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-auto max-h-[420px] custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  className="px-3 py-2.5 text-left font-semibold text-surface-600 whitespace-nowrap border-b border-surface-200 cursor-pointer select-none hover:bg-surface-100">
                  {c.label}<SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row.id || row.number || i} className={`border-t border-surface-50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-50/40'} hover:bg-violet-50/30 transition-colors`}>
                <td className="px-3 py-2 whitespace-nowrap font-medium text-violet-700">{row.number ?? '—'}</td>
                <td className="px-3 py-2 max-w-[200px] truncate text-surface-700" title={row.shortDescription}>{row.shortDescription ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.priority ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.state ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-600">{fmtDt(row.openedAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-600">{fmtDt(row.closedAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap"><SlaBadge met={row.slaResponseMet} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.responseMinutes !== null && row.responseMinutes !== undefined ? formatDuration(row.responseMinutes) : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap"><SlaBadge met={row.slaResolutionMet} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-surface-700">{row.resolutionMinutes !== null && row.resolutionMinutes !== undefined ? formatDuration(row.resolutionMinutes) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-100 bg-surface-50/50">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 text-xs font-medium text-surface-600 disabled:opacity-40 hover:text-violet-600 transition-colors">
            <ChevronLeft size={14} />{gridTxt.prev}
          </button>
          <span className="text-xs text-surface-500">{gridTxt.page} {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="flex items-center gap-1 text-xs font-medium text-surface-600 disabled:opacity-40 hover:text-violet-600 transition-colors">
            {gridTxt.next}<ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SLA COMPLIANCE REPORT ──────────────────────────────────────────────────
function SlaReport({ report, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  if (report.message && (!report.incidentSla && !report.ritmSla)) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-800 font-medium">{report.message}</p>
      </div>
    );
  }

  const { incidentSla, ritmSla, slaExplanation, reportingPeriod } = report;
  const rpStart = reportingPeriod?.start ? new Date(reportingPeriod.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const rpEnd = reportingPeriod?.end ? new Date(reportingPeriod.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  // Build table rows for incidents (one row per priority with Response and Resolution columns)
  const incidentRows = Object.entries(incidentSla?.byPriority || {}).map(([priority, data]) => ({
    priorityLabel: priority,
    responseTarget: data.responseTarget,
    responseMet: data.responseMet,
    responseBreached: data.responseBreached,
    responseCompliance: data.responseCompliance,
    resolutionTarget: data.resolutionTarget,
    resolutionMet: data.resolutionMet,
    resolutionBreached: data.resolutionBreached,
    resolutionCompliance: data.resolutionCompliance,
  }));

  // Build table rows for RITMs (one row per priority with Response and Fulfillment columns)
  const ritmRows = Object.entries(ritmSla?.byPriority || {}).map(([priority, data]) => ({
    priorityLabel: priority,
    responseTarget: data.responseTarget,
    responseMet: data.responseMet,
    responseBreached: data.responseBreached,
    responseCompliance: data.responseCompliance,
    resolutionTarget: data.fulfillmentTarget,
    resolutionMet: data.fulfillmentMet,
    resolutionBreached: data.fulfillmentBreached,
    resolutionCompliance: data.fulfillmentCompliance,
  }));

  return (
    <div className="space-y-6">
      {/* Reporting Period Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.reportingPeriod}</p>
            <p className="text-sm font-bold text-surface-900 mt-0.5">{rpStart} – {rpEnd}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.incidents.totalCount}</p>
            <p className="text-sm font-bold text-surface-900 mt-0.5">{incidentSla?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.totalClosed} (Inc)</p>
            <p className="text-sm font-bold text-surface-900 mt-0.5">{incidentSla?.totalClosed ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.ritms.totalCount}</p>
            <p className="text-sm font-bold text-surface-900 mt-0.5">{ritmSla?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{txt.totalClosed} (RITM)</p>
            <p className="text-sm font-bold text-surface-900 mt-0.5">{ritmSla?.totalClosed ?? 0}</p>
          </div>
        </div>
      </div>

      {/* SLA Explanation */}
      {slaExplanation && (
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-violet-500" />
            <h4 className="text-xs font-bold text-surface-700">{txt.sla.howCalculated}</h4>
          </div>
          <p className="text-xs text-surface-600 mb-3">{slaExplanation.calculationMethod}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-surface-600 mb-1">{txt.sla.businessHoursLabel}:</p>
              <div className="space-y-0.5">
                {(slaExplanation.businessHours || []).map((bh, i) => (
                  <p key={i} className="text-xs text-surface-500">{bh.day}: {bh.start} – {bh.end}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-surface-600 mb-1">{txt.sla.slaTargetsLabel}:</p>
              <div className="space-y-0.5">
                {(slaExplanation.slaTargets || []).map((s, i) => (
                  <p key={i} className="text-xs text-surface-500">
                    {s.recordType} {s.priority}: {txt.sla.responseCompliance} {formatDuration(s.responseTimeMinutes)}, {txt.sla.resolutionCompliance} {formatDuration(s.resolutionTimeMinutes)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident SLA Compliance Table */}
      {incidentRows.length > 0 && (
        <SlaComplianceTable title={txt.sla.incidentCompliance} rows={incidentRows} />
      )}

      {/* RITM SLA Compliance Table */}
      {ritmRows.length > 0 && (
        <SlaComplianceTable title={txt.sla.ritmCompliance} rows={ritmRows} />
      )}

      {/* Incident Details Grid */}
      {incidentSla?.incidents && incidentSla.incidents.length > 0 && (
        <SlaIncidentGrid incidents={incidentSla.incidents} />
      )}
    </div>
  );
}

// ─── CHANGE REPORT ────────────────────────────────────────────────────────────
function ChangeReport({ report, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label={txt.changes.totalCount} value={report.totalCount} color="from-emerald-500 to-teal-600" icon={GitPullRequest} />
        <StatCard label={`${Object.keys(report.byType || {}).length} Types`} value={Object.keys(report.byType || {}).length} color="from-blue-500 to-indigo-600" icon={BarChart3} />
        <StatCard label={`${Object.keys(report.byRisk || {}).length} Risk Levels`} value={Object.keys(report.byRisk || {}).length} color="from-amber-500 to-orange-600" icon={AlertTriangle} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownTable title={txt.changes.byType} data={report.byType} />
        <BreakdownTable title={txt.changes.byState} data={report.byState} />
        <BreakdownTable title={txt.changes.byRisk} data={report.byRisk} />
      </div>
    </div>
  );
}

// ─── MAIN REPORTS COMPONENT ─────────────────────────────────────────────────
export default function ServiceNowReports() {
  const [activeTab, setActiveTab] = useState('incidents');
  const [period, setPeriod] = useState('monthly');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Custom date range
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [customStart, setCustomStart] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(today.toISOString().split('T')[0]);

  // Report data (fetched only on Generate click)
  const [incidentReport, setIncidentReport] = useState(null);
  const [ritmReport, setRitmReport] = useState(null);
  const [slaReport, setSlaReport] = useState(null);
  const [changeReport, setChangeReport] = useState(null);

  const getDateParams = useCallback(() => {
    if (period === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    const { start, end } = computePeriodDates(period, referenceDate);
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
  }, [period, referenceDate, customStart, customEnd]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateParams();
    const [incRes, ritmRes, slaRes, chgRes] = await Promise.all([
      ServiceNowService.getIncidentReport('custom', startDate, endDate),
      ServiceNowService.getRitmReport('custom', startDate, endDate),
      ServiceNowService.getSlaReport('custom', startDate, endDate),
      ServiceNowService.getChangeReport('custom', startDate, endDate),
    ]);
    if (incRes.success) setIncidentReport(incRes.data);
    if (ritmRes.success) setRitmReport(ritmRes.data);
    if (slaRes.success) setSlaReport(slaRes.data);
    if (chgRes.success) setChangeReport(chgRes.data);
    setLoading(false);
  }, [getDateParams]);

  const handlePrev = () => setReferenceDate(prev => navigateDate(period, prev, -1));
  const handleNext = () => setReferenceDate(prev => navigateDate(period, prev, 1));

  return (
    <div className="space-y-5 animate-fade-in">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle}</h1>
        <p className="text-surface-500 text-sm mt-1">{txt.pageSubtitle}</p>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Period Toggle */}
        <div className="inline-flex rounded-xl border border-surface-200 overflow-hidden">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                period === p.id ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-white text-surface-600 hover:bg-surface-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Navigator (for non-custom periods) */}
        {period !== 'custom' && (
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-600 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-xs font-semibold text-surface-700 min-w-[180px] text-center">{formatPeriodLabel(period, referenceDate)}</span>
            <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-600 transition-colors"><ChevronRight size={18} /></button>
          </div>
        )}

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-surface-500" />
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none" />
            <span className="text-surface-400 text-xs">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="px-2 py-1.5 text-xs border border-surface-200 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none" />
          </div>
        )}

        {/* Generate Button */}
        <button onClick={handleGenerate} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-60 transition-all whitespace-nowrap">
          {loading ? <><Loader2 size={14} className="animate-spin" /> {txt.generating}</> : <><BarChart3 size={14} /> {txt.generateReport}</>}
        </button>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
        {REPORT_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            }`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="min-h-[300px]">
        {activeTab === 'incidents' && <IncidentReport report={incidentReport} loading={loading} />}
        {activeTab === 'ritms' && <RitmReport report={ritmReport} loading={loading} />}
        {activeTab === 'sla' && <SlaReport report={slaReport} loading={loading} />}
        {activeTab === 'changes' && <ChangeReport report={changeReport} loading={loading} />}
      </div>
    </div>
  );
}
