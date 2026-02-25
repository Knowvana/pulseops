# PulseOps Refactor — Standalone Product Build

**Status:** In Progress (UI Replication — operationsmanager design replicated)  
**Last Updated:** Feb 25, 2026 6:45 PM UTC+05:30

---

## Project Overview

Refactoring a multi-tenant SaaS application into a **standalone Kubernetes-ready product** with separate frontend (`pulseops-ui`) and backend (`pulseops-api`) projects.

### Key Requirements
- ✅ Remove all multi-tenancy code
- ✅ Use React 18 + Vite + Tailwind CSS (frontend)
- ✅ Use Express + Sequelize ORM + PostgreSQL (backend)
- ✅ Externalize all configs to JSON files
- ✅ Centralize all log messages in JSON
- ✅ Single unified login page (role determined by backend)
- ✅ Module registry with role-based access
- ✅ Port ShiftRoster module from zen-ops-app
- ✅ Build Platform Admin module (no tenant management)
- ✅ Swagger UI for API documentation
- ✅ Kubernetes-ready (stateless, health probes, graceful shutdown)

---

## Project Structure

```
pulseops/
├── pulseops-ui/                    # React frontend
│   ├── src/
│   │   ├── core/                   # App orchestration
│   │   │   ├── App.jsx             # Auth state + routing → PlatformDashboard
│   │   │   └── AppShell.jsx        # TopNav + SideNav + RightPanel layout
│   │   ├── shared/
│   │   │   ├── config/             # JSON configs
│   │   │   │   ├── urls.json       # API endpoints
│   │   │   │   ├── logs.json       # Log message templates
│   │   │   │   ├── app.json        # App metadata, roles, modules
│   │   │   │   ├── messages.json   # Error/success/confirm messages only
│   │   │   │   ├── uiElementsText.json  # All UI text externalized
│   │   │   │   └── database.json   # DB connection config
│   │   │   ├── services/           # ApiClient, Logger, AuthService, DemoDataService
│   │   │   ├── components/         # Design system
│   │   │   │   ├── Card.jsx        # Container with variants
│   │   │   │   ├── Button.jsx      # Universal button with variants/sizes
│   │   │   │   ├── PageHeader.jsx  # Page title + subtitle + icon
│   │   │   │   ├── ProgressModal.jsx # Loading overlay with progress
│   │   │   │   ├── ActionModal.jsx # Confirm/info modals
│   │   │   │   ├── LoginForm.jsx   # Unified login page
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   ├── ProgressBar.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── ConfirmationModal.jsx
│   │   │   │   ├── SettingsModal.jsx
│   │   │   │   └── layouts/
│   │   │   │       ├── TopNav.jsx   # Global top navigation bar
│   │   │   │       ├── SideNav.jsx  # Collapsible left sidebar
│   │   │   │       ├── RightPanel.jsx # Slide-out right panel (logs/API/bug)
│   │   │   │       └── ModuleLayout.jsx
│   │   │   ├── data/               # Demo data (rosterDemo.json)
│   │   │   └── index.js            # Barrel export
│   │   ├── modules/
│   │   │   ├── moduleRegistry.js   # Dynamic module loading + RBAC
│   │   │   ├── roster/             # ShiftRoster module
│   │   │   │   ├── components/     # RosterDashboard, Config, Reports, Settings
│   │   │   │   ├── utils/          # rosterUtils, rosterConstants
│   │   │   │   └── ShiftRosterApp.jsx
│   │   │   └── admin/              # Platform Admin module
│   │   │       ├── PlatformDashboard.jsx  # Thin orchestrator
│   │   │       └── views/
│   │   │           ├── AdminOverview.jsx   # Health tiles, DB, activity, platform info
│   │   │           ├── LogsViewer.jsx      # System+API logs, detail panel
│   │   │           ├── SettingsDatabase.jsx # DB connection form
│   │   │           ├── SettingsDbObjects.jsx # Schema init, seed, wipe
│   │   │           ├── SettingsAuth.jsx     # JSON/DB auth switching
│   │   │           └── SettingsLogging.jsx  # Log levels, retention, modules
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Global styles
│   ├── vite.config.js              # Vite + alias config
│   ├── tailwind.config.js          # Tailwind theming + animations
│   ├── jsconfig.json               # Path aliases (@shared, @modules, @config, @core)
│   ├── index.html                  # HTML template
│   ├── Dockerfile                  # Multi-stage nginx build
│   ├── nginx.conf                  # SPA routing + API proxy
│   ├── package.json                # React 18, Vite, Tailwind, Lucide
│   └── .gitignore
│
├── pulseops-api/                   # Express backend
│   ├── src/
│   │   ├── config/                 # JSON configs (app, database, logs, swagger)
│   │   ├── core/
│   │   │   ├── database/
│   │   │   │   ├── sequelize.js    # Sequelize instance
│   │   │   │   ├── models/         # User, SystemConfig, RosterSchedule, RosterConfig
│   │   │   │   └── sync.js         # DB sync + seeding script
│   │   │   ├── middleware/         # auth, errorHandler, requestLogger
│   │   │   ├── routes/             # authRoutes, healthRoutes, databaseRoutes, userRoutes, configRoutes
│   │   │   └── logger.js           # Winston logger with JSON templates
│   │   ├── modules/
│   │   │   └── roster/
│   │   │       └── routes/         # rosterRoutes (CRUD for config + schedules)
│   │   ├── app.js                  # Express factory (middleware + routes)
│   │   └── server.js               # Entry point (DB connect, graceful shutdown)
│   ├── Dockerfile                  # Node.js non-root container
│   ├── package.json                # Express, Sequelize, pg, JWT, Swagger, Winston
│   └── .gitignore
│
├── docker-compose-pgsql.yml        # PostgreSQL + pgAdmin (for local dev)
└── aiprompt/
    └── PULSEOPS_REFACTOR.md        # This file
```

---

## Frontend (pulseops-ui) — Completed

### Architecture (Updated)
- **Single Login Page** → All users login via email/password. Backend returns JWT with role.
- **App.jsx** → Thin orchestrator: auth state → LoginForm or PlatformDashboard. Sets Logger user on login/logout.
- **AppShell.jsx** → Master layout: TopNav (top) + SideNav (left, collapsible) + Main Content (center) + RightPanel (slide-out right). Module-agnostic — receives props.
- **PlatformDashboard.jsx** → Admin module orchestrator. Owns AppShell, switches between AdminOverview, LogsViewer, Users, and Settings (4 sub-tabs).
- **Module Registry** → Central registry of available modules, filtered by user role.
- **Shared Services**:
  - **ApiClient** — HTTP + JWT + full request/response logging via Logger.logApiCall()
  - **Logger** — Separate system + API log buffers, subscriber pattern for real-time updates (RightPanel, LogsViewer)
  - **AuthService** — DB auth + JSON fallback + OIDC placeholder

### Design System Components
- **Card** — Container with variants (default, elevated, flat, glass)
- **Button** — Variants (primary, secondary, ghost, danger, success), sizes (xxs→lg), loading state
- **PageHeader** — Icon + title + subtitle + optional action buttons
- **ProgressModal** — Full-screen overlay with progress bar
- **ActionModal** — Confirm/cancel dialogs with variants
- **TopNav** — Global top bar with module tabs, user menu, role badge, right panel toggle
- **SideNav** — Collapsible left sidebar with active item highlighting
- **RightPanel** — Slide-out right panel with tabs: System Logs, API Calls, Report Issue

### Modules
1. **ShiftRoster** (Accessible to: manager, admin)
   - RosterDashboard: Interactive planner grid with inline editing
   - RosterConfig: Manage shifts, employees, planned leaves
   - RosterReports: Compliance and utilization reports
   - RosterSettings: Load demo data or wipe roster data
   - Utils: Roster generation algorithm, date key formatting

2. **Platform Admin** (Accessible to: admin only)
   - **AdminOverview**: Health tiles (system health, modules, users, logs), database summary (4-column), recent activity with search, platform information
   - **LogsViewer**: System logs + API logs tabs, sortable columns, level filtering, search, right detail panel with JSON payloads
   - **Users**: CRUD placeholder (pending backend integration)
   - **Settings — Database Configuration**: Form with host/port/db/user/pass/SSL, test connect, save
   - **Settings — Database Objects**: Schema init, default data seeding, wipe (danger zone)
   - **Settings — Authentication**: JSON vs Database auth switching, status display
   - **Settings — Logging**: Log levels, capture options, retention settings, module-wise toggles

### Config Files (JSON)
- `urls.json` → API base URL
- `logs.json` → Structured log message templates + logger config
- `app.json` → App metadata, roles, unified modules array
- `messages.json` → Error/success/confirm/info messages ONLY (no UI text)
- `uiElementsText.json` → ALL UI element text externalized by component
- `database.json` → PostgreSQL connection config

### Key Design Decisions
- **No relative imports** — All shared imports use `@shared` alias
- **No inline logs** — All log messages from `logs.json`
- **No inline UI text** — All text from `uiElementsText.json`
- **No hardcoded URLs** — All URLs from `urls.json`
- **Separation**: `messages.json` = errors/success/confirm; `uiElementsText.json` = all UI labels/titles
- **Stateless** — No session storage, JWT in localStorage
- **Kubernetes-ready** — Can be deployed as stateless nginx pod

---

## Backend (pulseops-api) — Completed

### Architecture
- **Express Factory** (app.js) → Creates app with middleware chain: helmet → cors → rate-limit → json → request-logger → routes → swagger → error-handler
- **Server Entry** (server.js) → Connects to DB, syncs models, seeds default admin, starts listening, handles graceful shutdown (SIGTERM/SIGINT)
- **Sequelize ORM** → PostgreSQL models: User (with bcrypt), SystemConfig, RosterSchedule, RosterConfig
- **JWT Auth** → Stateless token verification, role-based access control (RBAC)
- **Swagger UI** → Auto-generated OpenAPI docs at `/api/docs`

### Routes
1. **Auth** (`/api/auth`)
   - `POST /login` → Email/password auth, returns JWT + refresh token
   - `GET /me` → Current user profile (authenticated)
   - OIDC placeholder for future integration

2. **Health** (`/api/health`) — Public, no auth
   - `GET /` → General health check
   - `GET /liveness` → K8s liveness probe
   - `GET /readiness` → K8s readiness probe (includes DB check)

3. **Database** (`/api/database`) — Admin only
   - `GET /test-connection` → Test DB connectivity
   - `GET /schema-status` → Check if schema initialized (+ user counts, hasDefaultData)
   - `POST /create-schema` → Sync models, create tables
   - `POST /sync` → Alias for create-schema (used by frontend)
   - `GET /stats` → Table counts, user counts, active/inactive, config count
   - `POST /load-default-data` → Seed default admin user
   - `POST /load-demo-data` → Seed demo users
   - `POST /wipe` → Delete all data (destructive)

4. **Users** (`/api/users`) — Admin only
   - `GET /` → List all users
   - `GET /stats` → User statistics
   - `GET /:id` → Get user by ID
   - `POST /` → Create user
   - `PUT /:id` → Update user
   - `DELETE /:id` → Delete user

5. **Config** (`/api/config`) — Admin only
   - `POST /database` → Save database connection config to JSON file
   - `GET /auth` → Get current auth method (json/database)
   - `POST /auth` → Switch auth method
   - `GET /logging` → Get logging configuration
   - `POST /logging` → Save logging configuration
   - `GET /` → List all key-value config entries
   - `GET /:key` → Get config by key
   - `PUT /:key` → Upsert config
   - `DELETE /:key` → Delete config

6. **Roster** (`/api/roster`) — Authenticated
   - `GET /config` → Get active roster config
   - `PUT /config` → Save roster config
   - `GET /schedule/:year/:month` → Get schedule for month
   - `PUT /schedule/:year/:month` → Save schedule
   - `DELETE /schedule/:year/:month` → Delete schedule
   - `GET /schedules` → List all saved schedules

### Config Files (JSON)
- `app.json` → Port, JWT secret, CORS, rate-limit, default admin credentials
- `database.json` → PostgreSQL connection (host, port, user, password, pool config)
- `logs.json` → Structured log message templates (server, database, auth, user, roster, middleware)
- `swagger.json` → OpenAPI spec config

### Key Design Decisions
- **No multi-tenancy** → Single database, no tenant column
- **No inline logs** → All messages from `logs.json`
- **No hardcoded config** → All from JSON files, env var overrides supported
- **Stateless** → JWT tokens, no session state
- **Kubernetes-ready** → Health probes, graceful shutdown, non-root user in Docker
- **OIDC placeholder** → Ready for future OpenID Connect integration

---

## Database (PostgreSQL)

### Models
1. **User** (users table)
   - id (UUID, PK)
   - name, email (unique), password (bcrypt hashed)
   - role (enum: admin, manager, user)
   - status (enum: active, inactive)
   - timestamps (createdAt, updatedAt)

2. **SystemConfig** (system_config table)
   - id (UUID, PK)
   - key (unique), value (text)
   - category, description
   - timestamps

3. **RosterSchedule** (roster_schedules table)
   - id (UUID, PK)
   - year, month (unique together)
   - schedule (JSONB), metadata (JSONB)
   - createdBy (user ID)
   - timestamps

4. **RosterConfig** (roster_config table)
   - id (UUID, PK)
   - shifts (JSONB array), employees (JSONB array), leaves (JSONB array)
   - isActive (boolean)
   - updatedBy (user ID)
   - timestamps

### Default Admin User
- Email: `admin@pulseops.local`
- Password: `admin123`
- Role: `admin`
- Created automatically on first server start if no users exist

### Local Development
```bash
docker-compose -f docker-compose-pgsql.yml up -d
# PostgreSQL: localhost:5432 (user: postgres, password: Infosys@123, db: postgres_db)
# pgAdmin: http://localhost:5050 (admin@domain.com / Infosys@123)
```

---

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 16 (or Docker + docker-compose)

### Installation
```bash
# Frontend
cd pulseops-ui
npm install

# Backend
cd pulseops-api
npm install
```

### Running Locally

**Terminal 1 — PostgreSQL (if using Docker):**
```bash
cd pulseops
docker-compose -f docker-compose-pgsql.yml up -d
```

**Terminal 2 — Backend API:**
```bash
cd pulseops-api
npm run dev
# Starts on http://localhost:4000
# Swagger UI: http://localhost:4000/api/docs
# Health: http://localhost:4000/api/health
```

**Terminal 3 — Frontend UI:**
```bash
cd pulseops-ui
npm run dev
# Starts on http://localhost:3000
```

### Database Setup
```bash
# Sync models and seed default admin (runs automatically on server start)
cd pulseops-api
node src/core/database/sync.js
```

---

## Deployment

### Docker Images

**Frontend (pulseops-ui):**
```bash
docker build -t pulseops-ui:latest -f Dockerfile .
docker run -p 80:80 pulseops-ui:latest
```

**Backend (pulseops-api):**
```bash
docker build -t pulseops-api:latest -f Dockerfile .
docker run -p 4000:4000 \
  -e DB_HOST=postgres \
  -e DB_USER=postgres \
  -e DB_PASS=Infosys@123 \
  -e DB_NAME=postgres_db \
  pulseops-api:latest
```

### Kubernetes Deployment
- Frontend: Nginx pod serving SPA, proxying `/api/*` to backend
- Backend: Node.js pod with health probes (liveness, readiness)
- Database: PostgreSQL StatefulSet with persistent volume
- All pods are stateless and can be scaled horizontally

---

## Testing & Verification

### Frontend
```bash
cd pulseops-ui
npm run dev
# Visit http://localhost:3000
# Login: admin@pulseops.local / admin123
# Test ShiftRoster and Platform Admin modules
```

### Backend
```bash
cd pulseops-api
npm run dev
# Health: curl http://localhost:4000/api/health
# Swagger: http://localhost:4000/api/docs
# Login: curl -X POST http://localhost:4000/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"admin@pulseops.local","password":"admin123"}'
```

---

## Authentication Architecture

### Dual-Mode Authentication
The system supports two authentication modes:

1. **Database Authentication (Primary)**
   - Uses PostgreSQL User table with bcrypt-hashed passwords
   - Requires database to be initialized via `node src/core/database/sync.js`
   - Credentials stored securely in database

2. **JSON Fallback Authentication (Fallback)**
   - Uses `src/config/defaultUsers.json` when database is unavailable
   - Allows login even if PostgreSQL isn't running or initialized
   - Perfect for initial setup and development without database

### Default Admin Credentials
- **Email:** `Admin@123`
- **Password:** `Password@123`
- **Role:** admin
- **Status:** active

### How It Works
When a login request is received:
1. Try to authenticate against the database first
2. If database connection fails, fall back to JSON file
3. Return JWT token regardless of authentication source
4. Log which source was used (database or json)

### Files Involved
- `src/config/defaultUsers.json` — Default users for JSON fallback
- `src/core/routes/authRoutes.js` — `authenticateUser()` function handles dual-mode auth
- `src/core/database/models/User.js` — Database user model with bcrypt hashing

---

## Common Issues & Fixes

### Windows Shell Output Capture
When running commands via terminal, output may not be captured. Use:
```bash
npm install 2>&1
npx vite build 2>&1
```
Or set `--loglevel verbose` for npm commands.

### PostgreSQL Connection Failed
- Ensure PostgreSQL is running: `docker-compose -f docker-compose-pgsql.yml up -d`
- Check credentials in `pulseops-api/src/config/database.json`
- Verify port 5432 is accessible
- **Note:** System will fall back to JSON authentication if DB is unavailable

### JWT Token Expired
- Frontend listens for `auth:session-expired` events from ApiClient
- User is automatically logged out and redirected to login page
- Token expiry: 24 hours (configurable in `app.json`)

---

## Next Steps

- [x] Verify frontend dev server (`npm run dev`)
- [x] Verify backend dev server (`npm run dev`)
- [x] Create comprehensive README.md with URLs, credentials, components
- [ ] Initialize PostgreSQL database (`docker-compose up -d`)
- [ ] Sync database models (`node src/core/database/sync.js`)
- [ ] Test login flow with default admin credentials
- [ ] Test ShiftRoster module (load demo data, generate schedule)
- [ ] Test Platform Admin module (user management, database stats)
- [ ] Build Docker images and test containerized deployment
- [ ] Set up Kubernetes manifests (Deployment, Service, ConfigMap, Secret)
- [ ] Deploy to Kubernetes cluster

---

## File Checklist

### Frontend (pulseops-ui)
- ✅ package.json
- ✅ vite.config.js
- ✅ tailwind.config.js (+ animate-fade-in, animate-spin-slow)
- ✅ postcss.config.js
- ✅ jsconfig.json
- ✅ index.html
- ✅ src/main.jsx
- ✅ src/index.css
- ✅ src/core/App.jsx (routes to PlatformDashboard, sets Logger user)
- ✅ src/core/AppShell.jsx (TopNav + SideNav + RightPanel master layout)
- ✅ src/shared/index.js (barrel: 11 components + 3 layouts + 3 services)
- ✅ src/shared/config/urls.json
- ✅ src/shared/config/logs.json
- ✅ src/shared/config/app.json (unified modules array)
- ✅ src/shared/config/messages.json (errors/success/confirm/info only)
- ✅ src/shared/config/uiElementsText.json (all UI text externalized)
- ✅ src/shared/config/database.json
- ✅ src/shared/services/apiClient.js (+ Logger.logApiCall integration)
- ✅ src/shared/services/logger.js (separate system/API buffers, subscriber pattern)
- ✅ src/shared/services/authService.js
- ✅ src/shared/services/demoDataService.js
- ✅ src/shared/components/Card.jsx
- ✅ src/shared/components/Button.jsx
- ✅ src/shared/components/PageHeader.jsx
- ✅ src/shared/components/ProgressModal.jsx
- ✅ src/shared/components/ActionModal.jsx
- ✅ src/shared/components/LoginForm.jsx (uses uiElementsText.json)
- ✅ src/shared/components/LoadingSpinner.jsx
- ✅ src/shared/components/ProgressBar.jsx
- ✅ src/shared/components/EmptyState.jsx
- ✅ src/shared/components/ConfirmationModal.jsx
- ✅ src/shared/components/SettingsModal.jsx
- ✅ src/shared/components/layouts/TopNav.jsx
- ✅ src/shared/components/layouts/SideNav.jsx
- ✅ src/shared/components/layouts/RightPanel.jsx
- ✅ src/shared/components/layouts/ModuleLayout.jsx
- ✅ src/shared/data/rosterDemo.json
- ✅ src/modules/moduleRegistry.js
- ✅ src/modules/roster/ShiftRosterApp.jsx
- ✅ src/modules/roster/components/*.jsx (4 files)
- ✅ src/modules/roster/utils/*.js (2 files)
- ✅ src/modules/admin/PlatformDashboard.jsx (thin orchestrator)
- ✅ src/modules/admin/views/AdminOverview.jsx
- ✅ src/modules/admin/views/LogsViewer.jsx
- ✅ src/modules/admin/views/SettingsDatabase.jsx
- ✅ src/modules/admin/views/SettingsDbObjects.jsx
- ✅ src/modules/admin/views/SettingsAuth.jsx
- ✅ src/modules/admin/views/SettingsLogging.jsx
- ✅ Dockerfile
- ✅ nginx.conf
- ✅ .gitignore

### Backend (pulseops-api)
- ✅ package.json
- ✅ src/app.js
- ✅ src/server.js
- ✅ src/config/*.json (4 files)
- ✅ src/core/logger.js
- ✅ src/core/database/sequelize.js
- ✅ src/core/database/sync.js
- ✅ src/core/database/models/User.js
- ✅ src/core/database/models/SystemConfig.js
- ✅ src/core/database/models/index.js
- ✅ src/modules/roster/models/RosterSchedule.js
- ✅ src/modules/roster/models/RosterConfig.js
- ✅ src/core/middleware/auth.js
- ✅ src/core/middleware/errorHandler.js
- ✅ src/core/middleware/requestLogger.js
- ✅ src/core/routes/authRoutes.js
- ✅ src/core/routes/healthRoutes.js
- ✅ src/core/routes/databaseRoutes.js
- ✅ src/core/routes/userRoutes.js
- ✅ src/core/routes/configRoutes.js
- ✅ src/modules/roster/routes/rosterRoutes.js
- ✅ Dockerfile
- ✅ .gitignore

---

## Notes

- All code follows enterprise-grade standards: modular, reusable, no redundancy
- Consistent theming across all UI components (Tailwind CSS with brand/surface colors)
- All imports use path aliases (`@shared`, `@modules`, `@config`, `@core`)
- No hardcoded values anywhere — all externalized to JSON configs
- UI text externalized to `uiElementsText.json`, messages to `messages.json`
- Logger supports subscriber pattern for real-time updates in RightPanel and LogsViewer
- ApiClient logs full request/response payloads via Logger.logApiCall()
- AppShell is module-agnostic — receives all data via props
- PlatformDashboard owns AppShell and drives it with SideNav items
- Settings has 4 sub-tabs that dynamically replace SideNav items
- Kubernetes-ready architecture with stateless pods and health probes
- Ready for horizontal scaling and multi-pod deployments

### UI Replication from operationsmanager
- TopNav: Brand mark + module tabs + role badge + user menu + right panel toggle
- SideNav: Collapsible with active gradient highlighting
- RightPanel: 3-tab slide-out (System Logs, API Calls, Report Issue)
- AdminOverview: Health tiles with gradients, database summary 4-column, recent activity, platform info
- LogsViewer: System + API tabs, sortable table, level filtering, right detail panel with JSON
- Settings: 4 sub-tabs (Database, DB Objects, Authentication, Logging) with forms and toggles
