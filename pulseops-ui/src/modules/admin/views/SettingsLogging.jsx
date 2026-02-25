import React, { useState, useCallback } from 'react';
import { Settings, Save, CheckCircle2 } from 'lucide-react';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Logger from '@shared/services/logger';
import ApiClient from '@shared/services/apiClient';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import appConfig from '@shared/config/app.json';

const txt = uiText.platformAdmin.settings.logging;

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-semibold text-surface-700">{label}</p>
        {description && <p className="text-[10px] text-surface-400 mt-0.5">{description}</p>}
      </div>
      <div
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${enabled ? 'bg-brand-500' : 'bg-surface-300'}`}
        onClick={onToggle}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
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
  const [dbRetention, setDbRetention] = useState(10000);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [saved, setSaved] = useState(false);

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
    Logger.updateConfig({
      minLevel: logLevel,
      consoleOutput,
      captureApiCalls,
      maxBufferSize: maxEntries,
    });

    try {
      await ApiClient.post('/config/logging', {
        logLevel,
        consoleOutput,
        captureApiCalls,
        captureUiLogs,
        captureModuleLogs,
        maxEntries,
        dbRetention,
        autoCleanup,
        moduleLogging: moduleLogging.reduce((acc, m) => { acc[m.id] = m.enabled; return acc; }, {}),
      });
      Logger.info('Settings - Logging', messages.success.logConfigSaved);
    } catch (err) {
      Logger.warn('Settings - Logging', 'Failed to persist logging config to server', { error: err.message });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [logLevel, consoleOutput, captureApiCalls, captureUiLogs, captureModuleLogs, maxEntries, dbRetention, autoCleanup, moduleLogging]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Log Level */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.logLevel.title}</h4>
        <p className="text-xs text-surface-500 mb-3">{txt.logLevel.description}</p>
        <div className="flex items-center gap-1">
          {Logger.getLogLevels().map((level) => (
            <button
              key={level}
              onClick={() => setLogLevel(level)}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                logLevel === level
                  ? level === 'debug' ? 'bg-surface-200 text-surface-700 ring-1 ring-surface-300'
                  : level === 'info' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                  : level === 'warn' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                  : 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                  : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </Card>

      {/* Capture Options */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.captureOptions.title}</h4>
        <ToggleRow label={txt.captureOptions.consoleOutput} description={txt.captureOptions.consoleDescription} enabled={consoleOutput} onToggle={() => setConsoleOutput(!consoleOutput)} />
        <ToggleRow label={txt.captureOptions.apiLogs} description={txt.captureOptions.apiDescription} enabled={captureApiCalls} onToggle={() => setCaptureApiCalls(!captureApiCalls)} />
        <ToggleRow label={txt.captureOptions.uiLogs} description={txt.captureOptions.uiDescription} enabled={captureUiLogs} onToggle={() => setCaptureUiLogs(!captureUiLogs)} />
        <ToggleRow label={txt.captureOptions.moduleLogs} description={txt.captureOptions.moduleDescription} enabled={captureModuleLogs} onToggle={() => setCaptureModuleLogs(!captureModuleLogs)} />
      </Card>

      {/* Retention */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.retention.title}</h4>
        <div className="space-y-4">
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
            <p className="text-[10px] text-surface-400 mt-1">{txt.retention.maxEntriesDescription}</p>
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
            <p className="text-[10px] text-surface-400 mt-1">{txt.retention.dbRetentionDescription}</p>
          </div>
          <ToggleRow label={txt.retention.autoCleanup} description={txt.retention.autoCleanupDescription} enabled={autoCleanup} onToggle={() => setAutoCleanup(!autoCleanup)} />
        </div>
      </Card>

      {/* Module-wise Logging */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-1">{txt.modulewise.title}</h4>
        <p className="text-xs text-surface-500 mb-3">{txt.modulewise.description}</p>
        {moduleLogging.map((mod) => (
          <ToggleRow
            key={mod.id}
            label={mod.name}
            enabled={mod.enabled}
            onToggle={() => handleToggleModule(mod.id)}
          />
        ))}
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          variant={saved ? 'success' : 'primary'}
          size="md"
          icon={saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          onClick={handleSave}
        >
          {saved ? txt.savedButton : txt.saveButton}
        </Button>
        <span className="text-[10px] text-surface-400">{txt.saveNote}</span>
      </div>
    </div>
  );
}
