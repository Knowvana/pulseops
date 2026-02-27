// ============================================================================
// ServiceNow Business Hours Configuration — PulseOps UI
//
// PURPOSE: Configuration form for defining business days and working hours
// for SLA calculations. Users can toggle which days are business days and
// set start/end times for each day.
//
// ARCHITECTURE: Uses ServiceNowContext for state and actions. Reads UI text
// from uiElementsText.json. Business hours are used by the SLA calculation
// engine to compute compliance based on working hours only.
//
// USED BY:
//   - src/modules/servicenow/manifest.jsx — rendered in Configuration tabs
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useServiceNow } from '@modules/servicenow/context/ServiceNowContext';
import { Logger } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import { Save, Loader2, Clock } from 'lucide-react';

const txt = uiText.serviceNow.config.businessHours;

const DEFAULT_HOURS = [
  { dayOfWeek: 0, dayName: 'Sunday', isBusinessDay: false, startTime: '00:00', endTime: '00:00' },
  { dayOfWeek: 1, dayName: 'Monday', isBusinessDay: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 2, dayName: 'Tuesday', isBusinessDay: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 3, dayName: 'Wednesday', isBusinessDay: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 4, dayName: 'Thursday', isBusinessDay: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 5, dayName: 'Friday', isBusinessDay: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 6, dayName: 'Saturday', isBusinessDay: false, startTime: '00:00', endTime: '00:00' },
];

export default function ServiceNowConfigBusinessHours() {
  const { businessHours, businessHoursLoading, fetchBusinessHours, saveBusinessHours } = useServiceNow();

  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    fetchBusinessHours();
  }, [fetchBusinessHours]);

  useEffect(() => {
    if (businessHours && businessHours.length > 0) {
      const merged = DEFAULT_HOURS.map(def => {
        const existing = businessHours.find(bh => bh.dayOfWeek === def.dayOfWeek);
        return existing ? {
          dayOfWeek: existing.dayOfWeek,
          dayName: existing.dayName,
          isBusinessDay: existing.isBusinessDay,
          startTime: existing.startTime,
          endTime: existing.endTime,
        } : def;
      });
      setHours(merged);
    }
  }, [businessHours]);

  const handleChange = useCallback((index, field, value) => {
    setHours(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setSaveResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await saveBusinessHours(hours);
      if (res.success) {
        setSaveResult({ success: true });
        Logger.info('ServiceNowConfigBusinessHours', txt.saved);
      } else {
        setSaveResult({ success: false, error: res.error || txt.saveFailed });
      }
    } finally {
      setSaving(false);
    }
  }, [hours, saveBusinessHours]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-surface-900">{txt.title}</h2>
          <p className="text-sm text-surface-500">{txt.description}</p>
        </div>
      </div>

      {/* Business Hours Table */}
      <div className="bg-surface-50 rounded-xl border border-surface-100 p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{txt.day}</th>
                <th className="text-center py-2 px-3 text-surface-500 font-medium">{txt.isBusinessDay}</th>
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{txt.startTime}</th>
                <th className="text-left py-2 px-3 text-surface-500 font-medium">{txt.endTime}</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((day, idx) => (
                <tr key={day.dayOfWeek} className={`border-b border-surface-100 ${!day.isBusinessDay ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-3">
                    <span className="text-sm font-medium text-surface-800">{day.dayName}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.isBusinessDay}
                        onChange={(e) => handleChange(idx, 'isBusinessDay', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500"></div>
                    </label>
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => handleChange(idx, 'startTime', e.target.value)}
                      disabled={!day.isBusinessDay}
                      className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:bg-surface-100 disabled:text-surface-400"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => handleChange(idx, 'endTime', e.target.value)}
                      disabled={!day.isBusinessDay}
                      className="px-3 py-1.5 rounded-lg border border-surface-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none disabled:bg-surface-100 disabled:text-surface-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
