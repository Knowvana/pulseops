// ============================================================================
// ServiceNow Configuration Settings — PulseOps UI
//
// PURPOSE: Configuration UI for selecting report columns per record type
// (Incidents, RITMs, Changes) and configuring sync filters (Assignment Group,
// From Date). Settings are persisted to the config_settings table via API.
//
// ARCHITECTURE: Uses ServiceNowService for API calls. Reads UI text from
// uiElementsText.json. Loads current settings on mount, allows toggling
// columns and editing filters, then saves all changes in one batch.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, LoadingSpinner, Logger } from '@shared';
import ServiceNowService from '@modules/servicenow/services/servicenowService';
import uiText from '@shared/config/uiElementsText.json';
import { Save, Loader2, Columns3, Filter, CheckSquare, Square } from 'lucide-react';

const txt = uiText.serviceNow.snConfig;

export default function ServiceNowConfigSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const [availableColumns, setAvailableColumns] = useState({ incidents: [], ritms: [], changes: [] });
  const [selectedColumns, setSelectedColumns] = useState({ incidents: [], ritms: [], changes: [] });
  const [columnLabels, setColumnLabels] = useState({});
  const [syncFilter, setSyncFilter] = useState({ assignmentGroup: '', fromDate: '' });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ServiceNowService.getConfigSettings();
      if (res.success && res.data) {
        const d = res.data;
        if (d.available_columns) {
          setAvailableColumns({
            incidents: safeParseJSON(d.available_columns.incidentAvailableColumns, []),
            ritms: safeParseJSON(d.available_columns.ritmAvailableColumns, []),
            changes: safeParseJSON(d.available_columns.changeAvailableColumns, []),
          });
        }
        if (d.report_columns) {
          setSelectedColumns({
            incidents: safeParseJSON(d.report_columns.incidentColumns, []),
            ritms: safeParseJSON(d.report_columns.ritmColumns, []),
            changes: safeParseJSON(d.report_columns.changeColumns, []),
          });
        }
        if (d.column_labels) {
          setColumnLabels(safeParseJSON(d.column_labels.columnLabels, {}));
        }
        if (d.sync_filter) {
          setSyncFilter({
            assignmentGroup: d.sync_filter.assignmentGroup || '',
            fromDate: d.sync_filter.fromDate || '',
          });
        }
      }
    } catch (err) {
      Logger.error('ServiceNowConfigSettings', 'Failed to load settings', { error: err.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const toggleColumn = useCallback((recordType, col) => {
    setSelectedColumns(prev => {
      const current = prev[recordType] || [];
      const updated = current.includes(col) ? current.filter(c => c !== col) : [...current, col];
      return { ...prev, [recordType]: updated };
    });
    setSaveResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const settings = [
        { category: 'report_columns', key: 'incidentColumns', value: JSON.stringify(selectedColumns.incidents) },
        { category: 'report_columns', key: 'ritmColumns', value: JSON.stringify(selectedColumns.ritms) },
        { category: 'report_columns', key: 'changeColumns', value: JSON.stringify(selectedColumns.changes) },
        { category: 'sync_filter', key: 'assignmentGroup', value: syncFilter.assignmentGroup },
        { category: 'sync_filter', key: 'fromDate', value: syncFilter.fromDate },
      ];
      const res = await ServiceNowService.saveConfigSettings(settings);
      if (res.success) {
        setSaveResult({ success: true, message: txt.saved });
      } else {
        setSaveResult({ success: false, message: res.error || txt.saveFailed });
      }
    } catch (err) {
      setSaveResult({ success: false, message: txt.saveFailed });
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 4000);
  }, [selectedColumns, syncFilter]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Report Columns Section */}
      <Card variant="flat" className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Columns3 size={18} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-surface-800">{txt.reportColumnsTitle}</h3>
        </div>
        <p className="text-xs text-surface-500 mb-4">{txt.reportColumnsDesc}</p>

        {[
          { key: 'incidents', label: txt.incidentColumnsLabel, available: availableColumns.incidents },
          { key: 'ritms', label: txt.ritmColumnsLabel, available: availableColumns.ritms },
          { key: 'changes', label: txt.changeColumnsLabel, available: availableColumns.changes },
        ].map(({ key, label, available }) => (
          <div key={key} className="mb-4">
            <h4 className="text-xs font-semibold text-surface-700 mb-2">{label}</h4>
            <div className="flex flex-wrap gap-1.5">
              {available.map(col => {
                const isSelected = (selectedColumns[key] || []).includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggleColumn(key, col)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-brand-50 text-brand-700 border-brand-200 shadow-sm'
                        : 'bg-surface-50 text-surface-500 border-surface-200 hover:bg-surface-100'
                    }`}
                  >
                    {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                    {columnLabels[col] || col}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* Sync Filter Section */}
      <Card variant="flat" className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={18} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-surface-800">{txt.syncFilterTitle}</h3>
        </div>
        <p className="text-xs text-surface-500 mb-4">{txt.syncFilterDesc}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{txt.assignmentGroupLabel}</label>
            <input
              type="text"
              value={syncFilter.assignmentGroup}
              onChange={(e) => { setSyncFilter(prev => ({ ...prev, assignmentGroup: e.target.value })); setSaveResult(null); }}
              placeholder={txt.assignmentGroupPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{txt.fromDateLabel}</label>
            <input
              type="date"
              value={syncFilter.fromDate}
              onChange={(e) => { setSyncFilter(prev => ({ ...prev, fromDate: e.target.value })); setSaveResult(null); }}
              placeholder={txt.fromDatePlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Save Result */}
      {saveResult && (
        <div className={`p-3 rounded-lg text-sm ${
          saveResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveResult.message}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? txt.saving : txt.saveButton}
        </Button>
      </div>
    </div>
  );
}

function safeParseJSON(val, fallback) {
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
  } catch {
    return fallback;
  }
}
