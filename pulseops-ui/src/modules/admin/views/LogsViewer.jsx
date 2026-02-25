import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScrollText, Search, Filter, Trash2, RefreshCw, X, Globe, Database,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, GripVertical, Clock, ChevronLeft, ChevronRight
} from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import PageHeader from '@shared/components/PageHeader';
import Logger from '@shared/services/logger';
import ApiClient from '@shared/services/apiClient';
import { sanitizeData, formatSanitizedJson } from '@shared/utils/logSanitizer';
import uiText from '@shared/config/uiElementsText.json';

const txt = uiText.platformAdmin.logs;

const LEVEL_CONFIG = {
  debug: { color: 'text-surface-400', bg: 'bg-surface-100', label: 'DEBUG' },
  info:  { color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'INFO' },
  warn:  { color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'WARN' },
  error: { color: 'text-rose-600',    bg: 'bg-rose-50',     label: 'ERROR' },
};

const RESULT_CONFIG = {
  success: { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failure: { color: 'text-rose-600',    bg: 'bg-rose-50' },
  warning: { color: 'text-amber-600',   bg: 'bg-amber-50' },
  pending: { color: 'text-surface-400', bg: 'bg-surface-50' },
};

const SYSTEM_COLUMNS = [
  { id: 'level',     label: txt.columns.level,     width: 70 },
  { id: 'time',      label: txt.columns.time,      width: 95 },
  { id: 'source',    label: txt.columns.source,    width: 100 },
  { id: 'event',     label: txt.columns.event,     width: 150 },
  { id: 'component', label: txt.columns.component, width: 120 },
  { id: 'user',      label: txt.columns.user,      width: 100 },
  { id: 'message',   label: txt.columns.message,   width: 0 },
  { id: 'result',    label: txt.columns.result,    width: 75 },
  { id: 'synced',    label: txt.columns.synced,    width: 60 },
];

const API_COLUMNS = [
  { id: 'method',    label: txt.columns.method,       width: 75 },
  { id: 'url',       label: txt.columns.apiUrl,       width: 0 },
  { id: 'status',    label: txt.columns.status,       width: 70 },
  { id: 'respTime',  label: txt.columns.responseTime, width: 95 },
  { id: 'timestamp', label: txt.columns.timestamp,    width: 95 },
  { id: 'result',    label: txt.columns.result,       width: 65 },
  { id: 'synced',    label: txt.columns.synced,       width: 60 },
];

// Database logs use same columns as API logs
const DB_LOGS_COLUMNS = API_COLUMNS;

function getSortValue(log, colId, tab) {
  if (tab === 'system') {
    switch (colId) {
      case 'level': return log.level || '';
      case 'time': return log.timestamp || '';
      case 'source': return log.source || '';
      case 'event': return log.event || '';
      case 'component': return log.source || '';
      case 'user': return log.user || '';
      case 'message': return log.message || '';
      case 'result': return log.result || '';
      case 'synced': return log.synced ? 1 : 0;
      default: return '';
    }
  } else {
    switch (colId) {
      case 'method': return log.method || '';
      case 'url': return log.url || '';
      case 'status': return log.statusCode || 0;
      case 'respTime': return log.durationMs || 0;
      case 'timestamp': return log.timestamp || '';
      case 'result': return log.success ? 1 : 0;
      case 'synced': return log.synced ? 1 : 0;
      default: return '';
    }
  }
}

const PAGE_SIZE = 500;

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [dbLogs, setDbLogs] = useState([]);
  const [isLoadingDbLogs, setIsLoadingDbLogs] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(null);

  const syncFromMemory = useCallback(() => {
    setLogs([...Logger.getSystemLogs()]);
    setApiLogs([...Logger.getApiLogs()]);
  }, []);

  const loadDatabaseLogs = useCallback(async () => {
    setIsLoadingDbLogs(true);
    try {
      const response = await ApiClient.get('/logs/database?limit=500');
      if (response.success && response.data?.logs) {
        // Transform database logs to API log format
        const transformedLogs = response.data.logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          method: log.httpMethod || 'GET',
          url: log.apiUrl || log.event || '',
          path: log.apiUrl || log.event || '',
          statusCode: log.responseCode || 200,
          durationMs: log.durationMs || 0,
          success: log.result === 'success',
          requestPayload: log.requestBody || null,
          responsePayload: log.responseBody || null,
          user: log.userEmail || 'system',
          synced: true, // Database logs are already synced
        }));
        setDbLogs(transformedLogs);
      }
    } catch (err) {
      Logger.error('LogsViewer', 'Failed to load database logs', { error: err.message });
    } finally {
      setIsLoadingDbLogs(false);
    }
  }, []);

  useEffect(() => {
    syncFromMemory();
    const unsub = Logger.subscribe(syncFromMemory);
    return unsub;
  }, [syncFromMemory]);

  useEffect(() => {
    if (activeTab === 'database') {
      loadDatabaseLogs();
    }
  }, [activeTab, loadDatabaseLogs]);

  const filteredLogs = useMemo(() => {
    const source = activeTab === 'system' ? logs : activeTab === 'api' ? apiLogs : dbLogs;
    let filtered = source.filter((log) => {
      if (activeTab === 'system' && levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const searchable = activeTab === 'system'
          ? `${log.message} ${log.source} ${log.user || ''} ${log.result || ''}`
          : `${log.method} ${log.url} ${log.user || ''} ${log.statusCode}`;
        return searchable.toLowerCase().includes(q);
      }
      return true;
    });
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const valA = getSortValue(a, sortConfig.key, activeTab);
        const valB = getSortValue(b, sortConfig.key, activeTab);
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [logs, apiLogs, dbLogs, activeTab, levelFilter, searchText, sortConfig]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredLogs.slice(start, end);
  }, [filteredLogs, currentPage]);

  const handleClear = useCallback(() => {
    if (activeTab === 'system') Logger.clearSystemLogs();
    else Logger.clearApiLogs();
    setSelectedLog(null);
  }, [activeTab]);

  const handleSort = useCallback((colId) => {
    setSortConfig(prev => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const colDefs = activeTab === 'system' ? SYSTEM_COLUMNS : API_COLUMNS;

  const renderSystemCell = (log, colId) => {
    switch (colId) {
      case 'level': {
        const lc = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
        return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${lc.bg} ${lc.color}`}>{lc.label}</span>;
      }
      case 'time':
        return <span className="font-mono text-surface-400 text-xs whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) + ' ' + new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>;
      case 'source': {
        const sourceColors = {
          'UI': 'bg-blue-50 text-blue-600',
          'API': 'bg-purple-50 text-purple-600',
          'Database': 'bg-teal-50 text-teal-600',
          'System': 'bg-surface-100 text-surface-600',
        };
        const colorClass = sourceColors[log.source] || 'bg-surface-50 text-surface-500';
        return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{log.source || '—'}</span>;
      }
      case 'event':
        return <span className="text-surface-600 text-xs font-medium">{log.event || '—'}</span>;
      case 'component':
        return <span className="inline-block px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 font-semibold text-xs">{log.source || '—'}</span>;
      case 'user':
        return <span className="text-surface-500 text-xs">{log.user || '—'}</span>;
      case 'message':
        return <span className="text-surface-700">{log.message}</span>;
      case 'result': {
        const rc = RESULT_CONFIG[log.result] || RESULT_CONFIG.pending;
        return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${rc.bg} ${rc.color}`}>{log.result || '—'}</span>;
      }
      case 'synced':
        return log.synced
          ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Yes</span>
          : <span className="text-xs font-bold text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded">No</span>;
      default: return '—';
    }
  };

  const renderApiCell = (log, colId) => {
    switch (colId) {
      case 'method':
        return (
          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
            log.method === 'GET' ? 'bg-blue-50 text-blue-600' :
            log.method === 'POST' ? 'bg-emerald-50 text-emerald-600' :
            log.method === 'PUT' ? 'bg-amber-50 text-amber-600' :
            log.method === 'DELETE' ? 'bg-rose-50 text-rose-600' : 'bg-surface-100 text-surface-500'
          }`}>{log.method}</span>
        );
      case 'url':
        return <span className="font-mono text-surface-600 text-xs">{log.url}</span>;
      case 'status': {
        const code = log.statusCode;
        let bgColor = 'bg-surface-50 text-surface-600';
        if (code >= 500) bgColor = 'bg-rose-50 text-rose-600';
        else if (code >= 400) bgColor = 'bg-amber-50 text-amber-600';
        else if (code >= 300) bgColor = 'bg-blue-50 text-blue-600';
        else if (code >= 200) bgColor = 'bg-emerald-50 text-emerald-600';
        return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${bgColor}`}>{code}</span>;
      }
      case 'respTime':
        return <span className="font-mono text-surface-500 text-xs">{log.durationMs}ms</span>;
      case 'reqBody':
        return log.requestPayload ? (
          <span className="text-[10px] text-surface-500 font-mono truncate max-w-[100px]" title={JSON.stringify(log.requestPayload)}>
            {JSON.stringify(log.requestPayload).substring(0, 30)}...
          </span>
        ) : <span className="text-surface-400 text-xs">—</span>;
      case 'respBody':
        return log.responsePayload ? (
          <span className="text-[10px] text-surface-500 font-mono truncate max-w-[100px]" title={JSON.stringify(log.responsePayload)}>
            {JSON.stringify(log.responsePayload).substring(0, 30)}...
          </span>
        ) : <span className="text-surface-400 text-xs">—</span>;
      case 'timestamp':
        return <span className="font-mono text-surface-400 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>;
      case 'synced':
        return log.synced
          ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Yes</span>
          : <span className="text-xs font-bold text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded">No</span>;
      case 'result':
        return log.success
          ? <CheckCircle2 size={15} className="text-emerald-500" />
          : <XCircle size={15} className="text-rose-500" />;
      default: return '—';
    }
  };

  const renderDetailPanel = () => {
    if (!selectedLog) return null;
    
    const isApi = activeTab === 'api' || activeTab === 'database';

    const getStatusCodeColor = (code) => {
      if (code >= 500) return 'text-rose-600 bg-rose-50';
      if (code >= 400) return 'text-amber-600 bg-amber-50';
      if (code >= 300) return 'text-blue-600 bg-blue-50';
      if (code >= 200) return 'text-emerald-600 bg-emerald-50';
      return 'text-surface-600 bg-surface-50';
    };

    const fields = isApi
      ? [
          { label: txt.detail.fields.method, value: selectedLog.method },
          { label: txt.detail.fields.url, value: selectedLog.url, mono: true },
          { label: txt.detail.fields.statusCode, value: selectedLog.statusCode, statusCode: true },
          { label: txt.detail.fields.responseTime, value: `${selectedLog.durationMs}ms` },
          { label: txt.detail.fields.timestamp, value: selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—' },
          { label: txt.detail.fields.user, value: selectedLog.user || '—' },
        ]
      : [
          { label: txt.detail.fields.level, value: selectedLog.level },
          { label: txt.detail.fields.timestamp, value: selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—' },
          { label: txt.detail.fields.source, value: selectedLog.source || '—' },
          { label: txt.detail.fields.event, value: selectedLog.event || '—' },
          { label: txt.detail.fields.user, value: selectedLog.user || '—' },
          { label: txt.detail.fields.message, value: selectedLog.message },
          { label: txt.detail.fields.result, value: selectedLog.result || '—' },
        ];

    return (
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-white z-10">
          <h4 className="text-sm font-bold text-surface-700">{txt.detail.title}</h4>
          <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-surface-400 hover:text-surface-600">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.label} className="flex items-start gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-surface-400 uppercase w-24 flex-shrink-0 pt-0.5">{f.label}</span>
              {f.statusCode ? (
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatusCodeColor(f.value)}`}>{f.value}</span>
              ) : (
                <span className={`text-xs text-surface-700 break-all flex-1 ${f.mono ? 'font-mono' : ''}`}>{f.value}</span>
              )}
            </div>
          ))}
        </div>
        {isApi && selectedLog.requestPayload && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.requestBody}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
              {formatSanitizedJson(selectedLog.requestPayload)}
            </pre>
          </div>
        )}
        {isApi && selectedLog.responsePayload && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.responseBody}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
              {formatSanitizedJson(selectedLog.responsePayload)}
            </pre>
          </div>
        )}
        {!isApi && selectedLog.data && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.data}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
              {typeof selectedLog.data === 'string' ? selectedLog.data : formatSanitizedJson(selectedLog.data)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader title={txt.pageTitle} subtitle={`${filteredLogs.length} entries displayed`} icon={ScrollText} />
      </div>

      {/* Tab Switcher + Toolbar + Pagination */}
      <Card variant="flat" className="p-3 mb-3 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Current Session Browser Logs */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-surface-400 px-1">{txt.groups.currentSession}</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'system', label: txt.tabs.systemLogs, icon: ScrollText },
                  { id: 'api', label: txt.tabs.apiLogs, icon: Globe },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSelectedLog(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === tab.id
                          ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                          : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                      }`}
                    >
                      <TabIcon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical Separator */}
            <div className="h-12 w-px bg-gradient-to-b from-transparent via-surface-300 to-transparent" />

            {/* Database Logs */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-surface-400 px-1">{txt.groups.database}</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'database', label: txt.tabs.databaseLogs, icon: Database },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSelectedLog(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === tab.id
                          ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                          : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                      }`}
                    >
                      <TabIcon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={activeTab === 'system' ? txt.toolbar.searchSystem : txt.toolbar.searchApi}
              className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                <X size={14} />
              </button>
            )}
          </div>

          {(activeTab === 'system') && (
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-surface-400" />
              {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                    levelFilter === level
                      ? level === 'all' ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                        : `${LEVEL_CONFIG[level]?.bg} ${LEVEL_CONFIG[level]?.color} ring-1 ring-current/20`
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div className="flex items-center gap-2 border-l border-surface-200 pl-3">
                <span className="text-xs text-surface-500">
                  Page {currentPage} of {totalPages} ({filteredLogs.length} total)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded text-surface-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded text-surface-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
            <button onClick={handleClear} className="p-2 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title={txt.toolbar.clearTooltip}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table + Detail Panel */}
      <div className="flex-1 flex gap-3 min-h-0">
          <div className="flex-1 min-w-0 overflow-hidden border border-surface-200 rounded-lg bg-white flex flex-col">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-surface-300 flex-1">
                <ScrollText size={32} className="mb-3" />
                <p className="text-sm font-medium">
                  {activeTab === 'database' 
                    ? (isLoadingDbLogs ? 'Loading database logs...' : 'No logs found in database') 
                    : activeTab === 'system' 
                      ? txt.empty.system 
                      : txt.empty.api}
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-surface-50 z-10">
                      <tr className="border-b border-surface-200">
                        {colDefs.map((col) => {
                          const isSorted = sortConfig.key === col.id;
                          return (
                            <th
                              key={col.id}
                              onClick={() => handleSort(col.id)}
                              className="text-left px-3 py-2.5 font-semibold text-surface-500 select-none cursor-pointer group hover:bg-surface-100 transition-colors whitespace-nowrap"
                              style={col.width > 0 ? { minWidth: col.width } : { minWidth: '100px' }}
                            >
                              <div className="flex items-center gap-1">
                                <span>{col.label}</span>
                                {isSorted && (
                                  sortConfig.direction === 'asc'
                                    ? <ArrowUp size={11} className="text-brand-500 flex-shrink-0" />
                                    : <ArrowDown size={11} className="text-brand-500 flex-shrink-0" />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => {
                        const isSelected = selectedLog?.id === log.id;
                        return (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(isSelected ? null : log)}
                            className={`border-b border-surface-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50'}`}
                          >
                            {colDefs.map((col) => (
                              <td key={col.id} className="px-3 py-2 text-xs break-words">
                                {activeTab === 'system' ? renderSystemCell(log, col.id) : renderApiCell(log, col.id)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Right Detail Panel */}
          {selectedLog && (
            <div className="w-[420px] flex-shrink-0 border border-surface-200 rounded-lg bg-white overflow-hidden flex flex-col">
              {renderDetailPanel()}
            </div>
          )}
      </div>
    </div>
  );
}
