// ============================================================================
// ServiceNow Reports — PulseOps UI
//
// PURPOSE: Report viewer for the ServiceNow module. Displays Incident Report,
// RITM Report, SLA Compliance Report, and Change Report. Each report has a
// daily/weekly/monthly toggle. Data is fetched from the API and displayed
// as summary cards, breakdown tables, and detail lists.
//
// ARCHITECTURE: Uses ServiceNowService directly for report fetching (not
// context) to keep report state local. Reads UI text from uiElementsText.json.
// Uses shared components and consistent gradient theming.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered for 'reports' view
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import {
  BarChart3, Bug, FileText, Shield, GitPullRequest,
  CheckCircle2, XCircle, Clock, TrendingUp, AlertTriangle, Calendar
} from 'lucide-react';

const txt = uiText.serviceNow.reports;

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

function DateRangeSelector({ startDate, endDate, onStartDateChange, onEndDateChange }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
      <Calendar size={16} className="text-surface-500" />
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-surface-600">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-3 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <span className="text-surface-400 mt-5">—</span>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-surface-600">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-3 py-1.5 text-xs border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>
    </div>
  );
}

function PeriodToggle({ period, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-surface-200 overflow-hidden">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-4 py-2 text-xs font-semibold transition-colors ${
            period === p.id
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
              : 'bg-white text-surface-600 hover:bg-surface-50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

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
              <span className="text-xs text-surface-600 flex-1 truncate">{key}</span>
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

function SlaComplianceCard({ title, met, breached, compliance, target, color }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm p-4">
      <h4 className="text-xs font-bold text-surface-700 mb-3">{title}</h4>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-surface-500">{txt.sla.compliancePercent}</span>
            <span className={`font-bold ${compliance >= 80 ? 'text-emerald-600' : compliance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {compliance !== null ? `${compliance}%` : '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-200 overflow-hidden">
            <div
              className={`h-full rounded-full ${compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${compliance || 0}%` }}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {target !== null && target !== undefined && (
          <div>
            <p className="text-xs text-surface-500">{txt.sla.target}</p>
            <p className="text-sm font-semibold text-surface-800">{target} min</p>
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

// ─── INCIDENT REPORT ───────────────────────────────────────────────────────
function IncidentReport({ period, startDate, endDate, shouldGenerate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // For period-based reports, always generate on period change
    // For custom, only generate if shouldGenerate is true
    if (period === 'custom' && !shouldGenerate) return;
    
    async function fetch() {
      setLoading(true);
      const res = await ServiceNowService.getIncidentReport(period, startDate, endDate);
      if (res.success) setReport(res.data);
      setLoading(false);
    }
    fetch();
  }, [period, startDate, endDate, shouldGenerate]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={txt.incidents.totalCount} value={report.totalCount} color="from-red-500 to-rose-600" icon={Bug} />
        <StatCard label={txt.incidents.avgResponseTime} value={report.averageResponseTime} suffix={txt.incidents.minutes} color="from-blue-500 to-cyan-600" icon={Clock} />
        <StatCard label={txt.incidents.avgResolutionTime} value={report.averageResolutionTime} suffix={txt.incidents.minutes} color="from-amber-500 to-orange-600" icon={TrendingUp} />
        <StatCard label={`${Object.keys(report.byCategory || {}).length} Categories`} value={Object.keys(report.byCategory || {}).length} color="from-emerald-500 to-teal-600" icon={BarChart3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownTable title={txt.incidents.byPriority} data={report.byPriority} />
        <BreakdownTable title={txt.incidents.byState} data={report.byState} />
        <BreakdownTable title={txt.incidents.byCategory} data={report.byCategory} />
      </div>
    </div>
  );
}

// ─── RITM REPORT ───────────────────────────────────────────────────────────
function RitmReport({ period, startDate, endDate, shouldGenerate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === 'custom' && !shouldGenerate) return;
    
    async function fetch() {
      setLoading(true);
      const res = await ServiceNowService.getRitmReport(period, startDate, endDate);
      if (res.success) setReport(res.data);
      setLoading(false);
    }
    fetch();
  }, [period, startDate, endDate, shouldGenerate]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report || report.totalCount === 0) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={txt.ritms.totalCount} value={report.totalCount} color="from-blue-500 to-indigo-600" icon={FileText} />
        <StatCard label={txt.ritms.avgResponseTime} value={report.averageResponseTime} suffix={txt.ritms.minutes} color="from-cyan-500 to-blue-600" icon={Clock} />
        <StatCard label={txt.ritms.avgFulfillmentTime} value={report.averageFulfillmentTime} suffix={txt.ritms.minutes} color="from-amber-500 to-orange-600" icon={TrendingUp} />
        <StatCard label={`${Object.keys(report.byCatalogItem || {}).length} Catalog Items`} value={Object.keys(report.byCatalogItem || {}).length} color="from-emerald-500 to-teal-600" icon={BarChart3} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BreakdownTable title={txt.ritms.byPriority} data={report.byPriority} />
        <BreakdownTable title={txt.ritms.byState} data={report.byState} />
        <BreakdownTable title={txt.ritms.byCatalogItem} data={report.byCatalogItem} />
      </div>
    </div>
  );
}

// ─── SLA COMPLIANCE REPORT ──────────────────────────────────────────────────
function SlaReport({ period, startDate, endDate, shouldGenerate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === 'custom' && !shouldGenerate) return;
    
    async function fetch() {
      setLoading(true);
      const res = await ServiceNowService.getSlaReport(period, startDate, endDate);
      if (res.success) setReport(res.data);
      setLoading(false);
    }
    fetch();
  }, [period, startDate, endDate, shouldGenerate]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!report) return <p className="text-sm text-surface-500 text-center py-12">{txt.noData}</p>;

  const { incidentSla, ritmSla } = report;
  
  // Format reporting period
  const formatPeriod = () => {
    if (period === 'custom') {
      return `${startDate} to ${endDate}`;
    }
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Reporting Period Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Reporting Period</p>
            <p className="text-lg font-bold text-surface-900 mt-1">{formatPeriod()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Total Incidents</p>
            <p className="text-lg font-bold text-surface-900 mt-1">{incidentSla?.total || 0}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Total RITMs</p>
            <p className="text-lg font-bold text-surface-900 mt-1">{ritmSla?.total || 0}</p>
          </div>
        </div>
      </div>

      {/* Overall Compliance */}
      <div>
        <h3 className="text-sm font-bold text-surface-800 mb-3">SLA Compliance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={txt.sla.incidentCompliance + ' - ' + txt.sla.responseCompliance} value={incidentSla?.responseCompliancePercent} suffix="%" color={incidentSla?.responseCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
          <StatCard label={txt.sla.incidentCompliance + ' - ' + txt.sla.resolutionCompliance} value={incidentSla?.resolutionCompliancePercent} suffix="%" color={incidentSla?.resolutionCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
          <StatCard label={txt.sla.ritmCompliance + ' - ' + txt.sla.responseCompliance} value={ritmSla?.responseCompliancePercent} suffix="%" color={ritmSla?.responseCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
          <StatCard label={txt.sla.ritmCompliance + ' - ' + txt.sla.fulfillmentCompliance} value={ritmSla?.fulfillmentCompliancePercent} suffix="%" color={ritmSla?.fulfillmentCompliancePercent >= 80 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600'} icon={CheckCircle2} />
        </div>
      </div>

      {/* Incident SLA by Priority */}
      <div>
        <h3 className="text-sm font-bold text-surface-800 mb-3">{txt.sla.incidentCompliance}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(incidentSla?.byPriority || {}).map(([priority, data]) => (
            <SlaComplianceCard
              key={`inc-resp-${priority}`}
              title={`${priority} — ${txt.sla.responseCompliance}`}
              met={data.responseMet}
              breached={data.responseBreached}
              compliance={data.responseCompliance}
              target={data.responseTarget}
            />
          ))}
        </div>
      </div>

      {/* RITM SLA by Priority */}
      <div>
        <h3 className="text-sm font-bold text-surface-800 mb-3">{txt.sla.ritmCompliance}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ritmSla?.byPriority || {}).map(([priority, data]) => (
            <SlaComplianceCard
              key={`ritm-resp-${priority}`}
              title={`${priority} — ${txt.sla.responseCompliance}`}
              met={data.responseMet}
              breached={data.responseBreached}
              compliance={data.responseCompliance}
              target={data.responseTarget}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE REPORT ────────────────────────────────────────────────────────────
function ChangeReport({ period, startDate, endDate, shouldGenerate }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === 'custom' && !shouldGenerate) return;
    
    async function fetch() {
      setLoading(true);
      const res = await ServiceNowService.getChangeReport(period, startDate, endDate);
      if (res.success) setReport(res.data);
      setLoading(false);
    }
    fetch();
  }, [period, startDate, endDate, shouldGenerate]);

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
  const [shouldGenerate, setShouldGenerate] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Initialize date range to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setShouldGenerate(false);
    setTimeout(() => {
      setShouldGenerate(true);
      setIsGenerating(false);
    }, 300);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle}</h1>
          <p className="text-surface-500 text-sm mt-1">{txt.pageSubtitle}</p>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PeriodToggle period={period} onChange={setPeriod} />
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || period !== 'custom'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <BarChart3 size={16} />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* Custom Date Range Selector - Only show when Custom is selected */}
      {period === 'custom' && (
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <DateRangeSelector 
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>
        </div>
      )}

      {/* Report Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="min-h-[300px]">
        {activeTab === 'incidents' && <IncidentReport period={period} startDate={startDate} endDate={endDate} shouldGenerate={shouldGenerate} />}
        {activeTab === 'ritms' && <RitmReport period={period} startDate={startDate} endDate={endDate} shouldGenerate={shouldGenerate} />}
        {activeTab === 'sla' && <SlaReport period={period} startDate={startDate} endDate={endDate} shouldGenerate={shouldGenerate} />}
        {activeTab === 'changes' && <ChangeReport period={period} startDate={startDate} endDate={endDate} shouldGenerate={shouldGenerate} />}
      </div>
    </div>
  );
}
