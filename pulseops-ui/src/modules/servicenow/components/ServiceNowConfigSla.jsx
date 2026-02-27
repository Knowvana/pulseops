// ============================================================================
// ServiceNow SLA Configuration — PulseOps UI
//
// PURPOSE: Configuration form for defining contract-level SLA targets for
// incident response time, resolution time, and RITM fulfillment time by
// priority level. Allows saving and updating SLA configurations.
//
// ARCHITECTURE: Uses ServiceNowContext for state and actions. Reads UI text
// from uiElementsText.json. SLA values are in minutes. Each priority level
// has separate response and resolution targets for both incidents and RITMs.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useServiceNow } from '@modules/servicenow/context/ServiceNowContext';
import { Logger } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import { Save, Loader2, Clock, AlertCircle } from 'lucide-react';

const txt = uiText.serviceNow.config.sla;

const PRIORITIES = ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'];

const DEFAULT_INCIDENT_SLAS = PRIORITIES.map(p => ({
  priority: p,
  recordType: 'incident',
  responseTimeMinutes: p === '1 - Critical' ? 15 : p === '2 - High' ? 30 : p === '3 - Medium' ? 120 : 480,
  resolutionTimeMinutes: p === '1 - Critical' ? 120 : p === '2 - High' ? 360 : p === '3 - Medium' ? 960 : 2400,
}));

const DEFAULT_RITM_SLAS = PRIORITIES.map(p => ({
  priority: p,
  recordType: 'ritm',
  responseTimeMinutes: p === '1 - Critical' ? 30 : p === '2 - High' ? 60 : p === '3 - Medium' ? 240 : 480,
  resolutionTimeMinutes: p === '1 - Critical' ? 240 : p === '2 - High' ? 960 : p === '3 - Medium' ? 2400 : 4800,
}));

export default function ServiceNowConfigSla() {
  const { slaConfig, slaLoading, fetchSlaConfig, saveSlaConfig } = useServiceNow();

  const [incidentSlas, setIncidentSlas] = useState(DEFAULT_INCIDENT_SLAS);
  const [ritmSlas, setRitmSlas] = useState(DEFAULT_RITM_SLAS);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    fetchSlaConfig();
  }, [fetchSlaConfig]);

  useEffect(() => {
    if (slaConfig && slaConfig.length > 0) {
      const incConfigs = slaConfig.filter(s => s.recordType === 'incident');
      const ritmConfigs = slaConfig.filter(s => s.recordType === 'ritm');

      if (incConfigs.length > 0) {
        setIncidentSlas(PRIORITIES.map(p => {
          const existing = incConfigs.find(c => c.priority === p);
          return existing || DEFAULT_INCIDENT_SLAS.find(d => d.priority === p);
        }));
      }
      if (ritmConfigs.length > 0) {
        setRitmSlas(PRIORITIES.map(p => {
          const existing = ritmConfigs.find(c => c.priority === p);
          return existing || DEFAULT_RITM_SLAS.find(d => d.priority === p);
        }));
      }
    }
  }, [slaConfig]);

  const handleIncidentChange = useCallback((index, field, value) => {
    setIncidentSlas(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseInt(value) || 0 };
      return updated;
    });
    setSaveResult(null);
  }, []);

  const handleRitmChange = useCallback((index, field, value) => {
    setRitmSlas(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseInt(value) || 0 };
      return updated;
    });
    setSaveResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const allConfigs = [...incidentSlas, ...ritmSlas];
      const res = await saveSlaConfig(allConfigs);
      if (res.success) {
        setSaveResult({ success: true });
        Logger.info('ServiceNowConfigSla', txt.saved);
      } else {
        setSaveResult({ success: false, error: res.error || txt.saveFailed });
      }
    } finally {
      setSaving(false);
    }
  }, [incidentSlas, ritmSlas, saveSlaConfig]);

  function SlaTable({ title, slas, onChange, resolutionLabel }) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-surface-800">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{txt.priority}</th>
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{txt.responseTime}</th>
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{resolutionLabel || txt.resolutionTime}</th>
              </tr>
            </thead>
            <tbody>
              {slas.map((sla, idx) => (
                <tr key={sla.priority} className="border-b border-surface-100">
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      sla.priority.startsWith('1') ? 'bg-red-100 text-red-700' :
                      sla.priority.startsWith('2') ? 'bg-orange-100 text-orange-700' :
                      sla.priority.startsWith('3') ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {sla.priority}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="1"
                      value={sla.responseTimeMinutes}
                      onChange={(e) => onChange(idx, 'responseTimeMinutes', e.target.value)}
                      className="w-28 px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="1"
                      value={sla.resolutionTimeMinutes}
                      onChange={(e) => onChange(idx, 'resolutionTimeMinutes', e.target.value)}
                      className="w-28 px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-surface-900">{txt.title}</h2>
          <p className="text-sm text-surface-500">{txt.description}</p>
        </div>
      </div>

      {/* Incident SLAs */}
      <div className="bg-surface-50 rounded-xl border border-surface-100 p-4">
        <SlaTable
          title={txt.incidentSla}
          slas={incidentSlas}
          onChange={handleIncidentChange}
          resolutionLabel={txt.resolutionTime}
        />
      </div>

      {/* RITM SLAs */}
      <div className="bg-surface-50 rounded-xl border border-surface-100 p-4">
        <SlaTable
          title={txt.ritmSla}
          slas={ritmSlas}
          onChange={handleRitmChange}
          resolutionLabel={txt.fulfillmentTime}
        />
      </div>

      {/* Save Result */}
      {saveResult && (
        <div className={`p-3 rounded-lg text-sm ${
          saveResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveResult.success ? txt.saved : (saveResult.error || txt.saveFailed)}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 transition-all shadow-sm disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? uiText.common.saving : txt.saveButton}
      </button>
    </div>
  );
}
