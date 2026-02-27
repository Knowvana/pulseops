// ============================================================================
// ServiceNow Connection Configuration — PulseOps UI
//
// PURPOSE: Configuration form for connecting to a ServiceNow instance.
// Auto-connects on load, shows inline progress, Connected/Not Connected
// status, saves to JSON config file, and provides a Sync Data button.
//
// ARCHITECTURE: Uses ServiceNowService directly for API calls. Reads UI text
// from uiElementsText.json. Auto-loads config from JSON and tests connection
// on mount.
//
// SECURITY:
//   - Password field displays •••••••• (never shows actual password)
//   - Only sends new password to API when user explicitly types a new one
//   - API never returns decrypted password
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Logger } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import {
  Wifi, CheckCircle2, XCircle, Save, Zap, RefreshCw,
  Eye, EyeOff, Loader2, Bug, FileText, GitPullRequest
} from 'lucide-react';

const txt = uiText.serviceNow.config.connection;
const dashTxt = uiText.serviceNow.dashboard;

export default function ServiceNowConfigConnection() {
  const [form, setForm] = useState({
    instanceUrl: '',
    username: '',
    password: '',
    authMethod: 'basic',
    apiVersion: 'v2',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connStatus, setConnStatus] = useState('not_connected');
  const [apiStatuses, setApiStatuses] = useState({ incidents: null, ritms: null, changes: null });
  const [lastTestedAt, setLastTestedAt] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectProgress, setConnectProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const autoConnectDone = useRef(false);

  const loadConfigAndConnect = useCallback(async () => {
    if (autoConnectDone.current) return;
    autoConnectDone.current = true;

    setConnecting(true);
    setConnectProgress(10);

    try {
      const configRes = await ServiceNowService.getConnectionConfig();
      setConnectProgress(30);

      if (configRes.success && configRes.data) {
        setForm({
          instanceUrl: configRes.data.instanceUrl || '',
          username: configRes.data.username || '',
          password: configRes.data.password || '',
          authMethod: configRes.data.authMethod || 'basic',
          apiVersion: configRes.data.apiVersion || 'v2',
        });

        setConnectProgress(50);
        const testRes = await ServiceNowService.testConnection();
        setConnectProgress(90);

        if (testRes.success && testRes.data) {
          setConnStatus(testRes.data.status || 'not_connected');
          setLastTestedAt(testRes.data.testedAt);
          if (testRes.data.apis) {
            setApiStatuses(testRes.data.apis);
          }
        } else {
          setConnStatus('not_connected');
        }
      } else {
        setConnStatus('not_connected');
      }
    } catch (err) {
      Logger.error('ServiceNowConfigConnection', 'Auto-connect failed', { error: err.message });
      setConnStatus('not_connected');
    }

    setConnectProgress(100);
    setTimeout(() => { setConnecting(false); setConnectProgress(0); }, 400);
  }, []);

  useEffect(() => { loadConfigAndConnect(); }, [loadConfigAndConnect]);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaveResult(null);
  }, []);

  const handleTestConnection = useCallback(async () => {
    setConnecting(true);
    setConnectProgress(20);
    try {
      setConnectProgress(50);
      const res = await ServiceNowService.testConnection();
      setConnectProgress(90);
      if (res.success && res.data) {
        setConnStatus(res.data.status || 'not_connected');
        setLastTestedAt(res.data.testedAt);
        if (res.data.apis) setApiStatuses(res.data.apis);
      } else {
        setConnStatus('not_connected');
      }
    } catch (err) {
      setConnStatus('not_connected');
    }
    setConnectProgress(100);
    setTimeout(() => { setConnecting(false); setConnectProgress(0); }, 400);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.instanceUrl || !form.username) {
      setSaveResult({ success: false, message: 'Instance URL and username are required' });
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await ServiceNowService.saveConnectionConfig(form);
      if (res.success) {
        setSaveResult({ success: true, message: txt.configSaved });
        Logger.info('ServiceNowConfigConnection', txt.configSaved);
        autoConnectDone.current = false;
        loadConfigAndConnect();
      } else {
        setSaveResult({ success: false, message: res.error || txt.configSaveFailed });
      }
    } catch (err) {
      setSaveResult({ success: false, message: txt.configSaveFailed });
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 4000);
  }, [form, loadConfigAndConnect]);

  const handleSyncData = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await ServiceNowService.triggerSync();
      if (res.success) {
        setSyncResult({ success: true, message: txt.syncSuccess });
        Logger.info('ServiceNowConfigConnection', 'Sync completed', res.data);
      } else {
        setSyncResult({ success: false, message: res.error || txt.syncFailed });
      }
    } catch (err) {
      setSyncResult({ success: false, message: txt.syncFailed });
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 5000);
  }, []);

  const isConnected = connStatus === 'connected';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Connection Status Banner with inline progress */}
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {connecting ? (
              <Loader2 size={20} className="text-brand-500 animate-spin" />
            ) : isConnected ? (
              <CheckCircle2 size={20} className="text-emerald-600" />
            ) : (
              <XCircle size={20} className="text-red-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-surface-800">
                {txt.statusLabel}: {connecting ? dashTxt.connecting : (isConnected ? dashTxt.connected : dashTxt.not_connected)}
              </p>
              {lastTestedAt && !connecting && (
                <p className="text-xs text-surface-400 mt-0.5">
                  {txt.lastTestedLabel}: {new Date(lastTestedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            isConnected ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'
          }`}>
            {isConnected ? dashTxt.connected : dashTxt.not_connected}
          </span>
        </div>

        {/* Inline progress bar */}
        {connecting && (
          <div className="mb-3">
            <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${connectProgress}%` }}
              />
            </div>
            <p className="text-xs text-surface-400 mt-1">{dashTxt.testingApis}</p>
          </div>
        )}

        {/* Per-API status */}
        {!connecting && (apiStatuses.incidents || apiStatuses.ritms || apiStatuses.changes) && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'incidents', label: dashTxt.incidentsApi, icon: Bug },
              { key: 'ritms', label: dashTxt.ritmsApi, icon: FileText },
              { key: 'changes', label: dashTxt.changesApi, icon: GitPullRequest },
            ].map(({ key, label, icon: Icon }) => {
              const st = apiStatuses[key];
              const ok = st?.status === 'connected';
              return (
                <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 border border-surface-100">
                  <Icon size={14} className="text-surface-500" />
                  <span className="text-xs font-medium text-surface-700 flex-1">{label}</span>
                  {ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-red-400" />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Connection Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">{txt.instanceUrl}</label>
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-surface-400" />
            <input
              type="url"
              value={form.instanceUrl}
              onChange={(e) => handleChange('instanceUrl', e.target.value)}
              placeholder={txt.instanceUrlPlaceholder}
              className="flex-1 px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">{txt.username}</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => handleChange('username', e.target.value)}
            placeholder={txt.usernamePlaceholder}
            className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">{txt.password}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={txt.passwordPlaceholder}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{txt.authMethod}</label>
            <select
              value={form.authMethod}
              onChange={(e) => handleChange('authMethod', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            >
              <option value="basic">Basic Auth</option>
              <option value="oauth2">OAuth 2.0</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{txt.apiVersion}</label>
            <select
              value={form.apiVersion}
              onChange={(e) => handleChange('apiVersion', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            >
              <option value="v1">v1</option>
              <option value="v2">v2</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result Messages */}
      {saveResult && (
        <div className={`p-3 rounded-lg text-sm ${
          saveResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveResult.message}
        </div>
      )}
      {syncResult && (
        <div className={`p-3 rounded-lg text-sm ${
          syncResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {syncResult.message}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="secondary"
          size="sm"
          icon={connecting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          onClick={handleTestConnection}
          disabled={connecting || !form.instanceUrl}
        >
          {connecting ? txt.testing : txt.testConnection}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          onClick={handleSave}
          disabled={saving || !form.instanceUrl || !form.username}
        >
          {saving ? txt.saving : txt.saveConfig}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          onClick={handleSyncData}
          disabled={syncing || !isConnected}
        >
          {syncing ? txt.syncing : txt.syncData}
        </Button>
      </div>
    </div>
  );
}
