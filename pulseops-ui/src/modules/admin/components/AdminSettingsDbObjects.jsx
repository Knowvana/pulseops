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

export default function AdminSettingsDbObjects() {
  const [dbConnected, setDbConnected] = useState(null);
  const [schemaStatus, setSchemaStatus] = useState({ initialized: false });
  const [defaultDataStatus, setDefaultDataStatus] = useState({ loaded: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [resultModal, setResultModal] = useState({ open: false, title: '', variant: 'info', data: null });

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
      Logger.warn('AdminSettingsDbObjects', 'Failed to check schema status', { error: err.message });
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

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
        Logger.info('AdminSettingsDbObjects', messages.success.schemaCreated);
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
      } else {
        throw new Error(result?.error?.message || messages.errors.schemaInitFailed);
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Schema Initialization Failed', variant: 'error', data: { message: err.message } });
      Logger.error('AdminSettingsDbObjects', messages.errors.schemaInitFailed, { error: err.message });
    }
    setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
  };

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
        Logger.info('AdminSettingsDbObjects', messages.success.defaultDataLoaded);
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
        throw new Error(result?.error?.message || messages.errors.dbInitFailed);
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Default Data Load Failed', variant: 'error', data: { message: err.message } });
      Logger.error('AdminSettingsDbObjects', messages.errors.dbInitFailed, { error: err.message });
    }
    setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
  };

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
        Logger.info('AdminSettingsDbObjects', messages.success.dbWiped);
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
      } else {
        throw new Error(result?.error?.message || messages.errors.dbWipeFailed);
      }
    } catch (err) {
      setResultModal({ open: true, title: 'Database Wipe Failed', variant: 'error', data: { message: err.message } });
      Logger.error('AdminSettingsDbObjects', messages.errors.dbWipeFailed, { error: err.message });
    }
    setTimeout(() => { setIsWiping(false); setWipeProgress(0); }, 300);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

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
        </div>
      </Card>

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
        </div>
      </Card>

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

      <ProgressModal isOpen={isLoading} title="Initializing..." message={loadMessage} progress={loadProgress} />
      <ProgressModal isOpen={isWiping} title="Wiping Database..." message="Dropping all tables and enum types..." progress={wipeProgress} />

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

      <ActionModal
        isOpen={resultModal.open}
        title={resultModal.title}
        icon={resultModal.variant === 'success' ? CheckCircle2 : resultModal.variant === 'error' ? XCircle : AlertTriangle}
        size="lg"
        variant="info"
        onClose={() => setResultModal({ open: false, title: '', variant: 'info', data: null })}
      >
        <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
          <p className="text-sm text-surface-700">{resultModal.data?.message || 'Operation completed'}</p>
        </div>
      </ActionModal>
    </div>
  );
}
