import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Users, Settings, Activity, Database, CheckCircle2, XCircle,
  ScrollText, HardDrive, RefreshCw, ExternalLink, Clock, BarChart3, Layers, Zap
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
  const [dbReachable, setDbReachable] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [dbStats, setDbStats] = useState({ userCount: 0, logCount: 0, configCount: 0, tableCount: 0 });
  const [connectionStatus, setConnectionStatus] = useState({ latencyMs: 0 });
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
      if (showProgress) setRefreshProgress(30);
      const withTimeout = (promise, ms = 5000) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
      ]);

      const [healthRes, statsRes] = await Promise.all([
        withTimeout(ApiClient.get('/health')).catch(() => ({ success: false })),
        withTimeout(ApiClient.get('/database/stats')).catch(() => ({ success: false })),
      ]);

      if (showProgress) setRefreshProgress(70);

      const isReachable = healthRes?.success !== false && healthRes?.status !== undefined;
      setDbReachable(isReachable);
      setConnectionStatus({ latencyMs: healthRes?.data?.latencyMs || 0 });

      if (statsRes?.success && statsRes?.data) {
        setDbStats(statsRes.data);
        setDbInitialized(statsRes.data.tableCount > 0 || statsRes.data.userCount > 0);
      }

      if (showProgress) setRefreshProgress(100);
      Logger.info('Platform Admin - Overview', 'Stats loaded', { dbReachable: isReachable });
    } catch (err) {
      Logger.error('Platform Admin - Overview', 'Failed to load stats', { error: err.message });
    } finally {
      setDbStatsLoading(false);
      if (showProgress) {
        setTimeout(() => { setIsRefreshing(false); setRefreshProgress(0); }, 300);
      }
    }
  }, []);

  useEffect(() => { loadDatabaseStats(true); }, [loadDatabaseStats]);

  const modules = appConfig.modules || [];
  const enabledModules = modules.filter(m => m.enabled !== false);
  const inactiveModules = modules.filter(m => m.enabled === false);

  const filteredActivity = activitySearch
    ? logStats.last50.filter(l => (l.message || '').toLowerCase().includes(activitySearch.toLowerCase()) || (l.source || '').toLowerCase().includes(activitySearch.toLowerCase()))
    : logStats.last50;

  return (
    <div className="space-y-0 animate-fade-in">
      <PageHeader
        title={txt.pageTitle}
        subtitle={`${txt.welcome.replace('{name}', user?.name || 'Administrator')} · ${user?.email || ''}`}
        icon={LayoutDashboard}
      />

      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard
          icon={<Zap size={20} className="text-emerald-500" />}
          label={txt.tiles.systemHealth.label}
          value={dbReachable ? txt.tiles.systemHealth.operational : (dbStatsLoading ? txt.tiles.systemHealth.checking : txt.tiles.systemHealth.degraded)}
          gradient={dbReachable ? 'from-emerald-50 to-teal-50' : 'from-amber-50 to-orange-50'}
          detail={dbReachable ? (dbInitialized ? txt.tiles.systemHealth.allServicesRunning : 'Database connected — initialization needed') : (dbStatsLoading ? txt.tiles.systemHealth.connectingToDb : txt.tiles.systemHealth.cannotReachDb)}
          glow={dbReachable ? 'shadow-emerald-100/60' : 'shadow-amber-100/60'}
          borderGradient={dbReachable ? 'from-emerald-300 to-teal-300' : 'from-amber-300 to-orange-300'}
        />
        <StatCard
          icon={<Activity size={20} className="text-indigo-500" />}
          label={txt.tiles.modules.label}
          value={`${enabledModules.length} / ${modules.length}`}
          gradient="from-indigo-50 to-blue-50"
          detail={`${enabledModules.length} enabled · ${inactiveModules.length} inactive`}
          glow="shadow-indigo-100/60"
          borderGradient="from-indigo-300 to-blue-300"
        />
        <StatCard
          icon={<Users size={20} className="text-blue-500" />}
          label={txt.tiles.users.label}
          value={dbStatsLoading ? '...' : String(dbStats.userCount || 0)}
          gradient="from-blue-50 to-indigo-50"
          detail={dbStats.userCount === 0 ? 'No users registered' : `${dbStats.userCount} total users`}
          glow="shadow-blue-100/60"
          borderGradient="from-blue-300 to-indigo-300"
          actionButton={
            <Button variant="primary" size="xs" onClick={() => onNavigate?.('users')}>
              {txt.tiles.users.manage}
            </Button>
          }
        />
        <StatCard
          icon={<ScrollText size={20} className="text-amber-500" />}
          label={txt.tiles.logs.label}
          value={dbStatsLoading ? '...' : String(dbStats.logCount || logStats.total)}
          gradient="from-amber-50 to-orange-50"
          detail={`${logStats.total} in-memory · ${logStats.errors} errors`}
          glow="shadow-amber-100/60"
          borderGradient="from-amber-300 to-orange-300"
          actionButton={
            <Button variant="primary" size="xs" onClick={() => onNavigate?.('logs')}>
              {txt.tiles.logs.viewAll}
            </Button>
          }
        />
      </div>

      {/* Gradient Separator */}
      <div className="py-6">
        <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
      </div>

      {/* Database Summary: 4-Column */}
      <GlowCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
            <HardDrive size={15} className="text-brand-500" />
            {txt.databaseObjects.title}
          </h3>
          <div className="flex items-center gap-2">
            {dbStatsLoading && <RefreshCw size={12} className="text-surface-300 animate-spin" />}
            {dbReachable ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{txt.databaseObjects.connected}</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{txt.databaseObjects.checking}</span>
            )}
            <Button variant="primary" size="xxs" icon={<RefreshCw size={11} />} onClick={() => loadDatabaseStats(true)} disabled={isRefreshing}>
              {txt.databaseObjects.refresh}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          <div className="p-4 border-r border-surface-100">
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Database size={11} className="text-brand-500" /> {txt.databaseObjects.sections.coreObjects}
            </p>
            <div className="space-y-2">
              <MiniStat label={txt.databaseObjects.fields.databaseType} value="PostgreSQL" mono />
              <MiniStat label={txt.databaseObjects.fields.provider} value="Sequelize ORM" mono />
              <MiniStat label={txt.databaseObjects.fields.tables} value={dbStatsLoading ? '...' : String(dbStats.tableCount || 0)} />
            </div>
          </div>
          <div className="p-4 border-r border-surface-100">
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users size={11} className="text-blue-500" /> {txt.databaseObjects.sections.users}
            </p>
            <div className="space-y-2">
              <MiniStat label={txt.databaseObjects.fields.totalUsers} value={dbStatsLoading ? '...' : String(dbStats.userCount || 0)} />
              <MiniStat label={txt.databaseObjects.fields.activeUsers} value={dbStatsLoading ? '...' : String(dbStats.activeUserCount || 0)} valueColor="text-emerald-600" />
              <MiniStat label={txt.databaseObjects.fields.inactiveUsers} value={dbStatsLoading ? '...' : String(dbStats.inactiveUserCount || 0)} />
            </div>
          </div>
          <div className="p-4 border-r border-surface-100">
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ScrollText size={11} className="text-amber-500" /> {txt.databaseObjects.sections.logs}
            </p>
            <div className="space-y-2">
              <MiniStat label={txt.databaseObjects.fields.totalLogEntries} value={dbStatsLoading ? '...' : String(dbStats.logCount || 0)} />
              <MiniStat label={txt.databaseObjects.fields.errors} value={String(logStats.errors)} valueColor={logStats.errors > 0 ? 'text-rose-600' : undefined} />
              <MiniStat label={txt.databaseObjects.fields.warnings} value={String(logStats.warnings)} valueColor={logStats.warnings > 0 ? 'text-amber-600' : undefined} />
              <MiniStat label={txt.databaseObjects.fields.inMemoryLogs} value={String(logStats.total)} />
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 size={11} className="text-emerald-500" /> {txt.databaseObjects.sections.apiStats}
            </p>
            <div className="space-y-2">
              <MiniStat label={txt.databaseObjects.fields.totalApiCalls} value={String(logStats.apiTotal)} />
              <MiniStat label={txt.databaseObjects.fields.successCount} value={String(Logger.getApiLogs().filter(l => l.success).length)} valueColor="text-emerald-600" />
              <MiniStat label={txt.databaseObjects.fields.failureCount} value={String(Logger.getApiLogs().filter(l => !l.success).length)} valueColor={Logger.getApiLogs().filter(l => !l.success).length > 0 ? 'text-rose-600' : undefined} />
              <MiniStat label={txt.databaseObjects.fields.avgResponseTime} value={`${Logger.getApiLogs().length > 0 ? Math.round(Logger.getApiLogs().reduce((s, l) => s + (l.durationMs || 0), 0) / Logger.getApiLogs().length) : 0}ms`} />
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Gradient Separator */}
      <div className="py-6">
        <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
      </div>

      {/* Recent Activity */}
      <GlowCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
            <Clock size={15} className="text-brand-500" />
            {txt.recentActivity.title}
            <span className="text-[10px] text-surface-400 font-normal">({filteredActivity.length} {txt.recentActivity.entriesLabel})</span>
          </h3>
          <div className="relative w-48">
            <input
              type="text"
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              placeholder={txt.recentActivity.searchPlaceholder}
              className="w-full pl-3 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
            />
          </div>
        </div>
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
            <MiniStat label={txt.platformInfo.fields.apiUrl} value={ApiClient.getBaseUrl() || '—'} mono />
          </div>
          <div className="space-y-2">
            <MiniStat label={txt.platformInfo.fields.loggedInAs} value={user?.email || '—'} mono />
            <MiniStat label={txt.platformInfo.fields.role} value={user?.role?.replace('_', ' ') || '—'} />
            <a href={`${ApiClient.getBaseUrl()?.replace('/api', '') || ''}/api/health`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors">
              <ExternalLink size={11} /> {txt.platformInfo.fields.apiHealth}
            </a>
          </div>
        </div>
      </GlowCard>

      <ProgressModal isOpen={isRefreshing} title="Loading..." message="Checking database connection and state..." progress={refreshProgress} />
    </div>
  );
}
