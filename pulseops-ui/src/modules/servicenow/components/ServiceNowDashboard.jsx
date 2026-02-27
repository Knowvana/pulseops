// ============================================================================
// ServiceNow Dashboard — PulseOps UI
//
// PURPOSE: Main dashboard for the ServiceNow integration module. Displays
// connection health with inline API testing (Incidents, RITMs, Changes),
// auto-refreshed ticket counts with last load time and sync schedule info,
// and a read-only configuration summary.
//
// ARCHITECTURE: Uses ServiceNowService directly for API calls. Tests connection
// on load with inline progress bar inside the Connection Health section.
// Removes the separate API Health section — API status is shown within
// Connection Health.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered for 'dashboard' view
// ============================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import {
  Activity, CheckCircle2, XCircle, Wifi,
  Bug, FileText, GitPullRequest, RefreshCw, Clock, Shield, Loader2
} from 'lucide-react';

const txt = uiText.serviceNow.dashboard;

export default function ServiceNowDashboard() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthProgress, setHealthProgress] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsLoadedAt, setStatsLoadedAt] = useState(null);
  const [syncScheduleInfo, setSyncScheduleInfo] = useState(null);
  const initDone = useRef(false);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthProgress(10);
    try {
      setHealthProgress(40);
      const res = await ServiceNowService.getHealth();
      setHealthProgress(90);
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch (err) {
      Logger.error('ServiceNowDashboard', 'Health check failed', { error: err.message });
    }
    setHealthProgress(100);
    setTimeout(() => { setHealthLoading(false); setHealthProgress(0); }, 400);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await ServiceNowService.getStats();
      if (res.success && res.data) {
        setStats(res.data);
        setStatsLoadedAt(res.data.loadedAt || new Date().toISOString());
        if (res.data.sync) {
          setSyncScheduleInfo(res.data.sync);
        }
      }
    } catch (err) {
      Logger.error('ServiceNowDashboard', 'Stats load failed', { error: err.message });
    }
    setStatsLoading(false);
  }, []);

  const loadSyncSchedule = useCallback(async () => {
    try {
      const res = await ServiceNowService.getSyncSchedule();
      if (res.success && res.data) {
        setSyncScheduleInfo(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!initDone.current) {
      initDone.current = true;
      loadHealth();
      loadStats();
      loadSyncSchedule();
    }
  }, [loadHealth, loadStats, loadSyncSchedule]);

  const handleRefresh = useCallback(() => {
    loadHealth();
    loadStats();
  }, [loadHealth, loadStats]);

  const connStatus = health?.connectionStatus || 'not_connected';
  const isConnected = connStatus === 'connected';
  const apis = health?.apis || {};

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{txt.pageTitle}</h1>
          <p className="text-surface-500 text-sm mt-1">{txt.pageSubtitle}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={healthLoading || statsLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-surface-200 text-surface-700 hover:bg-surface-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={(healthLoading || statsLoading) ? 'animate-spin' : ''} />
          {uiText.common.refresh}
        </button>
      </div>

      {/* Connection Health Card (merged with API Health) */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <Wifi size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">{txt.connectionHealth}</h2>
              {!healthLoading && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mt-1 ${
                  isConnected ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                  {isConnected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {isConnected ? txt.connected : txt.not_connected}
                </span>
              )}
            </div>
          </div>
          {health?.lastTestedAt && !healthLoading && (
            <p className="text-xs text-surface-400">{txt.lastTested}: {new Date(health.lastTestedAt).toLocaleString()}</p>
          )}
        </div>

        {/* Inline progress bar while testing */}
        {healthLoading && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={14} className="text-brand-500 animate-spin" />
              <span className="text-xs text-surface-500">{txt.testingApis}</span>
            </div>
            <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${healthProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Instance info + API statuses */}
        {!healthLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                <p className="text-xs text-surface-500 mb-1">{txt.instanceUrl}</p>
                <p className="text-sm font-medium text-surface-800 truncate">{health?.instanceUrl || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                <p className="text-xs text-surface-500 mb-1">{txt.apiVersion}</p>
                <p className="text-sm font-medium text-surface-800">{health?.apiVersion || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                <p className="text-xs text-surface-500 mb-1">{txt.lastTested}</p>
                <p className="text-sm font-medium text-surface-800">
                  {health?.lastTestedAt ? new Date(health.lastTestedAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            {/* Per-API health (merged from old API Health section) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: txt.incidentsApi, icon: Bug, status: apis.incidents?.status },
                { label: txt.ritmsApi, icon: FileText, status: apis.ritms?.status },
                { label: txt.changesApi, icon: GitPullRequest, status: apis.changes?.status },
              ].map((api) => {
                const ok = api.status === 'connected';
                return (
                  <div key={api.label} className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 border border-surface-100">
                    <api.icon size={18} className="text-surface-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-800">{api.label}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      ok ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'
                    }`}>
                      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {ok ? txt.connected : txt.not_connected}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Ticket Counts */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Activity size={20} />
            </div>
            <h2 className="text-lg font-bold text-surface-900">{txt.ticketCounts}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {statsLoading && <Loader2 size={14} className="text-brand-500 animate-spin inline-block mr-2" />}
              {statsLoadedAt && !statsLoading && (
                <p className="text-xs text-surface-400">{txt.lastLoaded}: {new Date(statsLoadedAt).toLocaleString()}</p>
              )}
              {syncScheduleInfo && (
                <p className="text-xs text-surface-400 mt-0.5">
                  {txt.autoSyncSchedule}: {syncScheduleInfo.syncEnabled
                    ? `Every ${syncScheduleInfo.syncIntervalMinutes || 60} min`
                    : txt.syncNotConfigured}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                setStatsLoading(true);
                try {
                  await ServiceNowService.triggerSync();
                  await loadStats();
                  Logger.info('ServiceNowDashboard', 'Manual sync triggered');
                } catch (err) {
                  Logger.error('ServiceNowDashboard', 'Manual sync failed', { error: err.message });
                }
              }}
              disabled={statsLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 rounded-lg hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
              Sync Now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: txt.totalIncidents, value: stats?.incidents?.total ?? 0, color: 'from-red-500 to-rose-600' },
            { label: txt.openIncidents, value: stats?.incidents?.open ?? 0, color: 'from-red-400 to-rose-500' },
            { label: txt.totalRitms, value: stats?.ritms?.total ?? 0, color: 'from-blue-500 to-indigo-600' },
            { label: txt.openRitms, value: stats?.ritms?.open ?? 0, color: 'from-blue-400 to-indigo-500' },
            { label: txt.totalChanges, value: stats?.changes?.total ?? 0, color: 'from-emerald-500 to-teal-600' },
            { label: txt.pendingChanges, value: stats?.changes?.pending ?? 0, color: 'from-emerald-400 to-teal-500' },
          ].map((tile) => (
            <div key={tile.label} className="text-center p-4 rounded-xl bg-surface-50 border border-surface-100">
              <p className={`text-3xl font-bold bg-gradient-to-br ${tile.color} bg-clip-text text-transparent`}>
                {tile.value}
              </p>
              <p className="text-xs text-surface-500 mt-1">{tile.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Summary (read-only) */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 text-white">
            <Shield size={20} />
          </div>
          <h2 className="text-lg font-bold text-surface-900">{txt.configSummary}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
            <div className="flex items-center gap-2 mb-2">
              <Wifi size={16} className="text-violet-500" />
              <p className="text-sm font-semibold text-surface-800">{txt.connectionConfig}</p>
            </div>
            <p className="text-xs text-surface-500">
              {health?.connectionConfigured ? health.instanceUrl : txt.notConfigured}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-blue-500" />
              <p className="text-sm font-semibold text-surface-800">{txt.slaConfig}</p>
            </div>
            <p className="text-xs text-surface-500">
              {stats ? `${txt.totalIncidents}: ${stats.incidents?.total || 0}` : '—'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-emerald-500" />
              <p className="text-sm font-semibold text-surface-800">{txt.businessHours}</p>
            </div>
            <p className="text-xs text-surface-500">
              {stats ? `${txt.totalChanges}: ${stats.changes?.total || 0}` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
