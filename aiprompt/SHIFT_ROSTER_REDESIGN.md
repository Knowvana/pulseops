# Shift Roster Module — Architect Redesign Plan

## Current Problems

1. **No DB integration on dashboard** — ShiftRosterApp starts with empty arrays, never fetches from DB
2. **Demo data loads into memory only** — `loadRosterDemo()` loads from a static JSON into React state, not into DB
3. **Schedule is ephemeral** — Generated roster lives only in React state, lost on page reload
4. **Config is disconnected** — RosterConfig component manages employees/shifts/leaves in local state, not persisted to DB
5. **Mixed concerns** — ShiftRosterApp manages both data state and UI orchestration
6. **No proper CRUD flow** — Employees, shifts, leaves should be managed via API with proper create/edit/delete
7. **Current shift header relies on API** — But dashboard data doesn't

## Target Architecture

### Data Flow (DB-First)

```
                API (Express + Sequelize)
                ┌─────────────────────────────────┐
                │ /api/roster/shifts       (CRUD)  │
                │ /api/roster/employees    (CRUD)  │
                │ /api/roster/leaves       (CRUD)  │
                │ /api/roster/schedule/:y/:m (R/W) │
                │ /api/roster/stats        (Read)  │
                │ /api/roster/current-shift (Read)  │
                │ /api/roster/config       (R/W)  │
                └──────────┬──────────────────────┘
                           │
                    React Frontend
                ┌──────────┴──────────────────────┐
                │  RosterDataProvider (Context)    │
                │  - employees, shifts, leaves     │
                │  - schedule, config, stats       │
                │  - CRUD actions (API calls)      │
                │  - Auto-fetch on mount           │
                │  - Refresh after mutations       │
                └──────────┬──────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    Dashboard         Config          Reports
    (read-only)    (CRUD forms)    (read-only)
```

### Module Pages

| Page | Purpose | Key Components |
|------|---------|---------------|
| **Dashboard** | Current shift, monthly calendar, stats cards | ShiftCalendar, StatsBar, CurrentShiftBanner |
| **Employees** | CRUD employee list with search, filters | EmployeeTable, EmployeeForm (modal), ImportCSV |
| **Shifts** | Manage shift definitions (label, time, color) | ShiftList, ShiftForm (modal) |
| **Schedule** | Generate + view + edit monthly roster | ScheduleGrid, GenerateWizard, DragDropEditor |
| **Leaves** | Manage leave requests with approval flow | LeaveCalendar, LeaveForm, ApprovalQueue |
| **Reports** | Analytics: coverage, fairness, compliance | CoverageChart, FairnessReport, ExportCSV |
| **Settings** | Module config, data management | SettingsConfig (reuse shared) |

### Navigation Items (moduleRegistry)

```js
navItems: [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'employees', label: 'Employees',  icon: Users },
  { id: 'shifts',    label: 'Shifts',     icon: Clock },
  { id: 'schedule',  label: 'Schedule',   icon: Calendar },
  { id: 'leaves',    label: 'Leaves',     icon: CalendarOff },
  { id: 'reports',   label: 'Reports',    icon: BarChart3 },
  { id: 'settings',  label: 'Settings',   icon: Settings },
]
```

### File Structure

```
modules/roster/
├── ShiftRosterApp.jsx          — Root component (thin orchestrator)
├── context/
│   └── RosterDataProvider.jsx  — Data context with API integration
├── views/
│   ├── RosterDashboard.jsx     — Dashboard with stats + calendar
│   ├── EmployeesPage.jsx       — Employee CRUD
│   ├── ShiftsPage.jsx          — Shift definition CRUD
│   ├── SchedulePage.jsx        — Schedule generation + editor
│   ├── LeavesPage.jsx          — Leave management
│   ├── ReportsPage.jsx         — Analytics + export
│   └── RosterSettingsPage.jsx  — Module settings
├── components/
│   ├── ShiftCalendar.jsx       — Monthly calendar grid
│   ├── EmployeeTable.jsx       — Sortable/filterable table
│   ├── EmployeeForm.jsx        — Add/edit employee modal
│   ├── ShiftForm.jsx           — Add/edit shift modal
│   ├── LeaveForm.jsx           — Add/edit leave modal
│   ├── ScheduleGrid.jsx        — Roster grid (editable)
│   ├── GenerateWizard.jsx      — Step-by-step roster generation
│   ├── StatsBar.jsx            — Stats summary cards
│   └── CurrentShiftBanner.jsx  — Live current shift header
└── utils/
    └── rosterUtils.js          — Schedule generation algorithm
```

### Key Design Decisions

1. **RosterDataProvider** — Single React Context that fetches all data from API on mount and exposes CRUD actions. All child pages consume this context instead of managing their own state.

2. **DB-first always** — Every create/update/delete goes through the API. Local state is updated from API response, never independently.

3. **Schedule persistence** — Generated schedule is saved to `shiftroaster_schedules` table via `POST /api/roster/schedule/:year/:month`. On dashboard load, schedule is fetched from DB.

4. **Employee/Shift CRUD** — Dedicated pages with proper forms, validation, and table views. No more inline editing in a combined config page.

5. **Leave management** — Separate page with calendar view and approval workflow.

6. **Reuse shared components** — All modals use `ActionModal`, all forms use `Card`/`Button` from `@shared`, settings use `SettingsConfig`.

### Implementation Order

1. Create `RosterDataProvider` context with API integration
2. Refactor `ShiftRosterApp` to use context (thin orchestrator)
3. Build `EmployeesPage` with CRUD (table + modal form)
4. Build `ShiftsPage` with CRUD (card list + modal form)
5. Build `SchedulePage` with generation + grid editor + save to DB
6. Build `LeavesPage` with calendar + form
7. Refactor `RosterDashboard` to use context (read-only)
8. Build `ReportsPage` with analytics
9. Update nav items in moduleRegistry
10. Clean up old components

### Backend Changes Needed

- Add `PUT /api/roster/shifts/:id` and `DELETE /api/roster/shifts/:id`
- Add `PUT /api/roster/employees/:id` and `DELETE /api/roster/employees/:id`
- Add `PUT /api/roster/leaves/:id` and `DELETE /api/roster/leaves/:id`
- Add `POST /api/roster/schedule/:year/:month` to save generated schedule
- Add `GET /api/roster/stats` (already exists)
- Move all SQL queries to queries.json (already done for core, extend for roster)
