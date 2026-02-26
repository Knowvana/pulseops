import React, { useState, useCallback, useEffect } from 'react';
import { Database, RefreshCw, Save, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Card, Button, ProgressModal, ActionModal, StatusTile, Logger, ApiClient } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import urls from '@shared/config/urls.json';

const txt = uiText.platformAdmin.settings.database;

function EditableField({ label, value, onChange, placeholder, disabled, type = 'text', rightAddon }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all disabled:bg-surface-50 disabled:text-surface-400 ${rightAddon ? 'pr-9' : ''}`}
        />
        {rightAddon && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {rightAddon}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsDatabase() {
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '5432',
    database: 'postgres_db',
    username: 'postgres',
    password: '',
    ssl: false,
  });

  const [unifiedStatus, setUnifiedStatus] = useState({
    type: null,
    status: 'neutral',
    message: '',
    meta: null,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkConnectionOnLoad = async () => {
      try {
        const result = await ApiClient.get(urls.databaseTestConnectionEndpoint);
        if (result?.success) {
          const latency = result.data?.latencyMs || 0;
          const dbVersion = result.data?.dbVersion || null;
          const versionShort = dbVersion ? dbVersion.split(',')[0].replace('PostgreSQL ', '') : 'Unknown';
          setUnifiedStatus({
            type: 'connection',
            status: 'success',
            message: result.data?.message || messages.success.dbConnected,
            meta: `Response Time: ${latency}ms • Database Version: ${versionShort}`,
          });
        } else {
          setUnifiedStatus({
            type: 'connection',
            status: 'error',
            message: result?.data?.message || messages.errors.dbConnectionFailed,
            meta: null,
          });
        }
      } catch {
        setUnifiedStatus({
          type: 'connection',
          status: 'error',
          message: messages.errors.dbConnectionFailed,
          meta: null,
        });
      }
    };
    checkConnectionOnLoad();
  }, []);

  const handleTestConnect = useCallback(async () => {
    setIsTesting(true);
    setTestProgress(10);
    setUnifiedStatus({ type: null, status: 'neutral', message: '', meta: null });
    try {
      setTestProgress(40);
      const result = await ApiClient.get(urls.databaseTestConnectionEndpoint);
      setTestProgress(90);

      if (result?.success) {
        const latency = result.data?.latencyMs || 0;
        const dbVersion = result.data?.dbVersion || null;
        const versionShort = dbVersion ? dbVersion.split(',')[0].replace('PostgreSQL ', '') : 'Unknown';
        
        setUnifiedStatus({
          type: 'connection',
          status: 'success',
          message: result.data?.message || messages.success.dbConnected,
          meta: `Response Time: ${latency}ms • Database Version: ${versionShort}`,
        });
        Logger.info('AdminSettingsDatabase', result.data?.message || messages.success.dbConnected, { latencyMs: latency });
      } else {
        setUnifiedStatus({
          type: 'connection',
          status: 'error',
          message: result?.error?.message || messages.errors.dbConnectionFailed,
          meta: null,
        });
      }
    } catch (err) {
      setUnifiedStatus({
        type: 'connection',
        status: 'error',
        message: err.message || messages.errors.dbConnectionFailed,
        meta: null,
      });
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestProgress(0), 300);
    }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    setIsSaving(true);
    setSaveProgress(10);
    try {
      setSaveProgress(40);
      const payload = { ...dbConfig };
      const result = await ApiClient.post(urls.databaseConfigEndpoint, payload);
      setSaveProgress(90);

      if (result?.success) {
        setSaveProgress(100);
        setUnifiedStatus({
          type: 'save',
          status: 'success',
          message: result.data?.message || messages.success.configSaved,
          meta: null,
        });
        Logger.info('AdminSettingsDatabase', messages.success.configSaved, payload);
      } else {
        throw new Error(result?.error?.message || messages.errors.configSaveFailed);
      }
    } catch (err) {
      setUnifiedStatus({
        type: 'save',
        status: 'error',
        message: err.message || messages.errors.configSaveFailed,
        meta: null,
      });
      Logger.error('AdminSettingsDatabase', messages.errors.configSaveFailed, { error: err.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveProgress(0), 300);
    }
  }, [dbConfig]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      <Card variant="flat" className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200/50 mb-4">
          <div className="p-2 rounded-lg bg-white shadow-sm">
            <Database size={18} className="text-brand-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-surface-800">{txt.typeLabel}</p>
            <p className="text-[10px] text-surface-500">{txt.typeDescription}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <EditableField label={txt.fields.host} value={dbConfig.host} onChange={(v) => setDbConfig(p => ({ ...p, host: v }))} placeholder={txt.placeholders.host} />
            <EditableField label={txt.fields.port} value={dbConfig.port} onChange={(v) => setDbConfig(p => ({ ...p, port: v }))} placeholder={txt.placeholders.port} />
          </div>
          <EditableField label={txt.fields.database} value={dbConfig.database} onChange={(v) => setDbConfig(p => ({ ...p, database: v }))} placeholder={txt.placeholders.database} />
          <EditableField label={txt.fields.username} value={dbConfig.username} onChange={(v) => setDbConfig(p => ({ ...p, username: v }))} placeholder={txt.placeholders.username} />
          <EditableField
            label={txt.fields.password}
            value={dbConfig.password}
            onChange={(v) => setDbConfig(p => ({ ...p, password: v }))}
            placeholder={txt.placeholders.password}
            type={showPassword ? 'text' : 'password'}
            rightAddon={
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="text-surface-400 hover:text-surface-600 transition-colors"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />

          <div className="flex items-center gap-2 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`relative w-9 h-5 rounded-full transition-colors ${dbConfig.ssl ? 'bg-brand-500' : 'bg-surface-300'}`} onClick={() => setDbConfig(p => ({ ...p, ssl: !p.ssl }))}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dbConfig.ssl ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs font-semibold text-surface-600">{txt.fields.ssl}</span>
            </label>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-4" />

        {unifiedStatus.type && (
          <div className="mb-4">
            <StatusTile
              label={unifiedStatus.type === 'connection' ? 'Connection Status' : 'Save Status'}
              status={unifiedStatus.status}
              statusText={
                unifiedStatus.status === 'success'
                  ? (unifiedStatus.type === 'connection' ? 'Connected' : 'Configuration Saved')
                  : unifiedStatus.status === 'error'
                    ? (unifiedStatus.type === 'connection' ? 'Connection Failed' : 'Save Failed')
                    : undefined
              }
              message={unifiedStatus.message}
              meta={unifiedStatus.meta}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleTestConnect} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSaveConfig} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </Card>

      <ProgressModal isOpen={isTesting} title="Testing Connection" message="Connecting to database..." progress={testProgress} />
      <ProgressModal isOpen={isSaving} title="Saving Configuration" message="Saving database configuration..." progress={saveProgress} />
    </div>
  );
}
