// ============================================================================
// Admin Module Manifest — PulseOps UI
//
// PURPOSE: Self-describing manifest for the Platform Admin module. The module
// registry discovers this manifest and uses it to drive navigation, view
// rendering, and settings tabs — NO module-specific code lives in core.
//
// ARCHITECTURE: Plug-and-play module contract. Any new module follows this
// same pattern: export a manifest object with id, navItems, views, and
// settingsTabs. The platform renders it generically.
//
// CONTRACT:
//   id          — unique module identifier (must match DB moduleId)
//   name        — display name for TopNav
//   icon        — Lucide icon component
//   roles       — which user roles can access this module
//   order       — sort order in TopNav (lower = left)
//   isCore      — if true, always visible (cannot be disabled)
//   defaultView — which navItem id to show on module load
//   navItems    — array of { id, label, icon } for the left SideNav
//   getViews    — function(props) returning { viewId: ReactElement } map
//   getSettingsTabs — function(props) returning tabs[] for SettingsConfig
// ============================================================================
import React from 'react';
import {
  LayoutDashboard, Users, ScrollText, Settings as SettingsIcon,
  Database, Shield, Layers, Package
} from 'lucide-react';
import uiText from '@shared/config/uiElementsText.json';
import AdminOverview from '@modules/admin/components/AdminOverview';
import AdminModules from '@modules/admin/components/AdminModules';
import AdminLogs from '@modules/admin/components/AdminLogs';
import AdminSettingsDatabase from '@modules/admin/components/AdminSettingsDatabase';
import AdminSettingsDbObjects from '@modules/admin/components/AdminSettingsDbObjects';
import AdminSettingsAuth from '@modules/admin/components/AdminSettingsAuth';
import AdminSettingsLogging from '@modules/admin/components/AdminSettingsLogging';

const navTxt = uiText.platformAdmin.navItems;
const settingsTxt = uiText.platformAdmin.settings;

const adminManifest = {
  id: 'platform_admin',
  name: 'Admin',
  shortName: 'Admin',
  description: 'System overview, user management, module management, settings, and logs',
  icon: Shield,
  roles: ['super_admin', 'admin'],
  enabled: true,
  isCore: true,
  order: 0,
  defaultView: 'overview',

  navItems: [
    { id: 'overview', label: navTxt.overview, icon: LayoutDashboard },
    { id: 'modules', label: navTxt.modules, icon: Package },
    { id: 'users', label: navTxt.users, icon: Users },
    { id: 'logs', label: navTxt.logs, icon: ScrollText },
    { id: 'settings', label: navTxt.settings, icon: SettingsIcon },
  ],

  getViews: ({ user, onNavigate, fetchModules }) => ({
    overview: <AdminOverview user={user} onNavigate={onNavigate} />,
    modules: <AdminModules onModulesChanged={fetchModules} />,
    users: <UsersPlaceholder />,
    logs: <AdminLogs />,
  }),

  getSettingsTabs: () => [
    { id: 'settings_db', label: settingsTxt.tabs.database, icon: Database, content: <AdminSettingsDatabase /> },
    { id: 'settings_objects', label: settingsTxt.tabs.dbObjects, icon: Layers, content: <AdminSettingsDbObjects /> },
    { id: 'settings_auth', label: settingsTxt.tabs.authentication, icon: Shield, content: <AdminSettingsAuth /> },
    { id: 'settings_logging', label: settingsTxt.tabs.logging, icon: ScrollText, content: <AdminSettingsLogging /> },
  ],

  settingsDefaultTab: 'settings_db',
  settingsTitle: settingsTxt.pageTitle,
  settingsSubtitle: settingsTxt.subtitle,
  settingsIcon: SettingsIcon,
};

export default adminManifest;

// ─── Inline placeholder (admin-specific, not shared) ─────────────────────────
function UsersPlaceholder() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Users size={48} className="text-surface-300 mb-4" />
        <h3 className="text-xl font-bold text-surface-800 mb-2">User Management</h3>
        <p className="text-surface-500 text-sm text-center max-w-md">
          Full user CRUD operations with role assignment and status management.
        </p>
      </div>
    </div>
  );
}
