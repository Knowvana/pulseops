import React, { useState, useCallback } from 'react';
import { Database, RefreshCw, Save, CheckCircle2, XCircle } from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import ProgressModal from '@shared/components/ProgressModal';
import ActionModal from '@shared/components/ActionModal';
import ApiClient from '@shared/services/apiClient';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';

const txt = uiText.platformAdmin.settings.database;

function EditableField({ label, value, onChange, placeholder, disabled, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all disabled:bg-surface-50 disabled:text-surface-400"
      />
    </div>
  );
}

export default function SettingsDatabase() {
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '5432',
    database: 'postgres_db',
    username: 'postgres',
    password: '',
    ssl: false,
  });

  const [connectionStatus, setConnectionStatus] = useState({ status: 'unknown', latencyMs: 0 });
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTestConnect = useCallback(async () => {
    setIsTesting(true);
    setTestProgress(10);
    try {
      setTestProgress(40);
      const result = await ApiClient.get('/database/test-connection');
      setTestProgress(90);

      if (result?.success) {
        setConnectionStatus({ status: 'connected', latencyMs: result.data?.latencyMs || 0 });
        Logger.info('Settings - Database', 'Connection test successful', { latencyMs: result.data?.latencyMs });
      } else {
        setConnectionStatus({ status: 'error', latencyMs: 0 });
        Logger.warn('Settings - Database', 'Connection test failed', { error: result?.error?.message });
      }
      setTestProgress(100);
    } catch (err) {
      setConnectionStatus({ status: 'error', latencyMs: 0 });
      Logger.error('Settings - Database', 'Connection test error', { error: err.message });
    } finally {
      setTimeout(() => { setIsTesting(false); setTestProgress(0); }, 300);
    }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    setIsSaving(true);
    setSaveProgress(10);
    setShowError(false);
    try {
      setSaveProgress(40);
      const payload = {
        host: dbConfig.host,
        port: parseInt(dbConfig.port) || 5432,
        database: dbConfig.database,
        username: dbConfig.username,
        ssl: dbConfig.ssl,
      };
      if (dbConfig.password) {
        payload.password = dbConfig.password;
      }

      const result = await ApiClient.post('/config/database', payload);
      setSaveProgress(90);

      if (result?.success) {
        setSaveProgress(100);
        setIsSaving(false);
        setShowSuccess(true);
        setDbConfig(prev => ({ ...prev, password: '' }));
        Logger.info('Settings - Database', messages.success.configSaved, payload);
      } else {
        throw new Error(result?.error?.message || messages.errors.configSaveFailed);
      }
    } catch (err) {
      setIsSaving(false);
      setErrorMessage(err.message || messages.errors.configSaveFailed);
      setShowError(true);
      Logger.error('Settings - Database', messages.errors.configSaveFailed, { error: err.message });
    }
  }, [dbConfig]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Database Type Banner */}
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

        {/* Connection Form */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <EditableField label={txt.fields.host} value={dbConfig.host} onChange={(v) => setDbConfig(p => ({ ...p, host: v }))} placeholder={txt.placeholders.host} />
            <EditableField label={txt.fields.port} value={dbConfig.port} onChange={(v) => setDbConfig(p => ({ ...p, port: v }))} placeholder={txt.placeholders.port} />
          </div>
          <EditableField label={txt.fields.database} value={dbConfig.database} onChange={(v) => setDbConfig(p => ({ ...p, database: v }))} placeholder={txt.placeholders.database} />
          <EditableField label={txt.fields.username} value={dbConfig.username} onChange={(v) => setDbConfig(p => ({ ...p, username: v }))} placeholder={txt.placeholders.username} />
          <EditableField label={txt.fields.password} value={dbConfig.password} onChange={(v) => setDbConfig(p => ({ ...p, password: v }))} placeholder={txt.placeholders.password} type="password" />

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

        {/* Connection Status */}
        <div className="flex items-center justify-between py-2 mb-4">
          <span className="text-xs font-semibold text-surface-600">{txt.connectionStatus}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
            connectionStatus.status === 'connected' ? 'text-emerald-600' :
            connectionStatus.status === 'error' ? 'text-rose-600' : 'text-surface-400'
          }`}>
            {connectionStatus.status === 'connected' ? <CheckCircle2 size={13} /> : connectionStatus.status === 'error' ? <XCircle size={13} /> : null}
            {connectionStatus.status === 'connected' ? `${txt.status.connected} (${connectionStatus.latencyMs}ms)` :
             connectionStatus.status === 'error' ? txt.status.notConnected :
             'Unknown'}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={handleTestConnect} disabled={isTesting}>
            {isTesting ? txt.buttons.testing : txt.buttons.testConnect}
          </Button>
          <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSaveConfig} disabled={isSaving}>
            {isSaving ? txt.buttons.saving : txt.buttons.saveConfig}
          </Button>
        </div>
      </Card>

      <ProgressModal isOpen={isTesting} title={txt.buttons.testing} message={txt.status.testing} progress={testProgress} />
      <ProgressModal isOpen={isSaving} title={txt.buttons.saving} message="Saving database configuration..." progress={saveProgress} />

      <ActionModal isOpen={showSuccess} title={messages.success.configSaved} icon={CheckCircle2} size="sm" variant="info" onClose={() => setShowSuccess(false)}>
        <p className="text-sm text-surface-600">{messages.success.configSaved}</p>
      </ActionModal>

      <ActionModal isOpen={showError} title="Configuration Failed" icon={XCircle} size="sm" variant="info" onClose={() => setShowError(false)}>
        <p className="text-sm text-rose-600">{errorMessage}</p>
      </ActionModal>
    </div>
  );
}
