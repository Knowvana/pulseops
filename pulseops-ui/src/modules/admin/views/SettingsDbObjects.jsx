import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Info, Loader2, Table2, Users, FileText, Layers, Trash2, Download
} from 'lucide-react';
import { Card, Button, ProgressModal, ActionModal, ConfirmDialog, ApiClient, Logger } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import urls from '@shared/config/urls.json';

const txt = uiText.platformAdmin.settings.dbObjects;

export default function SettingsDbObjects() {
  const [dbConnected, setDbConnected] = useState(null);
  const [schemaStatus, setSchemaStatus] = useState({ initialized: false });
  const [defaultDataStatus, setDefaultDataStatus] = useState({ loaded: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);

  // Result modals
  const [resultModal, setResultModal] = useState({ open: false, title: '', variant: 'info', data: null });

  // More Info modals
  const [schemaInfoModal, setSchemaInfoModal] = useState({ open: false, data: null, loading: false });
  const [defaultDataInfoModal, setDefaultDataInfoModal] = useState({ open: false, data: null, loading: false });

  const checkStatus = useCallback(async () => {
    try {
      const result = await ApiClient.get(urls.databaseSchemaStatusEndpoint);
      if (result?.success && result?.data) {
        setDbConnected(result.data.connected !== false);
        setSchemaStatus({ initialized: result.data.initialized !== false });
        setDefaultDataStatus({ loaded: result.data.hasDefaultData !== false });
      } else {
        setDbConnected(false);
      }
    } catch (err) {
      setDbConnected(false);
      Logger.warn('Settings - DB Objects', 'Failed to check schema status', { error: err.message });
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // --- DB Not Connected Overlay ---
  if (dbConnected === false) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
          <p className="text-sm text-surface-400">{txt.description}</p>
        </div>
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl border border-amber-200 p-8 flex flex-col items-center text-center">
          <div className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl mb-4">
            <Database size={32} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-800 mb-2">{messages.info.dbNotSetupTitle}</h3>
          <p className="text-sm text-surface-500 max-w-md mb-4">{messages.info.dbNotSetupMessage}</p>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={checkStatus}>
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (dbConnected === null) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  // --- Initialize Schema ---
  const handleInitializeSchema = async () => {
    setIsLoading(true);
    setLoadProgress(10);
    setLoadMessage('Creating core database tables...');
    try {
      setLoadProgress(30);
      const result = await ApiClient.post(urls.databaseCreateSchemaEndpoint);
      setLoadProgress(80);
      if (result?.success) {
        setLoadProgress(100);
        setSchemaStatus({ initialized: true });
        Logger.info('Settings - DB Objects', messages.success.schemaCreated);
        setTimeout(() => {
          setIsLoading(false);
          setLoadProgress(0);
          setResultModal({
            open: true,
            title: 'Schema Initialized Successfully',
            variant: 'success',
            data: result.data,
          });
        }, 400);
        checkStatus();
        return;
      } else {
        throw new Error(result?.error?.message || messages.errors.schemaInitFailed);
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Schema Initialization Failed', variant: 'error', data: { message: err.message } });
      Logger.error('Settings - DB Objects', messages.errors.schemaInitFailed, { error: err.message });
    }
    setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
    checkStatus();
  };

  // --- Load Default Data ---
  const handleLoadDefaultData = async () => {
    setIsLoading(true);
    setLoadProgress(10);
    setLoadMessage('Loading default admin user and module registry...');
    try {
      setLoadProgress(30);
      const result = await ApiClient.post(urls.databaseLoadDefaultDataEndpoint);
      setLoadProgress(80);
      if (result?.success) {
        setLoadProgress(100);
        setDefaultDataStatus({ loaded: true });
        Logger.info('Settings - DB Objects', messages.success.defaultDataLoaded);
        setTimeout(() => {
          setIsLoading(false);
          setLoadProgress(0);
          setResultModal({
            open: true,
            title: 'Default Data Loaded Successfully',
            variant: 'success',
            data: result.data,
          });
        }, 400);
        checkStatus();
        return;
      } else {
        throw new Error(result?.error?.message || messages.errors.dbInitFailed);
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Default Data Load Failed', variant: 'error', data: { message: err.message } });
      Logger.error('Settings - DB Objects', messages.errors.dbInitFailed, { error: err.message });
    }
    setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
    checkStatus();
  };

  // --- Wipe Database ---
  const handleWipeDatabase = async () => {
    setShowWipeConfirm(false);
    setIsWiping(true);
    setWipeProgress(10);
    try {
      setWipeProgress(40);
      const result = await ApiClient.post(urls.databaseWipeEndpoint);
      setWipeProgress(90);
      if (result?.success) {
        setWipeProgress(100);
        Logger.info('Settings - DB Objects', messages.success.dbWiped);
        setTimeout(() => {
          setIsWiping(false);
          setWipeProgress(0);
          setResultModal({
            open: true,
            title: 'Database Wiped Successfully',
            variant: 'warning',
            data: result.data,
          });
        }, 400);
        checkStatus();
        return;
      } else {
        throw new Error(result?.error?.message || 'Wipe failed');
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Database Wipe Failed', variant: 'error', data: { message: err.message } });
      Logger.error('Settings - DB Objects', 'Database wipe failed', { error: err.message });
    }
    setTimeout(() => { setIsWiping(false); setWipeProgress(0); }, 300);
    checkStatus();
  };

  // --- More Info: Schema ---
  const handleSchemaInfo = async () => {
    setSchemaInfoModal({ open: true, data: null, loading: true });
    try {
      const result = await ApiClient.get(urls.databaseSchemaInfoEndpoint);
      setSchemaInfoModal({ open: true, data: result?.data || null, loading: false });
    } catch (err) {
      setSchemaInfoModal({ open: true, data: { error: err.message }, loading: false });
    }
  };

  // --- More Info: Default Data ---
  const handleDefaultDataInfo = async () => {
    setDefaultDataInfoModal({ open: true, data: null, loading: true });
    try {
      const result = await ApiClient.get(urls.databaseDefaultDataInfoEndpoint);
      setDefaultDataInfoModal({ open: true, data: result?.data || null, loading: false });
    } catch (err) {
      setDefaultDataInfoModal({ open: true, data: { error: err.message }, loading: false });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Schema Status */}
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">{txt.schemaStatus}</h4>
          <span className={`text-xs font-bold ${schemaStatus.initialized ? 'text-emerald-600' : 'text-amber-600'}`}>
            {schemaStatus.initialized ? txt.schemaInitialized : txt.schemaNotInitialized}
          </span>
        </div>

        {!schemaStatus.initialized ? (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-xl border border-amber-200 p-4 mb-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">{txt.schemaNotInitialized}</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">{txt.schemaDescription}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 mb-3">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{txt.schemaReady}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!schemaStatus.initialized && (
            <Button variant="primary" size="sm" icon={<Database size={14} />} onClick={handleInitializeSchema} disabled={isLoading}>
              {isLoading ? txt.initializing : txt.initializeSchema}
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<Info size={14} />} onClick={handleSchemaInfo}>
            More Info
          </Button>
        </div>
      </Card>

      {/* Default Data Status */}
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">{txt.defaultData}</h4>
          <span className={`text-xs font-bold ${defaultDataStatus.loaded ? 'text-emerald-600' : 'text-amber-600'}`}>
            {defaultDataStatus.loaded ? txt.defaultDataLoaded : txt.defaultDataNotLoaded}
          </span>
        </div>
        <p className="text-xs text-surface-500 mb-3">{txt.defaultDataDescription}</p>

        <div className="flex items-center gap-2">
          <Button
            variant={defaultDataStatus.loaded ? 'secondary' : 'primary'}
            size="sm"
            icon={<Download size={14} />}
            onClick={handleLoadDefaultData}
            disabled={isLoading || !schemaStatus.initialized}
          >
            {isLoading ? txt.loading : (defaultDataStatus.loaded ? 'Reload Default Data' : txt.loadDefaultData)}
          </Button>
          <Button variant="ghost" size="sm" icon={<Info size={14} />} onClick={handleDefaultDataInfo}>
            More Info
          </Button>
        </div>
      </Card>

      {/* Danger Zone — Wipe Database */}
      <Card variant="flat" className="p-4 border-rose-200 bg-gradient-to-r from-rose-50/50 to-red-50/30">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg shrink-0">
            <AlertTriangle size={16} className="text-rose-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">{txt.wipeTitle}</h4>
            <p className="text-xs text-surface-500">{txt.wipeDescription}</p>
          </div>
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowWipeConfirm(true)} disabled={isWiping}>
          {txt.wipeDatabase}
        </Button>
      </Card>

      {/* Progress Modals */}
      <ProgressModal isOpen={isLoading} title="Initializing..." message={loadMessage} progress={loadProgress} />
      <ProgressModal isOpen={isWiping} title="Wiping Database..." message="Dropping all tables and enum types..." progress={wipeProgress} />

      {/* Wipe Confirmation — uses reusable ConfirmDialog */}
      <ConfirmDialog
        isOpen={showWipeConfirm}
        icon={Trash2}
        title={txt.wipeTitle}
        message={messages.confirm.wipeDatabase}
        footerText="This operation is irreversible."
        confirmLabel={txt.wipeDatabase}
        cancelLabel="Cancel"
        confirmIcon={<Trash2 size={14} />}
        confirmVariant="danger"
        onConfirm={handleWipeDatabase}
        onCancel={() => setShowWipeConfirm(false)}
      />

      {/* Result Modal — shows details of what was done */}
      <ActionModal
        isOpen={resultModal.open}
        title={resultModal.title}
        icon={resultModal.variant === 'success' ? CheckCircle2 : resultModal.variant === 'error' ? XCircle : AlertTriangle}
        size="lg"
        variant="info"
        onClose={() => setResultModal({ open: false, title: '', variant: 'info', data: null })}
      >
        <ResultSummary data={resultModal.data} variant={resultModal.variant} />
      </ActionModal>

      {/* Schema Info Modal */}
      <ActionModal
        isOpen={schemaInfoModal.open}
        title={messages.info.schemaInfoTitle}
        icon={Layers}
        size="lg"
        variant="info"
        onClose={() => setSchemaInfoModal({ open: false, data: null, loading: false })}
      >
        {schemaInfoModal.loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-brand-500" size={24} /></div>
        ) : (
          <SchemaInfoContent data={schemaInfoModal.data} />
        )}
      </ActionModal>

      {/* Default Data Info Modal */}
      <ActionModal
        isOpen={defaultDataInfoModal.open}
        title={messages.info.defaultDataInfoTitle}
        icon={Users}
        size="lg"
        variant="info"
        onClose={() => setDefaultDataInfoModal({ open: false, data: null, loading: false })}
      >
        {defaultDataInfoModal.loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-brand-500" size={24} /></div>
        ) : (
          <DefaultDataInfoContent data={defaultDataInfoModal.data} />
        )}
      </ActionModal>
    </div>
  );
}

// --- Result Summary Component ---
function ResultSummary({ data, variant }) {
  if (!data) return null;

  if (variant === 'error') {
    return (
      <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
        <p className="text-sm text-rose-700 font-semibold">{data.message || 'An error occurred'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.message && (
        <div className={`p-3 rounded-lg border ${variant === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-sm font-semibold ${variant === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>{data.message}</p>
        </div>
      )}

      {data.note && <p className="text-xs text-surface-500 italic">{data.note}</p>}

      {/* Table creation details */}
      {data.tables && data.tables.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">
            {data.tablesCreated ? `${data.tablesCreated} Tables Created` : `${data.tables.length} Tables`}
          </p>
          {data.tables.map((table, i) => (
            <div key={i} className="p-3 bg-surface-50 rounded-lg border border-surface-200">
              <div className="flex items-center gap-2 mb-1">
                <Table2 size={12} className="text-brand-500" />
                <span className="text-xs font-bold font-mono text-surface-800">{table.tableName || table}</span>
                {table.status && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${table.status === 'created' ? 'bg-emerald-100 text-emerald-700' : table.status === 'dropped' ? 'bg-rose-100 text-rose-700' : 'bg-surface-100 text-surface-600'}`}>
                    {table.status.toUpperCase()}
                  </span>
                )}
              </div>
              {table.description && <p className="text-[10px] text-surface-500">{table.description}</p>}
              {table.columns && (
                <p className="text-[10px] text-surface-400 mt-1">
                  {table.columnCount || table.columns.length} columns: {(typeof table.columns[0] === 'string' ? table.columns : table.columns.map(c => c.name || c)).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dropped tables */}
      {data.droppedTables && data.droppedTables.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">
            {data.droppedCount} Tables Dropped
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {data.droppedTables.map((table, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-lg border border-surface-100">
                <Trash2 size={10} className="text-rose-400" />
                <span className="text-xs font-mono text-surface-700">{table.tableName}</span>
                <span className={`ml-auto text-[10px] font-bold ${table.status === 'dropped' ? 'text-rose-600' : 'text-amber-600'}`}>
                  {table.status?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seeded items */}
      {data.items && data.items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-surface-600 uppercase tracking-wider">
            {data.totalItems || data.items.length} Items • {data.newItems ?? data.items.filter(i => i.created).length} New
          </p>
          {data.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface-50 rounded-lg border border-surface-100">
              {item.type === 'user' ? <Users size={12} className="text-brand-500" /> : <Layers size={12} className="text-teal-500" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-surface-800 truncate">{item.name || item.moduleId}</p>
                {item.email && <p className="text-[10px] text-surface-400">{item.email} • {item.role}</p>}
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.status === 'created' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                {item.status === 'created' ? 'NEW' : 'EXISTS'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Schema Info Content ---
function SchemaInfoContent({ data }) {
  if (!data || data.error) {
    return <p className="text-sm text-rose-600">{data?.error || 'Failed to load schema info'}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500">{messages.info.schemaInfoDescription}</p>
      <p className="text-xs font-bold text-surface-600">{data.totalTables} Core Tables</p>
      {(data.tables || []).map((table, i) => (
        <div key={i} className="p-3 bg-surface-50 rounded-lg border border-surface-200">
          <div className="flex items-center gap-2 mb-1">
            <Table2 size={12} className="text-brand-500" />
            <span className="text-xs font-bold font-mono text-surface-800">{table.tableName}</span>
          </div>
          <p className="text-[10px] text-surface-500 mb-2">{table.description}</p>
          <div className="grid grid-cols-2 gap-1">
            {(table.columns || []).map((col, j) => (
              <div key={j} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${col.primaryKey ? 'bg-amber-400' : 'bg-surface-300'}`} />
                <span className="font-mono text-surface-700">{col.name}</span>
                <span className="text-surface-400">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Default Data Info Content ---
function DefaultDataInfoContent({ data }) {
  if (!data || data.error) {
    return <p className="text-sm text-rose-600">{data?.error || 'Failed to load default data info'}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500">{messages.info.defaultDataInfoDescription}</p>
      {(data.items || []).map((item, i) => (
        <div key={i} className="p-3 bg-surface-50 rounded-lg border border-surface-200">
          <div className="flex items-center gap-2 mb-1">
            {item.type === 'user' ? <Users size={12} className="text-brand-500" /> : <Layers size={12} className="text-teal-500" />}
            <span className="text-xs font-bold text-surface-800">{item.description}</span>
          </div>
          <p className="text-[10px] text-surface-400 mb-1">Table: {item.table}</p>
          {item.details && (
            <div className="mt-2 p-2 bg-white rounded border border-surface-100">
              {Object.entries(item.details).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-[10px]">
                  <span className="font-semibold text-surface-600 capitalize">{key}:</span>
                  <span className="text-surface-500">{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
