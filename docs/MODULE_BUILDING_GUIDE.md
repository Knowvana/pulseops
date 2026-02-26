# PulseOps — Module Building Guide

> **Version**: 2.0 | **Last Updated**: 2025  
> **Audience**: Developers building new modules for the PulseOps platform

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [Step 1: Define the Module Manifest](#step-1-define-the-module-manifest)
4. [Step 2: Create Backend Models](#step-2-create-backend-models)
5. [Step 3: Create the Module Schema File](#step-3-create-the-module-schema-file)
6. [Step 4: Create Demo Data](#step-4-create-demo-data)
7. [Step 5: Create API Routes](#step-5-create-api-routes)
8. [Step 6: Register in Backend](#step-6-register-in-backend)
9. [Step 7: Create Frontend Module](#step-7-create-frontend-module)
10. [Step 8: Register in Frontend](#step-8-register-in-frontend)
11. [Step 9: Add UI Text and Log Messages](#step-9-add-ui-text-and-log-messages)
12. [Naming Conventions](#naming-conventions)
13. [Checklist](#checklist)

---

## 1. Architecture Overview

PulseOps is a **modular, Kubernetes-ready** operations platform. Modules are self-contained features that can be **enabled/disabled at runtime** via the Admin Modules Page. All module state is persisted in the database (`system_modules` table), ensuring pod restarts do not lose configuration.

```
┌──────────────────────────────────────────────────────┐
│                    PulseOps Platform                  │
├──────────────┬───────────────────────────────────────┤
│  Admin       │  Module A  │  Module B  │  Module N   │
│  (Core)      │  (enabled) │  (disabled)│  (enabled)  │
├──────────────┴───────────────────────────────────────┤
│              Shared Components & Services             │
│    Modal, StepWizard, SettingsConfig, ApiClient       │
├──────────────────────────────────────────────────────┤
│              Express API + Sequelize ORM              │
├──────────────────────────────────────────────────────┤
│                    PostgreSQL                         │
└──────────────────────────────────────────────────────┘
```

**Key principles:**
- All updateable configuration in the **database**, never in files
- Core system tables: `system_*` prefix
- Module tables: `modulename_*` prefix (e.g., `shiftroaster_shifts`)
- All UI text externalized to JSON config files
- All log messages from centralized JSON — no inline strings
- Imports use `@` aliases — no relative paths

---

## 2. Module Structure

Each module spans both the API and UI projects:

### Backend (`pulseops-api/src/modules/<modulename>/`)
```
modules/
  <modulename>/
    models/
      ModuleNameModel1.js    ← Sequelize model (table: modulename_model1)
      ModuleNameModel2.js
    routes/
      moduleNameRoutes.js    ← Express router with all CRUD endpoints
    schema.js                ← createSchema(), verifySchema(), loadDemoData()
    demoData.json            ← Sample data for the StepWizard demo step
```

### Frontend (`pulseops-ui/src/modules/<modulename>/`)
```
modules/
  <modulename>/
    ModuleNameApp.jsx        ← Root module component (orchestrator)
    components/
      ModuleDashboard.jsx    ← Dashboard view
      ModuleConfig.jsx       ← Configuration view
      ModuleReports.jsx      ← Reports view
    utils/
      moduleUtils.js         ← Module-specific utility functions
```

---

## Step 1: Define the Module Manifest

Add your module to `pulseops-api/src/config/modules.json`:

```json
{
  "moduleId": "mymodule",
  "name": "My Module",
  "description": "Description of what the module does",
  "version": "1.0.0",
  "isCore": false,
  "enabled": false,
  "initialized": false,
  "order": 2,
  "icon": "Wrench",
  "roles": ["admin", "manager", "user"],
  "requiredTables": [
    "mymodule_config",
    "mymodule_items",
    "mymodule_logs"
  ],
  "schemaVersion": "1.0.0"
}
```

**Fields:**
- `moduleId` — Unique identifier, lowercase, no spaces. Used as the DB key
- `isCore` — `false` for all non-admin modules. Core modules cannot be disabled
- `enabled/initialized` — Always `false` for new modules. Set via StepWizard at runtime
- `requiredTables` — Must match exactly the `tableName` in your Sequelize models
- `roles` — Which user roles can see this module in the TopNav

---

## Step 2: Create Backend Models

Create Sequelize models in `pulseops-api/src/modules/<modulename>/models/`.

**Table naming**: `<modulename>_<entity>` (e.g., `mymodule_items`)

```javascript
// pulseops-api/src/modules/mymodule/models/MyModuleItem.js
import { DataTypes } from 'sequelize';
import sequelize from '../../../core/database/sequelize.js';

const MyModuleItem = sequelize.define('MyModuleItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  // ... your fields
}, {
  tableName: 'mymodule_items',  // MUST use modulename_ prefix
  timestamps: true,
});

export default MyModuleItem;
```

**Register models** in `pulseops-api/src/core/database/models/index.js`:
```javascript
import MyModuleItem from '../../../modules/mymodule/models/MyModuleItem.js';

// Add to models object and exports
```

---

## Step 3: Create the Module Schema File

Every module MUST have a `schema.js` that exports these functions:

```javascript
// pulseops-api/src/modules/mymodule/schema.js
import MyModuleItem from './models/MyModuleItem.js';
import logger, { logMessages } from '../../core/logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const demoData = require('./demoData.json');

export async function createSchema() {
  await MyModuleItem.sync({ alter: true });
  return { success: true, tables: ['mymodule_items'] };
}

export async function verifySchema() {
  // Query information_schema to check if tables exist
  // Return { initialized: boolean, existing: [], missing: [] }
}

export async function loadDemoData() {
  // Seed from demoData.json using findOrCreate
  // Return { success: true, counts: { items: N } }
}

export async function wipeModuleData() {
  await MyModuleItem.destroy({ where: {}, truncate: true, cascade: true });
  return { success: true };
}

export function getRequiredTables() {
  return ['mymodule_items'];
}
```

---

## Step 4: Create Demo Data

Create `pulseops-api/src/modules/<modulename>/demoData.json`:

```json
{
  "items": [
    { "name": "Sample Item 1", "status": "active" },
    { "name": "Sample Item 2", "status": "active" }
  ]
}
```

This data is loaded when an admin clicks "Load Demo Data" in the StepWizard.

---

## Step 5: Create API Routes

Create `pulseops-api/src/modules/<modulename>/routes/mymoduleRoutes.js`:

```javascript
import { Router } from 'express';
import { MyModuleItem } from '../../../core/database/models/index.js';
import { authenticate, authorize } from '../../../core/middleware/auth.js';
import logger, { msg, logMessages } from '../../../core/logger.js';

const router = Router();

// GET    /api/mymodule/items       — List items
// POST   /api/mymodule/items       — Create item
// PUT    /api/mymodule/items/:id   — Update item
// DELETE /api/mymodule/items/:id   — Delete item

router.get('/items', authenticate, async (req, res, next) => {
  try {
    const items = await MyModuleItem.findAll();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// ... more CRUD endpoints

export default router;
```

---

## Step 6: Register in Backend

### 6a. Add routes to `app.js`

```javascript
import mymoduleRoutes from './modules/mymodule/routes/mymoduleRoutes.js';
// ...
app.use(`${prefix}/mymodule`, mymoduleRoutes);
```

### 6b. Register schema in `moduleRoutes.js`

In `pulseops-api/src/core/routes/moduleRoutes.js`, add a case to `getModuleSchema()`:

```javascript
case 'mymodule': {
  const mod = await import('../../modules/mymodule/schema.js');
  MODULE_SCHEMAS[moduleId] = mod.default || mod;
  return MODULE_SCHEMAS[moduleId];
}
```

### 6c. Add log messages to `config/logs.json`

```json
"mymodule": {
  "itemCreated": "MyModule item created: {name}",
  "itemDeleted": "MyModule item deleted: {id}"
}
```

---

## Step 7: Create Frontend Module

### 7a. Root Component (`MyModuleApp.jsx`)

```jsx
import React from 'react';
import { SettingsConfig, ConfirmationModal, EmptyState, ApiClient } from '@shared';
import uiText from '@shared/config/uiElementsText.json';

export default function MyModuleApp({ activeTab = 'dashboard', onTabChange }) {
  // State, effects, handlers
  
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <MyModuleDashboard />;
      case 'config':    return <MyModuleConfig />;
      case 'settings':  return renderSettingsView();
      default:          return null;
    }
  };

  return <div className="space-y-4 animate-fade-in">{renderContent()}</div>;
}
```

### 7b. Settings — Use Universal SettingsConfig

```jsx
const renderSettingsView = () => {
  const tabs = [
    { id: 'data', label: 'Data Management', icon: Database, content: <MyModuleSettings /> },
    { id: 'config', label: 'Module Config', icon: Sliders, content: <MyModuleConfigTab /> },
  ];
  return (
    <SettingsConfig
      title="My Module Settings"
      subtitle="Module configuration"
      icon={SettingsIcon}
      tabs={tabs}
      defaultTab="data"
    />
  );
};
```

---

## Step 8: Register in Frontend

### 8a. Add nav items to `PlatformDashboard.jsx`

```javascript
const MYMODULE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'config', label: 'Configuration', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];
```

Add to `sideNavItems` useMemo:
```javascript
if (activeModuleId === 'mymodule') return MYMODULE_NAV_ITEMS;
```

Add to render logic:
```jsx
{activeModuleId === 'mymodule' && <MyModuleApp activeTab={activeView} onTabChange={setActiveView} />}
```

### 8b. Add icon mapping

```javascript
const MODULE_ICON_MAP = {
  Shield, Calendar, Wrench, // Add your module's icon
};
```

---

## Step 9: Add UI Text and Log Messages

### `uiElementsText.json` — Add a section for your module:

```json
"myModule": {
  "header": { "title": "My Module", "subtitle": "Module description" },
  "navItems": { "dashboard": "Dashboard", "config": "Configuration" },
  "dashboard": { "title": "Module Dashboard", "subtitle": "Overview" }
}
```

### `logs.json` (UI) — Add module log messages:

```json
"mymodule": {
  "itemCreated": "Item created in MyModule",
  "dataLoaded": "MyModule data loaded"
}
```

### `messages.json` — Add user-facing messages:

```json
"mymodule": {
  "deleteConfirm": "Are you sure you want to delete this item?"
}
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module ID | lowercase, no spaces | `shiftroaster` |
| DB table | `modulename_entity` | `shiftroaster_shifts` |
| Core table | `system_entity` | `system_users` |
| Sequelize model | PascalCase | `ShiftRoasterShift` |
| API route prefix | `/api/modulename` | `/api/roster` |
| Frontend folder | `modules/modulename/` | `modules/roster/` |
| Root component | `ModuleNameApp.jsx` | `ShiftRosterApp.jsx` |
| Config key | camelCase | `shiftRoster.maxShiftsPerWeek` |

---

## Checklist

Use this checklist when building a new module:

### Backend
- [ ] Module manifest added to `config/modules.json`
- [ ] Sequelize models created with `modulename_` table prefix
- [ ] Models registered in `core/database/models/index.js`
- [ ] `schema.js` created with `createSchema`, `verifySchema`, `loadDemoData`, `wipeModuleData`
- [ ] `demoData.json` created with sample data
- [ ] API routes created with full CRUD + auth + RBAC
- [ ] Routes registered in `app.js`
- [ ] Schema registered in `moduleRoutes.js` switch case
- [ ] Log messages added to `config/logs.json`

### Frontend
- [ ] Root module component (`ModuleApp.jsx`) created
- [ ] Sub-views created (Dashboard, Config, Reports, Settings)
- [ ] Settings uses universal `SettingsConfig` component
- [ ] Nav items added to `PlatformDashboard.jsx`
- [ ] Module icon added to `MODULE_ICON_MAP`
- [ ] Render logic added for the module in `PlatformDashboard`
- [ ] UI text added to `uiElementsText.json`
- [ ] Log messages added to `logs.json` (UI)
- [ ] User messages added to `messages.json`
- [ ] All imports use `@` aliases — no relative paths

### Testing
- [ ] Module appears in Admin → Modules Page
- [ ] StepWizard flows work: Check → Initialize → Demo Data → Enable
- [ ] Module appears in TopNav after enabling
- [ ] Module disappears from TopNav after disabling
- [ ] All CRUD operations work via API
- [ ] Settings page renders correctly with SettingsConfig
- [ ] Pod restart preserves enabled/disabled state

---

## Reference: Existing Module — ShiftRoaster

The **ShiftRoaster** module is the reference implementation. Study these files:

### Backend
- `pulseops-api/src/config/modules.json` — Module manifest
- `pulseops-api/src/modules/roster/models/` — 5 Sequelize models
- `pulseops-api/src/modules/roster/schema.js` — Schema lifecycle
- `pulseops-api/src/modules/roster/demoData.json` — Sample data
- `pulseops-api/src/modules/roster/routes/rosterRoutes.js` — Full CRUD API

### Frontend
- `pulseops-ui/src/modules/roster/ShiftRosterApp.jsx` — Root component
- `pulseops-ui/src/modules/roster/components/` — Sub-views
- `pulseops-ui/src/modules/admin/PlatformDashboard.jsx` — Registration
- `pulseops-ui/src/modules/admin/views/ModulesPage.jsx` — Enable/disable UI
