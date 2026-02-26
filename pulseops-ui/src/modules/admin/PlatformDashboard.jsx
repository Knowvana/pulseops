// ============================================================================
// PlatformDashboard — PulseOps UI
//
// PURPOSE: GENERIC root orchestrator for the authenticated application.
// Manages module switching, sidebar navigation, and view rendering.
// Fetches enabled modules from the database (via /api/modules) and
// MERGES them with static manifests from moduleRegistry.js.
//
// ARCHITECTURE: ZERO module-specific code lives here. All module data
// (navItems, views, settingsTabs, icons) comes from each module's
// manifest.js file. This component reads manifests generically.
//
// PLUG-AND-PLAY: Adding a new module requires ZERO changes to this file.
// Just create a manifest.js in the module folder and register it in
// moduleRegistry.js — this component discovers it automatically.
//
// USED BY:
//   - App.jsx → renders when user is authenticated
//
// INTEGRATION FLOW:
//   App.jsx authenticates → PlatformDashboard mounts →
//   fetches modules from DB → merges with manifests →
//   builds TopNav + SideNav → renders active module view
// ============================================================================
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import AppShell from '@core/AppShell';
import { SettingsConfig } from '@shared';
import Logger from '@shared/services/logger';
import ModuleService from '@shared/services/moduleService';
import appConfig from '@shared/config/app.json';
import { getAllManifests, getManifestById } from '@modules/moduleRegistry';

export default function PlatformDashboard({ user, onLogout }) {
  const [dbModules, setDbModules] = useState([]);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeView, setActiveView] = useState(null);

  // ─── Fetch modules from database on mount ──────────────────────────────────
  const fetchModules = useCallback(async () => {
    try {
      const data = await ModuleService.getAll();
      setDbModules(data);
    } catch (err) {
      Logger.error('PlatformDashboard', 'Failed to fetch modules', { error: err.message });
    }
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  // ─── Merge DB state with static manifests ──────────────────────────────────
  // Core modules (isCore=true) are always shown. Non-core modules appear only
  // if the DB says they're enabled AND the user's role is allowed.
  const availableModules = useMemo(() => {
    const allManifests = getAllManifests();

    return allManifests
      .map(manifest => {
        const dbEntry = dbModules.find(m => m.moduleId === manifest.id);
        const isEnabled = manifest.isCore || (dbEntry?.enabled ?? manifest.enabled);
        const roles = dbEntry?.roles || manifest.roles;
        const userRole = user?.role || 'user';
        const hasAccess = roles.includes(userRole) || roles.includes('admin') && userRole === 'super_admin';

        return {
          id: manifest.id,
          name: dbEntry?.name || manifest.name,
          shortName: manifest.shortName,
          description: dbEntry?.description || manifest.description,
          icon: manifest.icon,
          roles,
          enabled: isEnabled,
          isCore: manifest.isCore,
          order: dbEntry?.order ?? manifest.order,
          hasAccess,
        };
      })
      .filter(m => m.enabled && m.hasAccess)
      .sort((a, b) => a.order - b.order);
  }, [dbModules, user?.role]);

  // ─── Set initial active module and view on first load ──────────────────────
  useEffect(() => {
    if (availableModules.length > 0 && activeModuleId === null) {
      const firstModule = availableModules[0];
      const manifest = getManifestById(firstModule.id);
      setActiveModuleId(firstModule.id);
      setActiveView(manifest?.defaultView || 'overview');
    }
  }, [availableModules, activeModuleId]);

  // ─── Get active manifest ───────────────────────────────────────────────────
  const activeManifest = useMemo(() => {
    return getManifestById(activeModuleId);
  }, [activeModuleId]);

  // ─── SideNav items from active manifest ────────────────────────────────────
  const sideNavItems = useMemo(() => {
    return activeManifest?.navItems || [];
  }, [activeManifest]);

  // ─── Module switching — reads defaultView from manifest ────────────────────
  const handleSwitchModule = useCallback((moduleId) => {
    const manifest = getManifestById(moduleId);
    setActiveModuleId(moduleId);
    setActiveView(manifest?.defaultView || 'overview');
  }, []);

  const handleSideNavSelect = useCallback((id) => {
    setActiveView(id);
  }, []);

  // ─── Generic SettingsConfig renderer (reused for settings + config views) ───
  const renderTabsView = useCallback((getTabs, title, subtitle, icon, defaultTab) => {
    if (!getTabs) return null;
    const tabs = getTabs();
    return (
      <SettingsConfig
        title={title}
        subtitle={subtitle}
        icon={icon || SettingsIcon}
        tabs={tabs}
        defaultTab={defaultTab || tabs[0]?.id}
      />
    );
  }, []);

  // ─── Generic view renderer — reads views from manifest ─────────────────────
  const renderModuleContent = useCallback(() => {
    if (!activeManifest) return null;

    // Settings view — uses shared SettingsConfig with manifest's settingsTabs
    if (activeView === 'settings' && activeManifest.getSettingsTabs) {
      return renderTabsView(
        activeManifest.getSettingsTabs,
        activeManifest.settingsTitle,
        activeManifest.settingsSubtitle,
        activeManifest.settingsIcon,
        activeManifest.settingsDefaultTab,
      );
    }

    // Config view — uses shared SettingsConfig with manifest's configTabs
    if (activeView === 'config' && activeManifest.getConfigTabs) {
      return renderTabsView(
        activeManifest.getConfigTabs,
        activeManifest.configTitle,
        activeManifest.configSubtitle,
        activeManifest.configIcon,
        activeManifest.configDefaultTab,
      );
    }

    // Standard view map
    if (activeManifest.getViews) {
      const views = activeManifest.getViews({
        user,
        onNavigate: handleSideNavSelect,
        fetchModules,
      });
      return views[activeView] || views[activeManifest.defaultView] || null;
    }

    return null;
  }, [activeManifest, activeView, user, handleSideNavSelect, fetchModules, renderTabsView]);

  // ─── Active module display name ────────────────────────────────────────────
  const activeModuleName = useMemo(() => {
    const mod = availableModules.find(m => m.id === activeModuleId);
    return mod?.name || '';
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
      {(() => {
        const content = renderModuleContent();
        const Wrapper = activeManifest?.ViewWrapper;
        return Wrapper ? <Wrapper>{content}</Wrapper> : content;
      })()}
    </AppShell>
  );
}
