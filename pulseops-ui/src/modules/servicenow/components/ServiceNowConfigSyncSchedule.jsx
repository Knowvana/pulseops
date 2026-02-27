// ============================================================================
// ServiceNow Sync Schedule Configuration — PulseOps UI
//
// PURPOSE: Configure automatic synchronization of data from ServiceNow APIs
// to the local PulseOps database. Allows setting sync interval, enabling/
// disabling sync, and choosing which data types to sync.
//
// ARCHITECTURE: Reads/writes sync schedule config via ServiceNowService.
// Uses shared components and uiElementsText.json for all labels.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Bug, FileText, GitPullRequest, Power, PowerOff
} from 'lucide-react';
import { Card, Button, Logger } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';

const txt = uiText.serviceNow.config.syncSchedule;

export default function ServiceNowConfigSyncSchedule() {
  const [config, setConfig] = useState({
    syncEnabled: false,
    syncIntervalMinutes: 60,
    syncIncidents: true,
    syncRitms: true,
    syncChanges: true,
  });
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, statusRes] = await Promise.all([
        ServiceNowService.getSyncSchedule(),
        ServiceNowService.getSyncStatus(),
      ]);
      if (schedRes.success && schedRes.data) {
        setConfig(schedRes.data);
      }
      if (statusRes.success && statusRes.data) {
        setSchedulerStatus(statusRes.data);
      }
    } catch (err) {
      Logger.error('SyncSchedule', 'Failed to load sync schedule', { error: err.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await ServiceNowService.saveSyncSchedule(config);
      if (res.success) {
        setSaveResult({ type: 'success', message: txt.saved });
        fetchSchedule();
      } else {
        setSaveResult({ type: 'error', message: res.error || txt.saveFailed });
      }
    } catch (err) {
      setSaveResult({ type: 'error', message: txt.saveFailed });
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  const intervalOptions = [15, 30, 60, 120, 240, 480, 720, 1440];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-base font-bold text-surface-800 mb-1">{txt.title}</h3>
        <p className="text-sm text-surface-400">{txt.description}</p>
      </div>

      {/* Scheduler Status */}
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">{txt.schedulerStatus}</h4>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            schedulerStatus?.running
              ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
              : 'text-surface-400 bg-surface-50 border-surface-200'
          }`}>
            {schedulerStatus?.running ? <Power size={12} /> : <PowerOff size={12} />}
            {schedulerStatus?.running ? txt.running : txt.stopped}
          </span>
        </div>
        {schedulerStatus?.lastSyncTime && (
          <p className="text-xs text-surface-500">
            {txt.lastSync}: {new Date(schedulerStatus.lastSyncTime).toLocaleString()}
          </p>
        )}
      </Card>

      {/* Enable/Disable */}
      <Card variant="flat" className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-surface-800">{txt.enableSync}</h4>
            <p className="text-xs text-surface-400 mt-0.5">
              {config.syncEnabled ? 'Auto sync is enabled' : 'Auto sync is disabled'}
            </p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, syncEnabled: !prev.syncEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.syncEnabled ? 'bg-brand-500' : 'bg-surface-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
              config.syncEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </Card>

      {/* Sync Interval */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.syncInterval}</h4>
        <div className="grid grid-cols-4 gap-2">
          {intervalOptions.map(mins => (
            <button
              key={mins}
              onClick={() => setConfig(prev => ({ ...prev, syncIntervalMinutes: mins }))}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                config.syncIntervalMinutes === mins
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
              }`}
            >
              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
            </button>
          ))}
        </div>
      </Card>

      {/* Sync Targets */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">{txt.syncTargets}</h4>
        <div className="space-y-3">
          {[
            { key: 'syncIncidents', label: txt.syncIncidents, icon: Bug },
            { key: 'syncRitms', label: txt.syncRitms, icon: FileText },
            { key: 'syncChanges', label: txt.syncChanges, icon: GitPullRequest },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-50 border border-surface-100">
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-surface-500" />
                <span className="text-sm font-medium text-surface-700">{label}</span>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  config[key] ? 'bg-brand-500' : 'bg-surface-300'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                  config[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? uiText.common.saving : txt.saveButton}
        </Button>
        {saveResult && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            saveResult.type === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {saveResult.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {saveResult.message}
          </span>
        )}
      </div>
    </div>
  );
}
