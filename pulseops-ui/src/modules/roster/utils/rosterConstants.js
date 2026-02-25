// ============================================================================
// Roster Constants — PulseOps UI
//
// PURPOSE: Shared constants for the Shift Roster Planner module.
// Defines color palettes for shift types and weekday labels.
//
// ARCHITECTURE: Module-specific constants. Imported only within the
// roster module — not exported via @shared.
// ============================================================================

export const COLORS = [
  { label: 'Yellow', value: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { label: 'Blue', value: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { label: 'Green', value: 'bg-green-100 text-green-800 border-green-200' },
  { label: 'Red', value: 'bg-red-100 text-red-800 border-red-200' },
  { label: 'Purple', value: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Pink', value: 'bg-pink-100 text-pink-800 border-pink-200' },
  { label: 'Gray', value: 'bg-gray-100 text-gray-800 border-gray-200' },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
