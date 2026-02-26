// ============================================================================
// RosterSettingsPage — PulseOps UI (ShiftRoaster Module)
//
// PURPOSE: Settings and data management page for the Shift Roster module.
// Uses the universal SettingsConfig component with left vertical tabs.
// Provides data management actions: Load Demo Data, Remove Demo Data, Hard Reset.
//
// ARCHITECTURE: Wrapper component that uses SettingsConfig layout.
// All settings content is passed as tab content. Parent manages state.
//
// USED BY:
//   - ShiftRosterApp.jsx → renders when activeTab === 'settings'
//
// INTEGRATION FLOW:
//   ShiftRosterApp renders RosterSettingsPage → SettingsConfig provides layout →
//   user clicks tabs → settings content switches
// ============================================================================
import React from 'react';
import { Settings as SettingsIcon, Database, HardDrive } from 'lucide-react';
import { SettingsConfig } from '@shared';
import RosterDataManagement from '@modules/roster/components/RosterDataManagement';
import uiText from '@shared/config/uiElementsText.json';

const rosterTxt = uiText.shiftRoster?.settings || {};

export default function RosterSettingsPage({ onDataAction }) {
  const tabs = [
    {
      id: 'data-management',
      label: rosterTxt.tabs?.dataManagement || 'Data Management',
      icon: Database,
      content: (
        <RosterDataManagement onDataAction={onDataAction} />
      ),
    },
  ];

  return (
    <SettingsConfig
      title={rosterTxt.pageTitle || 'Roster Settings'}
      subtitle={rosterTxt.pageSubtitle || 'Manage roster data and system configuration'}
      icon={SettingsIcon}
      tabs={tabs}
      defaultTab="data-management"
      className="h-full"
    />
  );
}
