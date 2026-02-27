// ============================================================================
// ServiceNow Data Management — PulseOps UI
//
// PURPOSE: Database objects management UI for the ServiceNow module. Shows
// schema status, default data status, and a danger zone for wiping data.
// Mirrors the Admin -> Settings -> Database Objects pattern.
//
// ARCHITECTURE: Uses ServiceNowService directly for API calls. Uses shared
// reusable components (Card, Button, ProgressModal, ActionModal, ConfirmDialog).
// All UI text from uiElementsText.json.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, Download
} from 'lucide-react';
import { Card, Button, ProgressModal, ActionModal, ConfirmDialog, Logger, ModuleService } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';

const txt = uiText.serviceNow.dataManagement;

export default function ServiceNowDataManagement() {
  const [schemaStatus, setSchemaStatus] = useState({ initialized: false });
  const [defaultDataStatus, setDefaultDataStatus] = useState({ loaded: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [resultModal, setResultModal] = useState({ open: false, title: '', variant: 'info', data: null });
  const [checking, setChecking] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [initProgress, setInitProgress] = useState(0);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await ServiceNowService.getSchemaInfo();
      if (res.success && res.data) {
        setSchemaStatus({ initialized: res.data.initialized !== false });
        setDefaultDataStatus({ loaded: res.data.existing?.length > 0 && res.data.missing?.length === 0 });
      } else {
        setSchemaStatus({ initialized: false });
      }
    } catch (err) {
      Logger.warn('ServiceNowDataManagement', 'Failed to check schema status', { error: err.message });
      setSchemaStatus({ initialized: false });
    }
    setChecking(false);
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const handleInitializeSchema = async () => {
    setInitLoading(true);
    setInitProgress(10);
    try {
      setInitProgress(40);
      const result = await ModuleService.initializeSchema('servicenow');
      setInitProgress(90);
      setInitProgress(100);
      Logger.info('ServiceNowDataManagement', 'Schema initialized', { tables: result?.tables });
      setTimeout(() => {
        setInitLoading(false);
        setInitProgress(0);
        setResultModal({
          open: true,
          title: txt.schemaInitialized || 'Schema Initialized',
          variant: 'success',
          data: result || {},
        });
      }, 400);
      checkStatus();
    } catch (err) {
      setResultModal({ open: true, title: 'Schema Initialization Failed', variant: 'error', data: { message: err.message } });
      Logger.error('ServiceNowDataManagement', 'Schema init failed', { error: err.message });
    }
    setTimeout(() => { setInitLoading(false); setInitProgress(0); }, 300);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  const handleLoadDefaultData = async () => {
    setIsLoading(true);
    setLoadProgress(10);
    setLoadMessage('Loading SLA configs and business hours...');
    try {
      setLoadProgress(30);
      const result = await ServiceNowService.loadDemoData();
      setLoadProgress(80);
      if (result.success) {
        setLoadProgress(100);
        setDefaultDataStatus({ loaded: true });
        Logger.info('ServiceNowDataManagement', 'Default data loaded');
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
      } else {
        throw new Error(result.error || 'Failed to load default data');
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Default Data Load Failed', variant: 'error', data: { message: err.message } });
      Logger.error('ServiceNowDataManagement', 'Default data load failed', { error: err.message });
    }
    setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
  };

  const handleWipeAll = async () => {
    setShowWipeConfirm(false);
    setIsWiping(true);
    setWipeProgress(10);
    try {
      setWipeProgress(40);
      const result = await ServiceNowService.hardReset();
      setWipeProgress(90);
      if (result.success) {
        setWipeProgress(100);
        Logger.info('ServiceNowDataManagement', 'All data wiped', { deletedTables: result.data?.deletedTables });
        setTimeout(() => {
          setIsWiping(false);
          setWipeProgress(0);
          setResultModal({
            open: true,
            title: 'All Data Deleted Successfully',
            variant: 'warning',
            data: result.data || {},
          });
        }, 400);
        checkStatus();
      } else {
        throw new Error(result.error || 'Failed to delete data');
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Data Deletion Failed', variant: 'error', data: { message: err.message } });
      Logger.error('ServiceNowDataManagement', 'Wipe failed', { error: err.message });
    }
    setTimeout(() => { setIsWiping(false); setWipeProgress(0); }, 300);
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
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800 mb-1">{txt.schemaNotInitialized}</p>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-3">{txt.schemaDescription}</p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={initLoading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  onClick={handleInitializeSchema}
                  disabled={initLoading}
                >
                  {initLoading ? (txt.initializing || 'Initializing...') : (txt.initializeSchema || 'Initialize Schema')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 mb-3">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{txt.schemaReady}</span>
          </div>
        )}
      </Card>

      {/* Default Data */}
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
            {isLoading ? txt.loading : (defaultDataStatus.loaded ? txt.reloadDefaultData : txt.loadDefaultData)}
          </Button>
        </div>
      </Card>

      {/* Danger Zone */}
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

      <ProgressModal isOpen={initLoading} title="Initializing Schema..." message="Creating ServiceNow module tables..." progress={initProgress} />
      <ProgressModal isOpen={isLoading} title="Loading Data..." message={loadMessage} progress={loadProgress} />
      <ProgressModal isOpen={isWiping} title="Dropping All Tables..." message="Dropping all ServiceNow module tables from database..." progress={wipeProgress} />

      <ConfirmDialog
        isOpen={showWipeConfirm}
        icon={Trash2}
        title={txt.wipeTitle}
        message={txt.wipeDescription}
        footerText="This operation is irreversible."
        confirmLabel={txt.wipeDatabase}
        cancelLabel="Cancel"
        confirmIcon={<Trash2 size={14} />}
        confirmVariant="danger"
        onConfirm={handleWipeAll}
        onCancel={() => setShowWipeConfirm(false)}
      />

      <ActionModal
        isOpen={resultModal.open}
        title={resultModal.title}
        icon={resultModal.variant === 'success' ? CheckCircle2 : resultModal.variant === 'error' ? XCircle : AlertTriangle}
        size="xl"
        variant="info"
        onClose={() => setResultModal({ open: false, title: '', variant: 'info', data: null })}
        className="max-h-[90vh]"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {resultModal.data?.message && (
            <div className={`p-4 rounded-lg border ${resultModal.variant === 'error' ? 'bg-red-50 border-red-200' : resultModal.variant === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-sm font-semibold ${resultModal.variant === 'error' ? 'text-red-800' : resultModal.variant === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>
                {resultModal.data.message}
              </p>
            </div>
          )}
          {/* Dropped tables detail (from wipe/hard reset) */}
          {resultModal.data?.droppedTables && Array.isArray(resultModal.data.droppedTables) && resultModal.data.droppedTables.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-surface-200">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Tables Dropped</p>
              <div className="space-y-2">
                {resultModal.data.droppedTables.map((table) => (
                  <div key={table.name} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg border border-surface-100">
                    <div className="flex items-center gap-2 flex-1">
                      <Database size={14} className={table.status === 'error' || table.status === 'failed' ? 'text-red-400' : table.status === 'not_found' ? 'text-surface-300' : 'text-brand-500'} />
                      <span className="text-sm font-mono text-surface-800">{table.name}</span>
                    </div>
                    <div className="text-right">
                      {table.status === 'dropped' && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Dropped</span>
                      )}
                      {table.status === 'not_found' && (
                        <span className="text-xs font-semibold text-surface-400 bg-surface-100 px-2 py-1 rounded">Not Found</span>
                      )}
                      {(table.status === 'error' || table.status === 'failed') && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Error</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Created tables detail (from schema init) */}
          {resultModal.data?.tables && Array.isArray(resultModal.data.tables) && resultModal.data.tables.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-surface-200">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Tables Created ({resultModal.data.tableCount || resultModal.data.tables.length})</p>
              <div className="space-y-2">
                {resultModal.data.tables.map((table, idx) => {
                  // Safely extract table name
                  const tableName = typeof table === 'string' ? table : (typeof table === 'object' && table?.name ? table.name : `Table ${idx}`);
                  
                  // Safely extract column count
                  let columnCount = 0;
                  if (typeof table === 'object' && table?.columnCount) {
                    columnCount = table.columnCount;
                  } else if (typeof table === 'object' && Array.isArray(table?.columns)) {
                    columnCount = table.columns.length;
                  }
                  
                  // Safely extract and filter column names only
                  let columnNames = [];
                  if (typeof table === 'object' && Array.isArray(table?.columns)) {
                    columnNames = table.columns
                      .map(col => {
                        if (typeof col === 'string') return col;
                        if (typeof col === 'object' && col?.name) return col.name;
                        return null;
                      })
                      .filter(name => name !== null && name !== undefined);
                  }
                  
                  return (
                    <div key={`table-${tableName}-${idx}`} className="p-3 bg-surface-50 rounded-lg border border-surface-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Database size={14} className="text-brand-500" />
                          <span className="text-sm font-mono text-surface-800">{tableName}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-surface-400">{columnCount} columns</span>
                      </div>
                      {columnNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {columnNames.map((colName, colIdx) => (
                            <span key={`col-${colName}-${colIdx}`} className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-100 text-surface-600 rounded">
                              {colName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-200">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResultModal({ open: false, title: '', variant: 'info', data: null })}
          >
            Close
          </Button>
        </div>
      </ActionModal>
    </div>
  );
}
