import React, { useState, useEffect, useCallback } from 'react';
import { Database, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import ProgressModal from '@shared/components/ProgressModal';
import ActionModal from '@shared/components/ActionModal';
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';

const txt = uiText.platformAdmin.settings.dbObjects;

export default function SettingsDbObjects() {
  const [schemaStatus, setSchemaStatus] = useState({ initialized: false });
  const [defaultDataStatus, setDefaultDataStatus] = useState({ loaded: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const result = await ApiClient.get('/database/schema-status');
      if (result?.success && result?.data) {
        setSchemaStatus({ initialized: result.data.initialized !== false });
        setDefaultDataStatus({ loaded: result.data.hasDefaultData !== false });
      }
    } catch (err) {
      Logger.warn('Settings - DB Objects', 'Failed to check schema status', { error: err.message });
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const handleInitializeSchema = useCallback(async () => {
    setIsLoading(true);
    setLoadProgress(10);
    setLoadMessage('Creating database tables...');
    try {
      setLoadProgress(40);
      const result = await ApiClient.post('/database/sync');
      setLoadProgress(80);
      if (result?.success) {
        setSchemaStatus({ initialized: true });
        setSuccessMessage(messages.success.schemaCreated);
        setShowSuccess(true);
        Logger.info('Settings - DB Objects', messages.success.schemaCreated);
      } else {
        throw new Error(result?.error?.message || messages.errors.schemaInitFailed);
      }
      setLoadProgress(100);
    } catch (err) {
      setErrorMessage(err.message);
      setShowError(true);
      Logger.error('Settings - DB Objects', messages.errors.schemaInitFailed, { error: err.message });
    } finally {
      setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
      checkStatus();
    }
  }, [checkStatus]);

  const handleLoadDefaultData = useCallback(async () => {
    setIsLoading(true);
    setLoadProgress(10);
    setLoadMessage('Loading default admin user and configuration...');
    try {
      setLoadProgress(40);
      const result = await ApiClient.post('/database/load-default-data');
      setLoadProgress(80);
      if (result?.success) {
        setDefaultDataStatus({ loaded: true });
        setSuccessMessage(messages.success.defaultDataLoaded);
        setShowSuccess(true);
        Logger.info('Settings - DB Objects', messages.success.defaultDataLoaded);
      } else {
        throw new Error(result?.error?.message || messages.errors.dbInitFailed);
      }
      setLoadProgress(100);
    } catch (err) {
      setErrorMessage(err.message);
      setShowError(true);
      Logger.error('Settings - DB Objects', messages.errors.dbInitFailed, { error: err.message });
    } finally {
      setTimeout(() => { setIsLoading(false); setLoadProgress(0); }, 300);
      checkStatus();
    }
  }, [checkStatus]);

  const handleWipeDatabase = useCallback(async () => {
    setShowWipeConfirm(false);
    setIsWiping(true);
    setWipeProgress(10);
    try {
      setWipeProgress(40);
      const result = await ApiClient.post('/database/wipe');
      setWipeProgress(90);
      if (result?.success) {
        setSuccessMessage(messages.success.dbWiped);
        setShowSuccess(true);
        Logger.info('Settings - DB Objects', messages.success.dbWiped);
      } else {
        throw new Error(result?.error?.message || 'Wipe failed');
      }
      setWipeProgress(100);
    } catch (err) {
      setErrorMessage(err.message);
      setShowError(true);
      Logger.error('Settings - DB Objects', 'Database wipe failed', { error: err.message });
    } finally {
      setTimeout(() => { setIsWiping(false); setWipeProgress(0); }, 300);
      checkStatus();
    }
  }, [checkStatus]);

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
        <p className="text-xs text-surface-500 mb-3">{txt.schemaDescription}</p>
        {!schemaStatus.initialized ? (
          <Button variant="secondary" size="sm" icon={<Database size={14} />} onClick={handleInitializeSchema} disabled={isLoading}>
            {isLoading ? txt.initializing : txt.initializeSchema}
          </Button>
        ) : (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{txt.schemaReady}</span>
          </div>
        )}
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
        {!defaultDataStatus.loaded ? (
          <Button variant="secondary" size="sm" icon={<Database size={14} />} onClick={handleLoadDefaultData} disabled={isLoading || !schemaStatus.initialized}>
            {isLoading ? txt.loading : txt.loadDefaultData}
          </Button>
        ) : (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{txt.defaultDataReady}</span>
          </div>
        )}
      </Card>

      {/* Wipe Database */}
      <Card variant="flat" className="p-4 border-rose-200 bg-rose-50/30">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-3">{txt.wipeTitle}</h4>
        <p className="text-xs text-surface-500 mb-3">{txt.wipeDescription}</p>
        <Button variant="danger" size="sm" icon={<AlertTriangle size={14} />} onClick={() => setShowWipeConfirm(true)} disabled={isWiping}>
          {txt.wipeDatabase}
        </Button>
      </Card>

      <ProgressModal isOpen={isLoading} title="Processing..." message={loadMessage} progress={loadProgress} />
      <ProgressModal isOpen={isWiping} title="Wiping Database..." message="Removing all data from tables..." progress={wipeProgress} />

      <ActionModal isOpen={showWipeConfirm} title={txt.wipeTitle} icon={AlertTriangle} size="sm" variant="confirm" confirmLabel={txt.wipeDatabase} confirmVariant="danger" onConfirm={handleWipeDatabase} onCancel={() => setShowWipeConfirm(false)}>
        <p className="text-sm text-surface-600">{messages.confirm.wipeDatabase}</p>
      </ActionModal>

      <ActionModal isOpen={showSuccess} title="Success" icon={CheckCircle2} size="sm" variant="info" onClose={() => setShowSuccess(false)}>
        <p className="text-sm text-surface-600">{successMessage}</p>
      </ActionModal>

      <ActionModal isOpen={showError} title="Error" icon={XCircle} size="sm" variant="info" onClose={() => setShowError(false)}>
        <p className="text-sm text-rose-600">{errorMessage}</p>
      </ActionModal>
    </div>
  );
}
