// ============================================================================
// AppShell — PulseOps UI
//
// PURPOSE: The master layout that composes the entire authenticated UI.
// Composes: TopNav (top) + SideNav (left, collapsible) + MainContent (center)
//           + RightPanel (slide-out, right).
//
// ARCHITECTURE: Module-agnostic. Receives modules[], sideNavItems[],
// children for the active module's page content.
//
// Structure:
//   ┌──────────────────────────────────────────────────┐
//   │              TopNav (fixed)              [📊] [👤]│
//   ├────────┬────────────────────────┬───────────────┤
//   │        │                        │  RightPanel   │
//   │ SideNav│     Main Content       │  (slide-out)  │
//   │  (◀▶)  │     (children)         │  Logs|API|Bug │
//   │        │                        │               │
//   └────────┴────────────────────────┴───────────────┘
// ============================================================================
import React, { useState } from 'react';
import TopNav from '@shared/components/layouts/TopNav';
import SideNav from '@shared/components/layouts/SideNav';
import RightPanel from '@shared/components/layouts/RightPanel';

export default function AppShell({
  appName,
  modules = [],
  activeModuleId,
  onSwitchModule,
  onOpenSettings,
  onLogout,
  onSystemAdmin,
  user,

  sideNavTitle,
  sideNavItems = [],
  activeSideNavItemId,
  onSelectSideNavItem,
  sideNavCollapsed: controlledCollapsed,
  onToggleSideNav: controlledToggle,

  logger,
  children,
}) {
  const hasSideNav = sideNavItems.length > 0;

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const sideNavCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const onToggleSideNav = controlledToggle || (() => setInternalCollapsed((c) => !c));

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 font-sans text-surface-800">
      <TopNav
        appName={appName}
        modules={modules}
        activeModuleId={activeModuleId}
        onSwitchModule={onSwitchModule}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onSystemAdmin={onSystemAdmin}
        user={user}
        onToggleRightPanel={() => setIsRightPanelOpen((o) => !o)}
        isRightPanelOpen={isRightPanelOpen}
      />

      <div className="flex-1 flex min-h-0">
        {hasSideNav && (
          <SideNav
            title={sideNavTitle}
            items={sideNavItems}
            activeItemId={activeSideNavItemId}
            onSelectItem={onSelectSideNavItem}
            collapsed={sideNavCollapsed}
            onToggleCollapse={onToggleSideNav}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      <RightPanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        logger={logger}
      />
    </div>
  );
}
