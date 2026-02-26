import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Users, Settings, Activity, Database, CheckCircle2, XCircle,
  ScrollText, HardDrive, RefreshCw, ExternalLink, Clock, BarChart3, Layers, Zap, Calendar, Package
} from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import PageHeader from '@shared/components/PageHeader';
import ProgressModal from '@shared/components/ProgressModal';
import Logger from '@shared/services/logger';
import ApiClient from '@shared/services/apiClient';
import uiText from '@shared/config/uiElementsText.json';
import appConfig from '@shared/config/app.json';

const txt = uiText.platformAdmin.overview;

function StatCard({ icon, label, value, gradient, detail, glow, borderGradient, actionButton }) {
  return (
    <div className={`relative rounded-xl p-4 bg-gradient-to-br ${gradient} border border-surface-200/50 shadow-sm ${glow || ''} overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${borderGradient}`} />
      <div className="flex items-start justify-between mb-2">
        {icon}
        {actionButton}
      </div>
      <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-lg font-extrabold text-surface-800">{value}</p>
      {detail && <p className="text-[10px] text-surface-400 mt-1">{detail}</p>}
    </div>
  );
}

function GlowCard({ children }) {
  return (
    <div className="rounded-xl bg-white border border-surface-200/80 shadow-sm p-5">
      {children}
    </div>
  );
}

function MiniStat({ label, value, mono, valueColor }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className={`text-[11px] font-bold ${valueColor || 'text-surface-700'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function AdminOverview({ user, onNavigate }) {
  const [dbStatsLoading, setDbStatsLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState({ status: 'checking', uptime: 0 });
  const [dbConnection, setDbConnection] = useState({ status: 'checking', latencyMs: 0 });
  const [apiHealth, setApiHealth] = useState({ status: 'checking' });
  const [dbInitialized, setDbInitialized] = useState({ status: 'checking', tableCount: 0 });
  const [dbStats, setDbStats] = useState({ userCount: 0, logCount: 0, configCount: 0, tableCount: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [activitySearch, setActivitySearch] = useState('');

  const logStats = useMemo(() => {
    const logs = Logger.getSystemLogs();
    const apiLogs = Logger.getApiLogs();
    const errors = logs.filter((l) => l.level === 'error').length;
    const warnings = logs.filter((l) => l.level === 'warn').length;
    const last50 = logs.slice(0, 50);
    return { total: logs.length, apiTotal: apiLogs.length, errors, warnings, last50 };
  }, [isRefreshing]);

  const loadDatabaseStats = useCallback(async (showProgress = true) => {
    if (showProgress) { setIsRefreshing(true); setRefreshProgress(10); }
    setDbStatsLoading(true);
    try {
      if (showProgress) setRefreshProgress(20);
      const withTimeout = (promise, ms = 5000) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
      ]);

      // Fetch all health metrics in parallel
      const [healthRes, readinessRes, schemaRes, statsRes] = await Promise.all([
        withTimeout(ApiClient.get('/health')).catch(() => ({ success: false })),
        withTimeout(ApiClient.get('/health/readiness')).catch(() => ({ success: false })),
        withTimeout(ApiClient.get('/database/schema-status')).catch(() => ({ success: false })),
        withTimeout(ApiClient.get('/database/stats')).catch(() => ({ success: false })),
      ]);

      if (showProgress) setRefreshProgress(60);

      // System Health (API health check)
      if (healthRes?.success && healthRes?.data) {
        setSystemHealth({
          status: healthRes.data.status === 'healthy' ? 'healthy' : 'unhealthy',
          uptime: healthRes.data.uptime || 0,
        });
        setApiHealth({ status: 'healthy' });
      } else {
        setSystemHealth({ status: 'unhealthy', uptime: 0 });
        setApiHealth({ status: 'unhealthy' });
      }

      // Database Connection
      if (readinessRes?.success && readinessRes?.data) {
        setDbConnection({
          status: readinessRes.data.database === 'ready' ? 'connected' : 'disconnected',
          latencyMs: readinessRes.data.latency || 0,
        });
      } else {
        setDbConnection({ status: 'disconnected', latencyMs: 0 });
      }

      // Database Initialization
      if (schemaRes?.success && schemaRes?.data) {
        setDbInitialized({
          status: schemaRes.data.initialized ? 'initialized' : 'not_initialized',
          tableCount: schemaRes.data.tableCount || 0,
        });
      } else {
        setDbInitialized({ status: 'unknown', tableCount: 0 });
      }

      // Database Stats
      if (statsRes?.success && statsRes?.data) {
        setDbStats(statsRes.data);
      }

      if (showProgress) setRefreshProgress(100);
    } catch (err) {
      Logger.error('AdminOverview', 'Failed to load database stats', { error: err.message });
    } finally {
      setDbStatsLoading(false);
      if (showProgress) {
        setTimeout(() => {
          setIsRefreshing(false);
          setRefreshProgress(0);
        }, 500);
      }
    }
  }, []);

  useEffect(() => { loadDatabaseStats(false); }, [loadDatabaseStats]);

  const modules = [
    { id: 'platform_admin', name: 'Platform Admin', icon: LayoutDashboard },
    { id: 'shiftroaster', name: 'Shift Roster', icon: Calendar },
  ];

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'connected' || status === 'initialized') return 'text-emerald-600';
    if (status === 'checking') return 'text-amber-600';
    return 'text-rose-600';
  };

  const getStatusBg = (status) => {
    if (status === 'healthy' || status === 'connected' || status === 'initialized') return 'bg-emerald-50';
    if (status === 'checking') return 'bg-amber-50';
    return 'bg-rose-50';
  };

  const filteredActivity = logStats.last50.filter(log =>
    log.message?.toLowerCase().includes(activitySearch.toLowerCase()) ||
    log.source?.toLowerCase().includes(activitySearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={txt.title}
        subtitle={txt.subtitle}
        icon={LayoutDashboard}
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadDatabaseStats(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        }
      />

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={20} className={`${getStatusColor(systemHealth.status)}`} />}
          label={txt.tiles.systemHealth.label}
          value={systemHealth.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
          gradient="from-emerald-50 to-teal-50"
          detail={`Uptime: ${Math.floor(systemHealth.uptime / 3600)}h`}
          glow={systemHealth.status === 'healthy' ? 'shadow-emerald-200/50' : ''}
          borderGradient="from-emerald-400 to-teal-400"
        />
        <StatCard
          icon={<Database size={20} className={`${getStatusColor(dbConnection.status)}`} />}
          label={txt.tiles.dbConnection.label}
          value={dbConnection.status === 'connected' ? 'Connected' : 'Disconnected'}
          gradient="from-blue-50 to-cyan-50"
          detail={`Latency: ${dbConnection.latencyMs}ms`}
          glow={dbConnection.status === 'connected' ? 'shadow-blue-200/50' : ''}
          borderGradient="from-blue-400 to-cyan-400"
        />
        <StatCard
          icon={<Layers size={20} className={`${getStatusColor(dbInitialized.status)}`} />}
          label={txt.tiles.dbInitialized.label}
          value={dbInitialized.status === 'initialized' ? 'Initialized' : 'Not Initialized'}
          gradient="from-purple-50 to-pink-50"
          detail={`Tables: ${dbInitialized.tableCount}`}
          glow={dbInitialized.status === 'initialized' ? 'shadow-purple-200/50' : ''}
          borderGradient="from-purple-400 to-pink-400"
        />
        <StatCard
          icon={<Zap size={20} className={`${getStatusColor(apiHealth.status)}`} />}
          label={txt.tiles.apiHealth.label}
          value={apiHealth.status === 'healthy' ? 'Operational' : 'Down'}
          gradient="from-amber-50 to-orange-50"
          glow={apiHealth.status === 'healthy' ? 'shadow-amber-200/50' : ''}
          borderGradient="from-amber-400 to-orange-400"
        />
      </div>

      {/* Database Stats */}
      <GlowCard>
        <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
          <BarChart3 size={15} className="text-brand-500" />
          {txt.databaseObjects.title}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <MiniStat label={txt.databaseObjects.fields.totalUsers} value={dbStats.userCount} />
            <MiniStat label={txt.databaseObjects.fields.totalLogEntries} value={dbStats.logCount} />
          </div>
          <div className="space-y-2">
            <MiniStat label="Configs" value={dbStats.configCount} />
            <MiniStat label={txt.databaseObjects.fields.tables} value={dbStats.tableCount} />
          </div>
          <div className="space-y-2">
            <MiniStat label="Total Size" value={dbStats.totalSize || '—'} />
            <MiniStat label="Last Backup" value={dbStats.lastBackup || '—'} />
          </div>
          <div className="space-y-2">
            <MiniStat label="Backup Status" value={dbStats.backupStatus || '—'} />
            <MiniStat label="Replication Lag" value={dbStats.replicationLag || '—'} />
          </div>
        </div>
      </GlowCard>

      {/* Modules */}
      <GlowCard>
        <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
          <Package size={15} className="text-brand-500" />
          Modules
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => onNavigate?.('modules')}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <mod.icon size={20} className="text-brand-600" />
              <span className="text-xs font-semibold text-surface-700 text-center">{mod.name}</span>
            </button>
          ))}
        </div>
      </GlowCard>

      {/* Recent Activity */}
      <GlowCard>
        <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock size={15} className="text-brand-500" />
            {txt.recentActivity.title} ({filteredActivity.length} {txt.recentActivity.entriesLabel})
          </span>
          <div className="relative w-48">
            <input
              type="text"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              placeholder={txt.recentActivity.searchPlaceholder}
              className="w-full pl-3 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
            />
          </div>
        </h3>
        {filteredActivity.length === 0 ? (
          <p className="text-xs text-surface-400 italic py-4 text-center">{txt.recentActivity.emptyMessage}</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filteredActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 py-1.5 border-b border-surface-50 last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${log.level === 'error' ? 'bg-rose-500' : log.level === 'warn' ? 'bg-amber-500' : log.level === 'info' ? 'bg-blue-500' : 'bg-surface-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-700 truncate">{log.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-surface-400">{log.source}</span>
                    <span className="text-[10px] text-surface-300">•</span>
                    <span className="text-[10px] text-surface-400">{log.user}</span>
                    <span className="text-[10px] text-surface-300">•</span>
                    <span className="text-[10px] text-surface-300">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${log.result === 'success' ? 'bg-emerald-50 text-emerald-600' : log.result === 'failure' ? 'bg-rose-50 text-rose-600' : 'bg-surface-50 text-surface-400'}`}>
                  {log.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlowCard>

      {/* Gradient Separator */}
      <div className="py-6">
        <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
      </div>

      {/* Platform Information */}
      <GlowCard>
        <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
          <Layers size={15} className="text-brand-500" />
          {txt.platformInfo.title}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <MiniStat label={txt.platformInfo.fields.platform} value={appConfig.appName || 'PulseOps'} />
            <MiniStat label={txt.platformInfo.fields.version} value={appConfig.appVersion || '1.0.0'} mono />
            <MiniStat label={txt.platformInfo.fields.environment} value={txt.platformInfo.values.environment} />
          </div>
          <div className="space-y-2">
            <MiniStat label={txt.platformInfo.fields.framework} value={txt.platformInfo.values.framework} />
            <MiniStat label={txt.platformInfo.fields.uiLibrary} value={txt.platformInfo.values.uiLibrary} />
            <MiniStat label={txt.platformInfo.fields.backend} value={txt.platformInfo.values.backend} />
          </div>
          <div className="space-y-2">
            <MiniStat label={txt.platformInfo.fields.totalModules} value={String(modules.length)} />
            <MiniStat label={txt.platformInfo.fields.database} value={txt.platformInfo.values.database} />
            <MiniStat label="API URL" value={ApiClient.getBaseUrl() || '—'} mono />
          </div>
          <div className="space-y-2">
            <MiniStat label={txt.platformInfo.fields.loggedInAs} value={user?.email || '—'} mono />
            <MiniStat label={txt.platformInfo.fields.role} value={user?.role?.replace('_', ' ') || '—'} />
            <a href={`${ApiClient.getBaseUrl()?.replace('/api', '') || ''}/api/health`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors">
              <ExternalLink size={11} /> API Health
            </a>
          </div>
        </div>
      </GlowCard>

      <ProgressModal isOpen={isRefreshing} title="Loading..." message="Checking database connection and state..." progress={refreshProgress} />
    </div>
  );
}
