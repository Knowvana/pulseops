import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ScrollText, Activity, Bug, Trash2,
  AlertCircle, AlertTriangle, Info, Code2,
  CheckCircle2, XCircle, Clock
} from 'lucide-react';
import Button from '@shared/components/Button';
import Card from '@shared/components/Card';
import uiText from '@shared/config/uiElementsText.json';

const txt = uiText.rightPanel;

const TABS = [
  { id: 'logs', label: txt.tabs.systemLogs, icon: ScrollText },
  { id: 'api',  label: txt.tabs.apiCalls,   icon: Activity },
  { id: 'report', label: txt.tabs.reportIssue, icon: Bug },
];

const LOG_LEVEL_STYLES = {
  debug: { color: 'text-surface-400', bg: 'bg-surface-50',  icon: Code2 },
  info:  { color: 'text-brand-600',   bg: 'bg-brand-50',    icon: Info },
  warn:  { color: 'text-amber-600',   bg: 'bg-amber-50',    icon: AlertTriangle },
  error: { color: 'text-rose-600',    bg: 'bg-rose-50',     icon: AlertCircle },
};

export default function RightPanel({ isOpen, onClose, logger }) {
  const [activeTab, setActiveTab] = useState('logs');
  const [systemLogs, setSystemLogs] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');

  const refreshLogs = useCallback(() => {
    if (logger) {
      setSystemLogs([...logger.getSystemLogs()]);
      setApiLogs([...logger.getApiLogs()]);
    }
  }, [logger]);

  useEffect(() => {
    refreshLogs();
    if (logger) {
      const unsub = logger.subscribe(refreshLogs);
      return unsub;
    }
  }, [refreshLogs, logger]);

  const filteredLogs = logFilter === 'all'
    ? systemLogs
    : systemLogs.filter((l) => l.level === logFilter);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const renderLogsTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-surface-100 bg-surface-50/50">
        {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
          <button
            key={level}
            onClick={() => setLogFilter(level)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              logFilter === level ? 'bg-brand-100 text-brand-700' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100'
            }`}
          >
            {level}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => logger?.clearSystemLogs()} className="p-1 rounded text-surface-300 hover:text-rose-500 hover:bg-rose-50 transition-colors" title={txt.logs.clearTooltip}>
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-surface-300">
            <ScrollText size={28} className="mb-2" />
            <p className="text-xs">{txt.logs.emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-50">
            {filteredLogs.map((log) => {
              const style = LOG_LEVEL_STYLES[log.level] || LOG_LEVEL_STYLES.info;
              const LevelIcon = style.icon;
              return (
                <div key={log.id} className="px-4 py-2.5 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 p-0.5 rounded ${style.bg}`}>
                      <LevelIcon size={11} className={style.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase ${style.color}`}>{log.level}</span>
                        <span className="text-[10px] font-medium text-surface-500">{log.source}</span>
                        <span className="text-[10px] text-surface-300 ml-auto flex-shrink-0">{formatTime(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-surface-600 mt-0.5 break-words">{log.message}</p>
                      {log.data && (
                        <pre className="text-[10px] text-surface-400 mt-1 bg-surface-50 rounded px-2 py-1 overflow-x-auto">
                          {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderApiTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-100 bg-surface-50/50">
        <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
          {apiLogs.length} {txt.api.callsLabel}
        </span>
        <button onClick={() => logger?.clearApiLogs()} className="p-1 rounded text-surface-300 hover:text-rose-500 hover:bg-rose-50 transition-colors" title={txt.api.clearTooltip}>
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {apiLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-surface-300">
            <Activity size={28} className="mb-2" />
            <p className="text-xs">{txt.api.emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-50">
            {apiLogs.map((api) => (
              <div key={api.id} className="px-4 py-2.5 hover:bg-surface-50/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    api.method === 'GET' ? 'bg-brand-50 text-brand-600' :
                    api.method === 'POST' ? 'bg-emerald-50 text-emerald-600' :
                    api.method === 'PUT' ? 'bg-amber-50 text-amber-600' :
                    api.method === 'DELETE' ? 'bg-rose-50 text-rose-600' : ''
                  }`}>
                    {api.method}
                  </span>
                  <span className="text-xs text-surface-600 truncate flex-1 font-mono">{api.url || api.path}</span>
                  {api.success
                    ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                    : <XCircle size={12} className="text-rose-500 flex-shrink-0" />
                  }
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-bold ${api.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {api.statusCode}
                  </span>
                  <span className="text-[10px] text-surface-400 flex items-center gap-0.5">
                    <Clock size={9} /> {api.durationMs}ms
                  </span>
                  <span className="text-[10px] text-surface-300 ml-auto">{formatTime(api.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderReportTab = () => (
    <div className="p-4 space-y-4">
      <Card variant="flat" className="p-4">
        <h4 className="text-sm font-bold text-surface-700 mb-2 flex items-center gap-2">
          <Bug size={15} className="text-rose-500" />
          {txt.report.title}
        </h4>
        <p className="text-xs text-surface-400 mb-4">{txt.report.description}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.report.issueTitleLabel}</label>
            <input type="text" placeholder={txt.report.issueTitlePlaceholder} className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.report.categoryLabel}</label>
            <select className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all">
              {txt.report.categories.map((cat) => (<option key={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.report.descriptionLabel}</label>
            <textarea rows={4} placeholder={txt.report.descriptionPlaceholder} className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all resize-none" />
          </div>
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <input type="checkbox" defaultChecked className="rounded border-surface-300" />
            <span>{txt.report.attachLogsLabel} ({Math.min(systemLogs.length, 20)} entries)</span>
          </div>
        </div>
        <Button variant="primary" size="sm" className="mt-4 w-full" icon={<Bug size={14} />}>
          {txt.report.submitButton}
        </Button>
      </Card>
      <p className="text-[10px] text-surface-300 text-center">{txt.report.footerNote}</p>
    </div>
  );

  return (
    <>
      {isOpen && (<div className="fixed inset-0 bg-black/10 z-[70] transition-opacity" onClick={onClose} />)}
      <div className={`
        fixed top-0 right-0 h-full w-[380px] bg-white border-l border-surface-200
        shadow-2xl shadow-surface-300/30 z-[80]
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-white">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  <TabIcon size={13} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'logs' && renderLogsTab()}
          {activeTab === 'api' && renderApiTab()}
          {activeTab === 'report' && renderReportTab()}
        </div>
      </div>
    </>
  );
}
