// ============================================================================
// ServiceNow Module Manifest — PulseOps UI
//
// PURPOSE: Self-describing manifest for the ServiceNow Integration module.
// The module registry discovers this manifest and uses it to drive navigation,
// view rendering, and settings/config tabs — NO module-specific code lives
// in core.
//
// ARCHITECTURE: Plug-and-play module contract. Follows the same pattern as
// the roster and admin manifests. Exports a manifest object with id, navItems,
// views, configTabs, and settingsTabs. The platform renders it generically.
//
// CONTRACT:
//   id          — unique module identifier (must match DB moduleId "servicenow")
//   name        — display name for TopNav
//   icon        — Lucide icon component
//   roles       — which user roles can access this module
//   order       — sort order in TopNav (lower = left)
//   isCore      — if true, always visible (cannot be disabled)
//   defaultView — which navItem id to show on module load
//   navItems    — array of { id, label, icon } for the left SideNav
//   getViews    — function(props) returning { viewId: ReactElement } map
//   getConfigTabs — function() returning tabs[] for Configuration view
//   getSettingsTabs — function() returning tabs[] for Settings view
//
// USED BY:
//   - src/modules/moduleRegistry.js — imported and registered
//   - src/core/App.jsx              — rendered when module is active
//
// INTEGRATION FLOW:
//   moduleRegistry imports this manifest → TopNav shows module →
//   SideNav shows navItems → main area renders getViews/getConfigTabs
// ============================================================================
import React from 'react';
import { Headset, LayoutDashboard, BarChart3, Sliders, Wifi, Clock, Timer, Database, RefreshCw, ActivitySquare, TestTube } from 'lucide-react';
import uiText from '@shared/config/uiElementsText.json';

import ServiceNowProvider from '@modules/servicenow/context/ServiceNowContext';
import ServiceNowDashboard from '@modules/servicenow/components/ServiceNowDashboard';
import ServiceNowDailyMonitoring from '@modules/servicenow/components/ServiceNowDailyMonitoring';
import ServiceNowTestIncidents from '@modules/servicenow/components/ServiceNowTestIncidents';
import ServiceNowReports from '@modules/servicenow/components/ServiceNowReports';
import ServiceNowConfigConnection from '@modules/servicenow/components/ServiceNowConfigConnection';
import ServiceNowConfigSla from '@modules/servicenow/components/ServiceNowConfigSla';
import ServiceNowConfigBusinessHours from '@modules/servicenow/components/ServiceNowConfigBusinessHours';
import ServiceNowDataManagement from '@modules/servicenow/components/ServiceNowDataManagement';
import ServiceNowConfigSyncSchedule from '@modules/servicenow/components/ServiceNowConfigSyncSchedule';
import ServiceNowConfigSettings from '@modules/servicenow/components/ServiceNowConfigSettings';

const navTxt = uiText.serviceNow.navItems;
const cfgTxt = uiText.serviceNow.config;

const servicenowManifest = {
  id: 'servicenow',
  name: 'ServiceNow',
  shortName: 'SNOW',
  description: 'ServiceNow ITSM integration — incidents, RITMs, changes, SLA tracking, and compliance reporting',
  icon: Headset,
  roles: ['admin', 'manager', 'user'],
  enabled: false,
  isCore: false,
  order: 2,
  defaultView: 'dashboard',

  navItems: [
    { id: 'dashboard', label: navTxt.dashboard || 'Dashboard', icon: LayoutDashboard },
    { id: 'daily_monitoring', label: navTxt.dailyMonitoring || 'Daily Monitoring', icon: ActivitySquare },
    { id: 'test_incidents', label: navTxt.testIncidents || 'Test Incidents', icon: TestTube },
    { id: 'reports', label: navTxt.reports || 'Reports', icon: BarChart3 },
    { id: 'config', label: navTxt.config || 'Configuration', icon: Sliders },
  ],

  getViews: () => ({
    dashboard: (
      <ServiceNowProvider>
        <ServiceNowDashboard />
      </ServiceNowProvider>
    ),
    daily_monitoring: (
      <ServiceNowProvider>
        <ServiceNowDailyMonitoring />
      </ServiceNowProvider>
    ),
    test_incidents: (
      <ServiceNowProvider>
        <ServiceNowTestIncidents />
      </ServiceNowProvider>
    ),
    reports: (
      <ServiceNowProvider>
        <ServiceNowReports />
      </ServiceNowProvider>
    ),
  }),

  getConfigTabs: () => [
    {
      id: 'sn_connection',
      label: cfgTxt.tabs.connection,
      icon: Wifi,
      content: (
        <ServiceNowProvider>
          <ServiceNowConfigConnection />
        </ServiceNowProvider>
      ),
    },
    {
      id: 'sn_sync_schedule',
      label: cfgTxt.tabs.syncSchedule,
      icon: RefreshCw,
      content: (
        <ServiceNowProvider>
          <ServiceNowConfigSyncSchedule />
        </ServiceNowProvider>
      ),
    },
    {
      id: 'sn_settings',
      label: cfgTxt.tabs.snSettings,
      icon: Sliders,
      content: (
        <ServiceNowProvider>
          <ServiceNowConfigSettings />
        </ServiceNowProvider>
      ),
    },
    {
      id: 'sn_sla',
      label: cfgTxt.tabs.sla,
      icon: Clock,
      content: (
        <ServiceNowProvider>
          <ServiceNowConfigSla />
        </ServiceNowProvider>
      ),
    },
    {
      id: 'sn_business_hours',
      label: cfgTxt.tabs.businessHours,
      icon: Timer,
      content: (
        <ServiceNowProvider>
          <ServiceNowConfigBusinessHours />
        </ServiceNowProvider>
      ),
    },
    {
      id: 'sn_data_management',
      label: cfgTxt.tabs.dataManagement,
      icon: Database,
      separator: true,
      content: (
        <ServiceNowProvider>
          <ServiceNowDataManagement />
        </ServiceNowProvider>
      ),
    },
  ],

  configDefaultTab: 'sn_connection',
  configTitle: cfgTxt.pageTitle,
  configSubtitle: cfgTxt.pageSubtitle,
  configIcon: Sliders,
};

export default servicenowManifest;
