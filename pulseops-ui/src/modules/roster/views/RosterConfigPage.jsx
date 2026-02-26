// ============================================================================
// RosterConfigPage — PulseOps UI (ShiftRoaster Module)
//
// PURPOSE: Configuration and settings page for the Shift Roster module.
// Uses the universal SettingsConfig component with left vertical tabs.
// Organizes configuration into logical sections: Shifts, Resources, Leaves,
// and Data Management.
//
// ARCHITECTURE: Wrapper component that uses SettingsConfig layout.
// All configuration content is passed as tab content. Parent manages state.
//
// USED BY:
//   - ShiftRosterApp.jsx → renders when activeTab === 'config'
//
// INTEGRATION FLOW:
//   ShiftRosterApp renders RosterConfigPage → SettingsConfig provides layout →
//   user clicks tabs → configuration content switches
// ============================================================================
import React from 'react';
import { Settings as SettingsIcon, Sliders, Users, CalendarX2 } from 'lucide-react';
import { SettingsConfig } from '@shared';
import RosterConfig from '@modules/roster/components/RosterConfig';
import uiText from '@shared/config/uiElementsText.json';

const rosterTxt = uiText.shiftRoster?.config || {};

export default function RosterConfigPage({
  shifts, setShifts,
  employees, setEmployees,
  leaves, setLeaves,
  onDataAction,
}) {
  const tabs = [
    {
      id: 'shift-config',
      label: rosterTxt.tabs?.shiftConfig || 'Shift Configuration',
      icon: Sliders,
      content: (
        <RosterConfig
          shifts={shifts}
          setShifts={setShifts}
          showOnlyShifts={true}
        />
      ),
    },
    {
      id: 'resource-config',
      label: rosterTxt.tabs?.resourceConfig || 'Resource Configuration',
      icon: Users,
      content: (
        <RosterConfig
          employees={employees}
          setEmployees={setEmployees}
          showOnlyResourcePool={true}
        />
      ),
    },
    {
      id: 'leave-config',
      label: rosterTxt.tabs?.leaveConfig || 'Leave Configuration',
      icon: CalendarX2,
      content: (
        <RosterConfig
          employees={employees}
          leaves={leaves}
          setLeaves={setLeaves}
          showOnlyLeaves={true}
        />
      ),
    },
  ];

  return (
    <SettingsConfig
      title={rosterTxt.pageTitle || 'Roster Configuration'}
      subtitle={rosterTxt.pageSubtitle || 'Manage shifts, employees, leaves, and resources'}
      icon={SettingsIcon}
      tabs={tabs}
      defaultTab="shift-config"
      className="h-full"
    />
  );
}
