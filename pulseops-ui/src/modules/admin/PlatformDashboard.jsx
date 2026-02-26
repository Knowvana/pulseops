// ============================================================================
// PlatformDashboard — PulseOps UI
//
// PURPOSE: Root orchestrator for the authenticated application. Manages
// module switching, sidebar navigation, and view rendering. Fetches
// enabled modules from the database (via /api/modules) to drive the
// TopNav dynamically — disabled modules are hidden.
//
// ARCHITECTURE: Thin orchestrator — delegates all view rendering to
// dedicated view components. Module list is fetched from the DB on mount
// and refreshed when modules are enabled/disabled. This ensures the
// navigation survives Kubernetes pod restarts.
//
// USED BY:
//   - App.jsx → renders when user is authenticated
//
// INTEGRATION FLOW:
//   App.jsx authenticates → PlatformDashboard mounts →
//   fetches modules from DB → builds TopNav + SideNav →
//   renders active module view
// ============================================================================
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LayoutDashboard, Users, ScrollText, Settings as SettingsIcon,
  Database, Shield, Layers, Package, Calendar,
  BarChart3, Sliders
} from 'lucide-react';
import AppShell from '@core/AppShell';
import { SettingsConfig } from '@shared';
import Logger from '@shared/services/logger';
import ModuleService from '@shared/services/moduleService';
import uiText from '@shared/config/uiElementsText.json';
import appConfig from '@shared/config/app.json';
import AdminOverview from '@modules/admin/views/AdminOverview';
import ModulesPage from '@modules/admin/views/ModulesPage';
import LogsViewer from '@modules/admin/views/LogsViewer';
import SettingsDatabase from '@modules/admin/views/SettingsDatabase';
import SettingsDbObjects from '@modules/admin/views/SettingsDbObjects';
import SettingsAuth from '@modules/admin/views/SettingsAuth';
import SettingsLogging from '@modules/admin/views/SettingsLogging';
import ShiftRosterApp from '@modules/roster/ShiftRosterApp';

const settingsTxt = uiText.platformAdmin.settings;

const MODULE_ICON_MAP = {
  platform_admin: Shield,
  shiftroaster: Calendar,
};

const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: uiText.platformAdmin.navItems.overview, icon: LayoutDashboard },
  { id: 'modules', label: uiText.platformAdmin.navItems.modules, icon: Package },
  { id: 'users', label: uiText.platformAdmin.navItems.users, icon: Users },
  { id: 'logs', label: uiText.platformAdmin.navItems.logs, icon: ScrollText },
  { id: 'settings', label: uiText.platformAdmin.navItems.settings, icon: SettingsIcon },
];

const ROSTER_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Calendar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'config', label: 'Configuration', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function PlatformDashboard({ user, onLogout }) {
  const [dbModules, setDbModules] = useState([]);
  const [activeModuleId, setActiveModuleId] = useState('platform_admin');
  const [activeView, setActiveView] = useState('overview');

  // Fetch modules from database on mount
  const fetchModules = useCallback(async () => {
    try {
      const data = await ModuleService.getAll();
      setDbModules(data);
    } catch (err) {
      Logger.error('PlatformDashboard', 'Failed to fetch modules', { error: err.message });
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  // Build TopNav module list — always include Admin, plus enabled DB modules
  const availableModules = useMemo(() => {
    const adminModule = {
      id: 'platform_admin',
      name: 'Admin',
      shortName: 'Admin',
      description: 'Platform Administration',
      icon: Shield,
      roles: ['super_admin', 'admin'],
      enabled: true,
      order: 0,
    };

    const enabledDbModules = dbModules
      .filter(m => m.enabled && m.moduleId !== 'platform_admin' && (m.roles || []).includes(user?.role || 'user'))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(m => ({
        id: m.moduleId,
        name: m.name,
        shortName: m.name,
        description: m.description,
        icon: MODULE_ICON_MAP[m.moduleId] || Package,
        roles: m.roles,
        enabled: m.enabled,
        order: m.order || 99,
      }));

    return [adminModule, ...enabledDbModules];
  }, [dbModules, user?.role]);

  // Get navItems for active module
  const sideNavItems = useMemo(() => {
    if (activeModuleId === 'platform_admin') return ADMIN_NAV_ITEMS;
    if (activeModuleId === 'shiftroaster') return ROSTER_NAV_ITEMS;
    return [];
  }, [activeModuleId]);

  const handleSwitchModule = useCallback((moduleId) => {
    setActiveModuleId(moduleId);
    if (moduleId === 'platform_admin') {
      setActiveView('overview');
    } else if (moduleId === 'shiftroaster') {
      setActiveView('dashboard');
    }
  }, []);

  const handleSideNavSelect = useCallback((id) => {
    setActiveView(id);
  }, []);

  const renderSettingsView = () => {
    const tabs = [
      { id: 'settings_db', label: settingsTxt.tabs.database, icon: Database, content: <SettingsDatabase /> },
      { id: 'settings_objects', label: settingsTxt.tabs.dbObjects, icon: Layers, content: <SettingsDbObjects /> },
      { id: 'settings_auth', label: settingsTxt.tabs.authentication, icon: Shield, content: <SettingsAuth /> },
      { id: 'settings_logging', label: settingsTxt.tabs.logging, icon: ScrollText, content: <SettingsLogging /> },
    ];
    return (
      <SettingsConfig
        title={settingsTxt.pageTitle}
        subtitle={settingsTxt.subtitle}
        icon={SettingsIcon}
        tabs={tabs}
        defaultTab="settings_db"
      />
    );
  };

  const renderAdminView = () => {
    switch (activeView) {
      case 'overview': return <AdminOverview user={user} onNavigate={handleSideNavSelect} />;
      case 'modules':  return <ModulesPage onModulesChanged={fetchModules} />;
      case 'users':    return <UsersPlaceholder />;
      case 'logs':     return <LogsViewer />;
      case 'settings': return renderSettingsView();
      default:         return <AdminOverview user={user} onNavigate={handleSideNavSelect} />;
    }
  };

  const activeModuleName = useMemo(() => {
    const mod = availableModules.find(m => m.id === activeModuleId);
    return mod?.name || 'Admin';
  }, [availableModules, activeModuleId]);

  return (
    <AppShell
      appName={appConfig.appName || 'PulseOps'}
      modules={availableModules}
      activeModuleId={activeModuleId}
      onSwitchModule={handleSwitchModule}
      onLogout={onLogout}
      onSystemAdmin={() => { handleSwitchModule('platform_admin'); }}
      user={user}
      sideNavTitle={activeModuleName}
      sideNavItems={sideNavItems}
      activeSideNavItemId={activeView}
      onSelectSideNavItem={handleSideNavSelect}
      logger={Logger}
    >
      {activeModuleId === 'shiftroaster' ? (
        <ShiftRosterApp activeTab={activeView} onTabChange={setActiveView} />
      ) : (
        renderAdminView()
      )}
    </AppShell>
  );
}

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
