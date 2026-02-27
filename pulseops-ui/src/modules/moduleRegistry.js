// ============================================================================
// Module Registry — PulseOps UI (Manifest-Driven)
//
// PURPOSE: Central registry that discovers and exposes module manifests.
// Each module declares a manifest.js with its id, navItems, views,
// settingsTabs, icon, etc. This registry imports them all and provides
// lookup APIs used by the platform shell (PlatformDashboard).
//
// PLUG-AND-PLAY: To add a new module, a developer only needs to:
//   1. Create modules/<name>/manifest.js following the manifest contract
//   2. Import and add it to the MANIFESTS array below
//   3. Done — the platform discovers it automatically
//
// The PRIMARY source of enabled/disabled state is the database
// (system_modules table, fetched via /api/modules). This registry
// provides the STATIC manifest data (navItems, views, icons, etc.)
// that the DB doesn't store. PlatformDashboard merges DB state with
// manifest data to build the full module list.
//
// IMPORTANT: Module IDs here MUST match the moduleId in
// pulseops-api/src/config/modules.json exactly.
// ============================================================================

// ─── Import all module manifests ─────────────────────────────────────────────
// To register a new module, import its manifest and add it to MANIFESTS.
import adminManifest from '@modules/admin/manifest.jsx';
import rosterManifest from '@modules/roster/manifest.jsx';
import servicenowManifest from '@modules/servicenow/manifest.jsx';

// ─── Master manifest list ────────────────────────────────────────────────────
const MANIFESTS = [
  adminManifest,
  rosterManifest,
  servicenowManifest,
];

/**
 * Get all registered manifests sorted by order.
 * @returns {Array}
 */
export function getAllManifests() {
  return [...MANIFESTS].sort((a, b) => a.order - b.order);
}

/**
 * Get a specific module manifest by ID.
 * @param {string} moduleId
 * @returns {Object|null}
 */
export function getManifestById(moduleId) {
  return MANIFESTS.find(m => m.id === moduleId) || null;
}

/**
 * Get all modules accessible by a specific role (static fallback).
 * @param {string} role - User role (admin, manager, user)
 * @returns {Array} Filtered and sorted module manifests
 */
export function getModulesForRole(role) {
  return MANIFESTS
    .filter(m => m.enabled && m.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all enabled module manifests (regardless of role).
 * @returns {Array}
 */
export function getAllModules() {
  return MANIFESTS.filter(m => m.enabled).sort((a, b) => a.order - b.order);
}

/**
 * Get a specific module manifest by ID (legacy compat).
 * @param {string} moduleId
 * @returns {Object|null}
 */
export function getModuleById(moduleId) {
  return getManifestById(moduleId);
}

export default MANIFESTS;
