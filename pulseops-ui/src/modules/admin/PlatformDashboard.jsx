// ============================================================================
// PlatformDashboard — PulseOps UI
//
// PURPOSE: Platform Admin module root component. Orchestrates the admin
// dashboard with sidebar navigation and multiple views: Overview, Users,
// Logs, and Settings (with 4 sub-tabs). Uses AppShell for the unified layout.
//
// ARCHITECTURE: Thin orchestrator — delegates all view rendering to
// dedicated view components in ./views/. SideNav items driven by
// uiElementsText.json. No inline text or hardcoded UI strings.
// ============================================================================
import React, { useState, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Users, ScrollText, Settings as SettingsIcon,
  Database, Shield, Layers
} from 'lucide-react';
import AppShell from '@core/AppShell';
import { getModulesForRole } from '@modules/moduleRegistry';
import Logger from '@shared/services/logger';
import uiText from '@shared/config/uiElementsText.json';
import appConfig from '@shared/config/app.json';
import AdminOverview from '@modules/admin/views/AdminOverview';
import LogsViewer from '@modules/admin/views/LogsViewer';
import SettingsDatabase from '@modules/admin/views/SettingsDatabase';
import SettingsDbObjects from '@modules/admin/views/SettingsDbObjects';
import SettingsAuth from '@modules/admin/views/SettingsAuth';
import SettingsLogging from '@modules/admin/views/SettingsLogging';

const navTxt = uiText.platformAdmin.navItems;
const settingsTxt = uiText.platformAdmin.settings;

const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: navTxt.overview,  icon: LayoutDashboard },
  { id: 'users',    label: navTxt.users,     icon: Users },
  { id: 'logs',     label: navTxt.logs,      icon: ScrollText },
  { id: 'settings', label: navTxt.settings,  icon: SettingsIcon },
];

const SETTINGS_TABS = [
  { id: 'settings_db',      label: settingsTxt.tabs.database,       icon: Database },
  { id: 'settings_objects', label: settingsTxt.tabs.dbObjects,      icon: Layers },
  { id: 'settings_auth',    label: settingsTxt.tabs.authentication, icon: Shield },
  { id: 'settings_logging', label: settingsTxt.tabs.logging,        icon: ScrollText },
];

export default function PlatformDashboard({ user, onLogout }) {
  const availableModules = useMemo(() => getModulesForRole(user?.role || 'admin'), [user?.role]);
  const [activeModuleId, setActiveModuleId] = useState('platform_admin');
  const [activeView, setActiveView] = useState('overview');
  const [settingsTab, setSettingsTab] = useState('settings_db');

  const handleNavSelect = useCallback((id) => {
    setActiveView(id);
    if (id === 'settings') {
      setSettingsTab('settings_db');
    }
  }, []);

  const handleSideNavSelect = useCallback((id) => {
    setActiveView(id);
    if (id === 'settings' && !settingsTab.startsWith('settings_')) {
      setSettingsTab('settings_db');
    }
  }, [settingsTab]);

  const renderSettingsView = () => {
    return (
      <div className="flex h-full gap-8 animate-fade-in items-start">
        {/* Settings Sub-navigation */}
        <div className="w-64 shrink-0 sticky top-0">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-surface-900">{settingsTxt.pageTitle}</h2>
            <p className="text-sm text-surface-500 mt-1">{settingsTxt.subtitle}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-white text-brand-700 shadow-sm border border-surface-200' 
                      : 'text-surface-600 hover:bg-surface-200/50 hover:text-surface-900 border border-transparent'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-brand-600' : 'text-surface-400'} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-surface-200 shadow-sm p-8">
          {settingsTab === 'settings_db' && <SettingsDatabase />}
          {settingsTab === 'settings_objects' && <SettingsDbObjects />}
          {settingsTab === 'settings_auth' && <SettingsAuth />}
          {settingsTab === 'settings_logging' && <SettingsLogging />}
        </div>
      </div>
    );
  };

  const renderView = () => {
    switch (activeView) {
      case 'overview': return <AdminOverview user={user} onNavigate={handleNavSelect} />;
      case 'users':    return <UsersPlaceholder />;
      case 'logs':     return <LogsViewer />;
      case 'settings': return renderSettingsView();
      default:         return <AdminOverview user={user} onNavigate={handleNavSelect} />;
    }
  };

  return (
    <AppShell
      appName={appConfig.appName || 'PulseOps'}
      modules={availableModules}
      activeModuleId={activeModuleId}
      onSwitchModule={setActiveModuleId}
      onLogout={onLogout}
      onSystemAdmin={() => { setActiveView('overview'); }}
      user={user}
      sideNavTitle={uiText.platformAdmin.sideNav.title}
      sideNavItems={ADMIN_NAV_ITEMS}
      activeSideNavItemId={activeView}
      onSelectSideNavItem={handleSideNavSelect}
      logger={Logger}
    >
      {renderView()}
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
          User CRUD operations will be available once the backend API is connected.
          Users are managed in the PostgreSQL database.
        </p>
      </div>
    </div>
  );
}
