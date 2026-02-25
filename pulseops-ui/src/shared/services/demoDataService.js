// ============================================================================
// DemoDataService — PulseOps UI
//
// PURPOSE: Provides demo/sample data loaders for each module.
// All demo data is stored in JSON files under shared/data/.
//
// ARCHITECTURE: Stateless utility. Each module calls its specific loader
// function. Data is read from JSON files — never hardcoded inline.
//
// USAGE:
//   import { loadRosterDemo } from '@shared';
//   const demoData = loadRosterDemo();
// ============================================================================
import rosterDemoData from '@shared/data/rosterDemo.json';

export function loadRosterDemo() {
  return {
    employees: rosterDemoData.employees.map(e => ({ ...e })),
    shifts: rosterDemoData.shifts.map(s => ({ ...s })),
  };
}
