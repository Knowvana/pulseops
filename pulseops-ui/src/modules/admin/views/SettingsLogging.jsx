import React, { useState, useCallback } from 'react';
import { Settings, Save, CheckCircle2, Monitor, Server, Eye, Package, Check, Bug, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import PageHeader from '@shared/components/PageHeader';
import Logger from '@shared/services/logger';
import ApiClient from '@shared/services/apiClient';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import appConfig from '@shared/config/app.json';
import ProgressModal from '@shared/components/ProgressModal';
import { StatusTile } from '@shared';

const txt = uiText.platformAdmin.settings.logging;

function ToggleRow({ label, description, enabled, onToggle, icon: Icon }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {Icon && <Icon size={14} className="text-surface-500" />}
      <div className="text-xs font-semibold text-surface-700 text-center">{label}</div>
      <div
        className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-brand-500' : 'bg-surface-300'}`}
        onClick={onToggle}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      {description && <div className="text-xs text-surface-400 text-center leading-tight">{description}</div>}
    </div>
  );
}

export default function SettingsLogging() {
  const currentConfig = Logger.getConfig();

  const [logLevel, setLogLevel] = useState(currentConfig.minLevel || 'debug');
  const [consoleOutput, setConsoleOutput] = useState(currentConfig.consoleOutput !== false);
  const [captureApiCalls, setCaptureApiCalls] = useState(currentConfig.captureApiCalls !== false);
  const [captureUiLogs, setCaptureUiLogs] = useState(true);
  const [captureModuleLogs, setCaptureModuleLogs] = useState(true);
  const [maxEntries, setMaxEntries] = useState(currentConfig.maxBufferSize || 500);
  const [syncLimit, setSyncLimit] = useState(currentConfig.syncLimit || 100);
  const [dbRetention, setDbRetention] = useState(10000);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ type: null, status: 'neutral', message: '', meta: null });

  const modules = (appConfig.modules || []).map(m => ({
    id: m.id,
    name: m.name,
    enabled: true,
  }));
  const [moduleLogging, setModuleLogging] = useState(modules);

  const handleToggleModule = useCallback((moduleId) => {
    setModuleLogging(prev => prev.map(m => m.id === moduleId ? { ...m, enabled: !m.enabled } : m));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      Logger.updateConfig({
        minLevel: logLevel,
        consoleOutput,
        captureApiCalls,
        maxBufferSize: maxEntries,
        syncLimit,
      });

      await ApiClient.post('/config/logging', {
        logLevel,
        consoleOutput,
        captureApiCalls,
        captureUiLogs,
        captureModuleLogs,
        maxEntries,
        syncLimit,
        dbRetention,
        autoCleanup,
        moduleLogging: moduleLogging.reduce((acc, m) => { acc[m.id] = m.enabled; return acc; }, {}),
      });
      Logger.info('Settings - Logging', messages.success.logConfigSaved);
      setStatus({
        type: 'save',
        status: 'success',
        message: 'Configuration saved successfully.',
        meta: null,
      });
    } catch (err) {
      Logger.warn('Settings - Logging', 'Failed to persist logging config to server', { error: err.message });
    } finally {
      setIsSaving(false);
    }
  }, [logLevel, consoleOutput, captureApiCalls, captureUiLogs, captureModuleLogs, maxEntries, syncLimit, dbRetention, autoCleanup, moduleLogging]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Logging Configuration */}
      <Card variant="flat" className="p-4">
        <div className="flex gap-6">
          
          {/* Log Level */}
          <div className="flex-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 text-center">{txt.logLevel.title}</h5>
            <p className="text-xs text-surface-500 mb-3 text-center">{txt.logLevel.description}</p>
            <div className="flex items-center gap-1">
              {Logger.getLogLevels().map((level) => (
                <button
                  key={level}
                  onClick={() => setLogLevel(level)}
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    logLevel === level
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  {level === 'debug' ? <Bug size={12} className="mr-1" /> : level === 'info' ? <Info size={12} className="mr-1" /> : level === 'warn' ? <AlertTriangle size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />} {level} {logLevel === level && <Check size={12} className="ml-1 text-green-700" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-surface-400 mt-1">
              {logLevel === 'debug' && 'Captures all logs including debug, info, warn, and error messages.'}
              {logLevel === 'info' && 'Captures info, warn, and error logs (excludes debug).'}
              {logLevel === 'warn' && 'Captures warn and error logs (excludes debug and info).'}
              {logLevel === 'error' && 'Captures only error logs (excludes debug, info, and warn).'}
            </p>
          </div>

          {/* Separator */}
          <div className="w-1 bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-lg" />

          {/* Capture Options */}
          <div className="flex-1 text-center">
            <h5 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Log Capture Options</h5>
            <div className="flex justify-center gap-2">
              <ToggleRow icon={Monitor} label={txt.captureOptions.consoleOutput} description={txt.captureOptions.consoleDescription} enabled={consoleOutput} onToggle={() => setConsoleOutput(!consoleOutput)} />
              <div className="w-1 h-16 bg-gradient-to-b from-transparent via-brand-400 to-transparent shadow-lg" />
              <ToggleRow icon={Server} label={txt.captureOptions.apiLogs} description={txt.captureOptions.apiDescription} enabled={captureApiCalls} onToggle={() => setCaptureApiCalls(!captureApiCalls)} />
              <div className="w-1 h-16 bg-gradient-to-b from-transparent via-brand-400 to-transparent shadow-lg" />
              <ToggleRow icon={Eye} label={txt.captureOptions.uiLogs} description={txt.captureOptions.uiDescription} enabled={captureUiLogs} onToggle={() => setCaptureUiLogs(!captureUiLogs)} />
              <div className="w-1 h-16 bg-gradient-to-b from-transparent via-brand-400 to-transparent shadow-lg" />
              <ToggleRow icon={Package} label={txt.captureOptions.moduleLogs} description={txt.captureOptions.moduleDescription} enabled={captureModuleLogs} onToggle={() => setCaptureModuleLogs(!captureModuleLogs)} />
            </div>
          </div>
        </div>
      </Card>

      {/* Log Management */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 text-center">Log Management</h4>
        <div className="h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent mb-6"></div>
        <div className="flex gap-6">
          
          {/* Log Sync to Database */}
          <div className="flex-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.sync.title}</h5>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.sync.limitLabel}</label>
                <input
                  type="number"
                  value={syncLimit}
                  onChange={(e) => setSyncLimit(Math.max(10, parseInt(e.target.value) || 100))}
                  min={10}
                  max={1000}
                  step={10}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <p className="text-xs text-surface-400 mt-1">{txt.sync.limitDescription}</p>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="w-1 bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-lg" />

          {/* Retention */}
          <div className="flex-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.retention.title}</h5>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-surface-700">{txt.retention.autoCleanup}</div>
                  <div
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${autoCleanup ? 'bg-brand-500' : 'bg-surface-300'}`}
                    onClick={() => setAutoCleanup(!autoCleanup)}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${autoCleanup ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
                <p className="text-xs text-surface-400 mt-1">{txt.retention.autoCleanupDescription}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.retention.maxEntries}</label>
                <input
                  type="number"
                  value={maxEntries}
                  onChange={(e) => setMaxEntries(Math.max(100, parseInt(e.target.value) || 100))}
                  min={100}
                  max={10000}
                  step={100}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <p className="text-xs text-surface-400 mt-1">{txt.retention.maxEntriesDescription}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">{txt.retention.dbRetention}</label>
                <input
                  type="number"
                  value={dbRetention}
                  onChange={(e) => setDbRetention(Math.max(1000, parseInt(e.target.value) || 1000))}
                  min={1000}
                  max={100000}
                  step={1000}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <p className="text-xs text-surface-400 mt-1">{txt.retention.dbRetentionDescription}</p>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="w-1 bg-gradient-to-b from-transparent via-purple-400 to-transparent shadow-lg" />

          {/* Module-wise Logging */}
          <div className="flex-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.modulewise.title}</h5>
            <p className="text-xs text-surface-500 mb-3">{txt.modulewise.description}</p>
            <div className="space-y-2">
              {moduleLogging.map((mod) => (
                <div key={mod.id} className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-surface-700">{mod.name}</div>
                  <div
                    className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${mod.enabled ? 'bg-brand-500' : 'bg-surface-300'}`}
                    onClick={() => handleToggleModule(mod.id)}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${mod.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Save Status */}
      {status.type && (
        <div className="mb-4">
          <StatusTile
            label="Save Status"
            status={status.status}
            statusText="Configuration Saved"
            message={status.message}
            meta={status.meta}
          />
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          icon={<Save size={16} />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {txt.saveButton}
        </Button>
      </div>

      <ProgressModal
        isOpen={isSaving}
        title="Saving Configuration"
        message="Please wait while we save your settings..."
        progress={50}
      />
    </div>
  );
}
