// ============================================================================
// Module Registry — PulseOps UI
//
// PURPOSE: Central registry of all available modules. Drives the global
// navigation dynamically — no hardcoded module lists anywhere else.
// Each module exports a manifest with id, name, icon, component, and
// allowed roles. The registry filters modules by user role.
//
// ARCHITECTURE: Singleton registry. Modules self-register their manifests.
// The AppShell reads from this registry to build navigation. Role-based
// access is enforced here — users only see modules they have access to.
//
// USAGE:
//   import { getModulesForRole } from '@modules/moduleRegistry';
//   const modules = getModulesForRole('admin');
// ============================================================================
import { Calendar, Shield } from 'lucide-react';

const MODULE_MANIFESTS = [
  {
    id: 'shift_roster',
    name: 'Shift Roster Planner',
    shortName: 'Roster',
    description: 'Workforce scheduling, shift allocation, and compliance reporting',
    icon: Calendar,
    roles: ['admin', 'manager', 'user'],
    enabled: true,
    order: 1,
    // Lazy-loaded component reference (resolved in AppShell)
    componentPath: 'roster/ShiftRosterApp',
  },
  {
    id: 'platform_admin',
    name: 'Admin',
    shortName: 'Admin',
    description: 'System overview, user management, settings, and logs',
    icon: Shield,
    roles: ['admin'],
    enabled: true,
    order: 0,
    componentPath: 'admin/PlatformDashboard',
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
