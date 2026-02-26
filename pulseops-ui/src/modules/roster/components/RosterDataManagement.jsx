// ============================================================================
// RosterDataManagement Component — PulseOps UI
//
// PURPOSE: Data management panel for the Shift Roster module.
// Provides actions to load demo data, remove demo data, and perform hard reset.
//
// ARCHITECTURE: Module-specific component. Consumes handleDataAction from
// RosterContext via useRoster(). The context handles the actual logic.
// ============================================================================
import React, { useState } from 'react';
import { Database, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Logger } from '@shared';
import uiText from '@shared/config/uiElementsText.json';
import messages from '@shared/config/messages.json';
import { useRoster } from '@modules/roster/context/RosterContext';

const rosterTxt = uiText.shiftRoster?.dataManagement || {};

export default function RosterDataManagement() {
  const { handleDataAction } = useRoster();
  const [expandedAction, setExpandedAction] = useState(null);

  const handleDataActionClick = (type) => {
    const actions = {
      load_demo: {
        type: 'load_demo',
        title: rosterTxt.actions?.loadDemoTitle || 'Load Demo Data',
        desc: messages.confirm?.loadDemoData || 'Load sample workforce data into the roster?',
      },
      remove_demo: {
        type: 'remove_demo',
        title: rosterTxt.actions?.removeDemoTitle || 'Remove Demo Data',
        desc: messages.confirm?.removeDemoData || 'Remove all demo data from the roster?',
      },
      hard_reset: {
        type: 'hard_reset',
        title: rosterTxt.actions?.hardResetTitle || 'Hard Reset',
        desc: messages.confirm?.hardReset || 'Permanently delete all roster data? This action cannot be undone.',
      },
    };

    Logger.info('RosterDataManagement', 'Data action initiated', { action: type });
    handleDataAction(actions[type]);
  };

  return (
    <div className="h-full flex flex-col p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
      <div className="mb-10">
        <h3 className="text-3xl font-extrabold text-surface-800 tracking-tight">
          {rosterTxt.title || 'Data Management'}
        </h3>
        <p className="text-surface-500 mt-2 font-medium">
          {rosterTxt.subtitle || 'Manage roster data, load samples, or reset the system'}
        </p>
      </div>

      <div className="grid gap-4 max-w-3xl">
        {/* Load Demo Data */}
        <div
          className="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm hover:border-brand-200 hover:shadow-md transition-all cursor-pointer"
          onClick={() => setExpandedAction(expandedAction === 'load_demo' ? null : 'load_demo')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-50 rounded-xl">
                <Database size={24} className="text-brand-600" />
              </div>
              <div>
                <h4 className="font-bold text-surface-800">
                  {rosterTxt.actions?.loadDemoTitle || 'Load Demo Data'}
                </h4>
                <p className="text-sm text-surface-500 mt-1">
                  {rosterTxt.actions?.loadDemoDesc || 'Populate roster with sample shifts, employees, and leaves'}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDataActionClick('load_demo');
              }}
              className="px-5 py-2.5 bg-brand-50 text-brand-700 font-bold rounded-xl hover:bg-brand-100 transition-colors whitespace-nowrap"
            >
              {rosterTxt.buttons?.execute || 'Execute'}
            </button>
          </div>
        </div>

        {/* Remove Demo Data */}
        <div
          className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => setExpandedAction(expandedAction === 'remove_demo' ? null : 'remove_demo')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-xl">
                <Trash2 size={24} className="text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-800">
                  {rosterTxt.actions?.removeDemoTitle || 'Remove Demo Data'}
                </h4>
                <p className="text-sm text-amber-600 mt-1">
                  {rosterTxt.actions?.removeDemoDesc || 'Delete all sample data while keeping custom data intact'}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDataActionClick('remove_demo');
              }}
              className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              {rosterTxt.buttons?.remove || 'Remove'}
            </button>
          </div>
        </div>

        {/* Hard Reset */}
        <div
          className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm bg-rose-50/30 hover:border-rose-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => setExpandedAction(expandedAction === 'hard_reset' ? null : 'hard_reset')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-50 rounded-xl">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-rose-800">
                  {rosterTxt.actions?.hardResetTitle || 'Hard Reset'}
                </h4>
                <p className="text-sm text-rose-600 mt-1">
                  {rosterTxt.actions?.hardResetDesc || 'Permanently delete all roster data. This action cannot be undone.'}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDataActionClick('hard_reset');
              }}
              className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 whitespace-nowrap"
            >
              {rosterTxt.buttons?.reset || 'Hard Reset'}
            </button>
          </div>
          {expandedAction === 'hard_reset' && (
            <div className="mt-4 p-4 bg-rose-100 border border-rose-300 rounded-lg">
              <p className="text-sm text-rose-800 font-semibold flex items-center gap-2">
                <AlertTriangle size={16} />
                {rosterTxt.warnings?.hardReset || 'Warning: This will delete all shifts, employees, leaves, and configurations. This action cannot be undone.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
