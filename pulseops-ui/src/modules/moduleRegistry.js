// ============================================================================
// Module Registry — PulseOps UI (FALLBACK ONLY)
//
// PURPOSE: Static fallback module registry. The PRIMARY source of module
// data is now the database (system_modules table), fetched via the
// ModuleService → /api/modules endpoint in PlatformDashboard.jsx.
//
// This file serves as a FALLBACK if the API is unavailable during
// initial load or for offline development. It is NOT the source of
// truth for navigation — that is the database.
//
// ARCHITECTURE: PlatformDashboard.jsx fetches modules from the DB on
// mount via ModuleService.getAll(). The TopNav is driven by that data.
// This file is only used as a reference for module IDs and defaults.
//
// IMPORTANT: Module IDs here MUST match the moduleId in
// pulseops-api/src/config/modules.json exactly.
// ============================================================================
import { Calendar, Shield, LayoutDashboard, Users, ScrollText, Settings as SettingsIcon, BarChart3, Sliders, Package } from 'lucide-react';

const MODULE_MANIFESTS = [
  {
    id: 'platform_admin',
    name: 'Admin',
    shortName: 'Admin',
    description: 'System overview, user management, module management, settings, and logs',
    icon: Shield,
    roles: ['admin'],
    enabled: true,
    isCore: true,
    order: 0,
    componentPath: 'admin/PlatformDashboard',
    navItems: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'modules', label: 'Modules', icon: Package },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'logs', label: 'Logs', icon: ScrollText },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
  {
    id: 'shiftroaster',
    name: 'Shift Roaster',
    shortName: 'Roster',
    description: 'Workforce scheduling, shift allocation, compliance reporting, and resource management',
    icon: Calendar,
    roles: ['admin', 'manager', 'user'],
    enabled: false,
    isCore: false,
    order: 1,
    componentPath: 'roster/ShiftRosterApp',
    navItems: [
      { id: 'dashboard', label: 'Dashboard', icon: Calendar },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'config', label: 'Configuration', icon: Sliders },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

/**
 * Get all modules accessible by a specific role.
 * @param {string} role - User role (admin, manager, user)
 * @returns {Array} Filtered and sorted module manifests
 */
export function getModulesForRole(role) {
  return MODULE_MANIFESTS
    .filter(m => m.enabled && m.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get a specific module manifest by ID.
 * @param {string} moduleId
 * @returns {Object|null}
 */
export function getModuleById(moduleId) {
  return MODULE_MANIFESTS.find(m => m.id === moduleId) || null;
}

/**
 * Get all registered module manifests (regardless of role).
 * @returns {Array}
 */
export function getAllModules() {
  return MODULE_MANIFESTS.filter(m => m.enabled).sort((a, b) => a.order - b.order);
}

export default MODULE_MANIFESTS;
