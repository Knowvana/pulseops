// ============================================================================
// Roster Module Manifest — PulseOps UI
//
// PURPOSE: Self-describing manifest for the Shift Roster module. The module
// registry discovers this manifest and uses it to drive navigation, view
// rendering, and settings tabs — NO module-specific code lives in core.
//
// ARCHITECTURE: Plug-and-play module contract. Follows the SAME pattern as
// the Admin manifest. Declares getViews() + getSettingsTabs(). All roster
// views consume shared state from RosterContext via useRoster().
//
// CONTRACT: Same as admin/manifest.jsx — see that file for field docs.
// ============================================================================
import React from 'react';
import {
  Calendar, BarChart3, Sliders, Settings as SettingsIcon, Database
} from 'lucide-react';
import uiText from '@shared/config/uiElementsText.json';
import RosterProvider from '@modules/roster/context/RosterContext';
import RosterDashboard from '@modules/roster/components/RosterDashboard';
import RosterReports from '@modules/roster/components/RosterReports';
import RosterConfig from '@modules/roster/components/RosterConfig';
import RosterDataManagement from '@modules/roster/components/RosterDataManagement';

const navTxt = uiText.shiftRoster?.navItems || {};
const settingsTxt = uiText.shiftRoster?.settings || {};
const configTxt = uiText.shiftRoster?.config || {};

const rosterManifest = {
  id: 'shiftroaster',
  name: 'Shift Roaster',
  shortName: 'Roster',
  description: 'Workforce scheduling, shift allocation, compliance reporting, and resource management',
  icon: Calendar,
  roles: ['admin', 'manager', 'user'],
  enabled: false,
  isCore: false,
  order: 1,
  defaultView: 'dashboard',

  navItems: [
    { id: 'dashboard', label: navTxt.dashboard || 'Dashboard', icon: Calendar },
    { id: 'reports', label: navTxt.reports || 'Reports', icon: BarChart3 },
    { id: 'config', label: navTxt.config || 'Configuration', icon: Sliders },
    { id: 'settings', label: navTxt.settings || 'Settings', icon: SettingsIcon },
  ],

  // Wrapper component that provides RosterContext to all views
  ViewWrapper: RosterProvider,

  getViews: ({ onNavigate }) => ({
    dashboard: <RosterDashboard onNavigateToConfig={() => onNavigate('config')} />,
    reports: <RosterReports />,
  }),

  // Configuration tabs — uses the shared SettingsConfig pattern
  getConfigTabs: () => [
    { id: 'shift-config', label: configTxt.tabs?.shiftConfig || 'Shift Configuration', icon: Sliders, content: <RosterConfig showOnlyShifts /> },
    { id: 'resource-config', label: configTxt.tabs?.resourceConfig || 'Resource Configuration', icon: Calendar, content: <RosterConfig showOnlyResourcePool /> },
    { id: 'leave-config', label: configTxt.tabs?.leaveConfig || 'Leave Configuration', icon: Calendar, content: <RosterConfig showOnlyLeaves /> },
  ],
  configTitle: configTxt.pageTitle || 'Roster Configuration',
  configSubtitle: configTxt.pageSubtitle || 'Manage shifts, employees, leaves, and resources',
  configIcon: Sliders,
  configDefaultTab: 'shift-config',

  // Settings tabs — uses the shared SettingsConfig pattern
  getSettingsTabs: () => [
    { id: 'data-management', label: settingsTxt.tabs?.dataManagement || 'Data Management', icon: Database, content: <RosterDataManagement /> },
  ],
  settingsTitle: settingsTxt.pageTitle || 'Roster Settings',
  settingsSubtitle: settingsTxt.pageSubtitle || 'Manage roster data and system configuration',
  settingsIcon: SettingsIcon,
  settingsDefaultTab: 'data-management',
};

export default rosterManifest;
