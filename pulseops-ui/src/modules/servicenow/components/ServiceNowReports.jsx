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
import React, { useState, useCallback, useMemo } from 'react';
import { LoadingSpinner } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import {
  BarChart3, Bug, FileText, Shield, GitPullRequest,
  CheckCircle2, Clock, TrendingUp, AlertTriangle, Calendar,
  ChevronLeft, ChevronRight, Loader2, Info
} from 'lucide-react';

const txt = uiText.serviceNow.reports;
const gridTxt = txt.grid;

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
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4 text-center">
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

function SlaComplianceCard({ title, met, breached, compliance, target }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
      <h4 className="text-xs font-bold text-surface-700 mb-3">{title}</h4>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-surface-500">{txt.sla.compliancePercent}</span>
            <span className={`font-bold ${compliance >= 80 ? 'text-emerald-600' : compliance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {compliance !== null && compliance !== undefined ? `${compliance}%` : '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-200 overflow-hidden">
            <div className={`h-full rounded-full ${compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${compliance || 0}%` }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {target !== null && target !== undefined && (
          <div>
            <p className="text-xs text-surface-500">{txt.sla.target}</p>
            <p className="text-sm font-semibold text-surface-800">{formatDuration(target)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-surface-500">{txt.sla.met}</p>
          <p className="text-sm font-semibold text-emerald-600">{met ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-surface-500">{txt.sla.breached}</p>
          <p className="text-sm font-semibold text-red-600">{breached ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

// ─── DATA GRID with pagination, page size, internal scroll ───────────────────
function DataGrid({ data, columns, columnLabels }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dragCol, setDragCol] = useState(null);
  const [colOrder, setColOrder] = useState(columns);

  const totalPages = Math.ceil((data?.length || 0) / pageSize);
  const paged = useMemo(() => (data || []).slice(page * pageSize, (page + 1) * pageSize), [data, page, pageSize]);

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
      <div className="overflow-auto max-h-[400px]">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 sticky top-0 z-10">
            <tr>
              {colOrder.filter(c => columns.includes(c)).map(col => (
                <th key={col} draggable onDragStart={() => handleDragStart(col)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col)}
                  className="px-3 py-2.5 text-left font-semibold text-surface-700 whitespace-nowrap border-b border-surface-200 cursor-grab select-none hover:bg-surface-100">
                  {columnLabels?.[col] || col.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row.id || row.number || i} className="hover:bg-violet-50/30 transition-colors">
                {colOrder.filter(c => columns.includes(c)).map(col => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap border-b border-surface-50 text-surface-700">{renderCell(row, col)}</td>
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

      {/* SLA Compliance Summary — Incident + RITM in 1 row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={`${txt.sla.incidentCompliance} - ${txt.sla.responseCompliance}`} value={incidentSla?.responseCompliancePercent} suffix="%" color={incidentSla?.responseCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
        <StatCard label={`${txt.sla.incidentCompliance} - ${txt.sla.resolutionCompliance}`} value={incidentSla?.resolutionCompliancePercent} suffix="%" color={incidentSla?.resolutionCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
        <StatCard label={`${txt.sla.ritmCompliance} - ${txt.sla.responseCompliance}`} value={ritmSla?.responseCompliancePercent} suffix="%" color={ritmSla?.responseCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
        <StatCard label={`${txt.sla.ritmCompliance} - ${txt.sla.fulfillmentCompliance}`} value={ritmSla?.fulfillmentCompliancePercent} suffix="%" color={ritmSla?.fulfillmentCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
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
                    {s.recordType} P{s.priority}: Response {formatDuration(s.responseTimeMinutes)}, Resolution {formatDuration(s.resolutionTimeMinutes)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident SLA by Priority */}
      {incidentSla && (
        <div>
          <h3 className="text-sm font-bold text-surface-800 mb-3">{txt.sla.incidentCompliance}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(incidentSla.byPriority || {}).map(([priority, data]) => (
              <React.Fragment key={`inc-${priority}`}>
                <SlaComplianceCard title={`P${priority} — ${txt.sla.responseCompliance}`} met={data.responseMet} breached={data.responseBreached} compliance={data.responseCompliance} target={data.responseTarget} />
                <SlaComplianceCard title={`P${priority} — ${txt.sla.resolutionCompliance}`} met={data.resolutionMet} breached={data.resolutionBreached} compliance={data.resolutionCompliance} target={data.resolutionTarget} />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* RITM SLA by Priority */}
      {ritmSla && (
        <div>
          <h3 className="text-sm font-bold text-surface-800 mb-3">{txt.sla.ritmCompliance}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ritmSla.byPriority || {}).map(([priority, data]) => (
              <React.Fragment key={`ritm-${priority}`}>
                <SlaComplianceCard title={`P${priority} — ${txt.sla.responseCompliance}`} met={data.responseMet} breached={data.responseBreached} compliance={data.responseCompliance} target={data.responseTarget} />
                <SlaComplianceCard title={`P${priority} — ${txt.sla.fulfillmentCompliance}`} met={data.fulfillmentMet} breached={data.fulfillmentBreached} compliance={data.fulfillmentCompliance} target={data.fulfillmentTarget} />
              </React.Fragment>
            ))}
          </div>
        </div>
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
