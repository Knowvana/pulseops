import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScrollText, Search, Filter, Trash2, RefreshCw, X, Globe,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, GripVertical, Clock
} from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import PageHeader from '@shared/components/PageHeader';
import Logger from '@shared/services/logger';
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
  { id: 'component', label: txt.columns.component, width: 180 },
  { id: 'user',      label: txt.columns.user,      width: 120 },
  { id: 'message',   label: txt.columns.message,   width: 0 },
  { id: 'result',    label: txt.columns.result,     width: 75 },
];

const API_COLUMNS = [
  { id: 'method',    label: txt.columns.method,       width: 75 },
  { id: 'url',       label: txt.columns.apiUrl,       width: 0 },
  { id: 'status',    label: txt.columns.status,       width: 70 },
  { id: 'respTime',  label: txt.columns.responseTime, width: 95 },
  { id: 'reqBody',   label: txt.columns.requestBody,  width: 120 },
  { id: 'respBody',  label: txt.columns.responseBody, width: 120 },
  { id: 'timestamp', label: txt.columns.timestamp,    width: 95 },
  { id: 'result',    label: txt.columns.result,       width: 65 },
];

function getSortValue(log, colId, tab) {
  if (tab === 'system') {
    switch (colId) {
      case 'level': return log.level || '';
      case 'time': return log.timestamp || '';
      case 'component': return log.source || '';
      case 'user': return log.user || '';
      case 'message': return log.message || '';
      case 'result': return log.result || '';
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
      default: return '';
    }
  }
}

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  const syncFromMemory = useCallback(() => {
    setLogs([...Logger.getSystemLogs()]);
    setApiLogs([...Logger.getApiLogs()]);
  }, []);

  useEffect(() => {
    syncFromMemory();
    const unsub = Logger.subscribe(syncFromMemory);
    return unsub;
  }, [syncFromMemory]);

  const filteredLogs = useMemo(() => {
    const source = activeTab === 'system' ? logs : apiLogs;
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
  }, [logs, apiLogs, activeTab, levelFilter, searchText, sortConfig]);

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
        return <span className="font-mono text-surface-400 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>;
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
        const ok = log.success;
        return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{log.statusCode}</span>;
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
      case 'result':
        return log.success
          ? <CheckCircle2 size={15} className="text-emerald-500" />
          : <XCircle size={15} className="text-rose-500" />;
      default: return '—';
    }
  };

  const renderDetailPanel = () => {
    if (!selectedLog) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-surface-300 py-12">
          <ScrollText size={28} className="mb-2" />
          <p className="text-xs">{txt.detail.noSelection}</p>
        </div>
      );
    }

    const log = selectedLog;
    const isApi = activeTab === 'api';
    const fields = isApi
      ? [
          { label: txt.detail.fields.method, value: log.method },
          { label: txt.detail.fields.url, value: log.url, mono: true },
          { label: txt.detail.fields.statusCode, value: log.statusCode },
          { label: txt.detail.fields.responseTime, value: `${log.durationMs}ms` },
          { label: txt.detail.fields.timestamp, value: log.timestamp ? new Date(log.timestamp).toLocaleString() : '—' },
          { label: txt.detail.fields.user, value: log.user || '—' },
        ]
      : [
          { label: txt.detail.fields.level, value: log.level },
          { label: txt.detail.fields.timestamp, value: log.timestamp ? new Date(log.timestamp).toLocaleString() : '—' },
          { label: txt.detail.fields.source, value: log.source },
          { label: txt.detail.fields.user, value: log.user || '—' },
          { label: txt.detail.fields.message, value: log.message },
          { label: txt.detail.fields.result, value: log.result || '—' },
        ];

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-surface-700">{txt.detail.title}</h4>
          <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-surface-400 hover:text-surface-600">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.label} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-surface-400 uppercase w-24 flex-shrink-0 pt-0.5">{f.label}</span>
              <span className={`text-xs text-surface-700 break-all ${f.mono ? 'font-mono' : ''}`}>{f.value}</span>
            </div>
          ))}
        </div>
        {isApi && log.requestPayload && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.requestBody}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[200px]">
              {JSON.stringify(log.requestPayload, null, 2)}
            </pre>
          </div>
        )}
        {isApi && log.responsePayload && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.responseBody}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[200px]">
              {JSON.stringify(log.responsePayload, null, 2)}
            </pre>
          </div>
        )}
        {!isApi && log.data && (
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase mb-1">{txt.detail.fields.data}</p>
            <pre className="text-[10px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto max-h-[200px]">
              {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <PageHeader title={txt.pageTitle} subtitle={`${filteredLogs.length} entries displayed`} icon={ScrollText} />

      {/* Tab Switcher + Toolbar */}
      <Card variant="flat" className="p-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 mr-2">
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

          {activeTab === 'system' && (
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

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={handleClear} className="p-2 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title={txt.toolbar.clearTooltip}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table + Detail Panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 overflow-y-auto border border-surface-200 rounded-lg bg-white">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-300">
              <ScrollText size={32} className="mb-3" />
              <p className="text-sm font-medium">{activeTab === 'system' ? txt.empty.system : txt.empty.api}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50 z-10">
                <tr className="border-b border-surface-200">
                  {colDefs.map((col) => {
                    const isSorted = sortConfig.key === col.id;
                    return (
                      <th
                        key={col.id}
                        onClick={() => handleSort(col.id)}
                        className="text-left px-3 py-2.5 font-semibold text-surface-500 select-none cursor-pointer group"
                        style={col.width > 0 ? { width: col.width } : {}}
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate">{col.label}</span>
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
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                      className={`border-b border-surface-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50'}`}
                    >
                      {colDefs.map((col) => (
                        <td key={col.id} className={`px-3 py-2 ${col.id === 'message' || col.id === 'url' ? 'whitespace-normal break-words max-w-[300px]' : 'overflow-hidden text-ellipsis whitespace-nowrap'}`}>
                          {activeTab === 'system' ? renderSystemCell(log, col.id) : renderApiCell(log, col.id)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Detail Panel */}
        {selectedLog && (
          <div className="w-[340px] flex-shrink-0 border border-surface-200 rounded-lg bg-white overflow-y-auto">
            {renderDetailPanel()}
          </div>
        )}
      </div>
    </div>
  );
}
