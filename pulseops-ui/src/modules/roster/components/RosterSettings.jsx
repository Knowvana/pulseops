// ============================================================================
// RosterSettings Component — PulseOps UI
//
// PURPOSE: Data management panel for the Shift Roster module.
// Provides actions to load demo data or wipe all roster data.
//
// ARCHITECTURE: Module-specific component. Triggers confirmation actions
// via onDataAction callback — the parent handles the actual logic.
// ============================================================================
import React from 'react';
import { Database, Trash2 } from 'lucide-react';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';

const rosterTxt = uiText.shiftRoster;

export default function RosterSettings({ onDataAction }) {
  const handleDataActionClick = (type) => {
    const actions = {
      load_demo: { type: 'load_demo', title: 'Load Demo Data', desc: messages.confirm.loadDemoData },
      delete_all: { type: 'delete_all', title: 'Delete All Data', desc: messages.confirm.deleteAllRoster },
    };
    onDataAction(actions[type]);
  };

  return (
    <div className="h-full flex flex-col p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
      <div className="mb-10">
        <h3 className="text-3xl font-extrabold text-surface-800 tracking-tight">Data Management</h3>
        <p className="text-surface-500 mt-2 font-medium">Reset or load environmental states.</p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        {/* Load Demo Data */}
        <div className="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between hover:border-brand-200 transition-colors">
          <div>
            <h4 className="font-bold text-surface-800 flex items-center gap-2">
              <Database size={18} className="text-brand-600" /> Load Demo Data
            </h4>
            <p className="text-sm text-surface-500 mt-1">Populate roster with sample workforce.</p>
          </div>
          <button onClick={() => handleDataActionClick('load_demo')} className="px-5 py-2.5 bg-brand-50 text-brand-700 font-bold rounded-xl hover:bg-brand-100">Execute</button>
        </div>

        {/* Wipe Data */}
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between bg-rose-50/30 hover:border-rose-300 transition-colors">
          <div>
            <h4 className="font-bold text-rose-800 flex items-center gap-2">
              <Trash2 size={18} /> Hard Reset
            </h4>
            <p className="text-sm text-rose-600 mt-1">Permanently delete all roster data.</p>
          </div>
          <button onClick={() => handleDataActionClick('delete_all')} className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200">Wipe Data</button>
        </div>
      </div>
    </div>
  );
}
