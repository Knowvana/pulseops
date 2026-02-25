# PulseOps — Standalone Operations Management Platform

**Status:** Development  
**Last Updated:** Feb 25, 2026

---

## Quick Reference

### URLs & Access Points

| Component | URL | Purpose |
|-----------|-----|---------|
| **Frontend UI** | http://localhost:3000 | React application (Vite dev server) |
| **Backend API** | http://localhost:4000 | Express REST API |
| **API Health** | http://localhost:4000/api/health | Health check endpoint |
| **API Readiness** | http://localhost:4000/api/health/readiness | K8s readiness probe (includes DB check) |
| **Swagger UI** | http://localhost:4000/api/docs | Interactive API documentation |
| **pgAdmin** | http://localhost:5050 | PostgreSQL admin panel |

---

### Credentials

| Service | Email/User | Password | Notes |
|---------|-----------|----------|-------|
| **PulseOps Login** | Admin@123 | Password@123 | Default admin user (JSON fallback + database) |
| **PostgreSQL** | postgres | Infosys@123 | Database user |
| **pgAdmin** | admin@domain.com | Infosys@123 | Database management UI |

---

### Database Configuration

| Property | Value | Notes |
|----------|-------|-------|
| **Host** | localhost | Or `postgres` in Docker/K8s |
| **Port** | 5432 | PostgreSQL default port |
| **Database** | postgres_db | Main database name |
| **User** | postgres | Database user |
| **Password** | Infosys@123 | Database password |
| **Provider** | PostgreSQL 16 | Version 16 |
| **Connection Pool** | Min: 2, Max: 10 | For performance |

---

### API Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **API Prefix** | /api | All routes start with `/api` |
| **Port** | 4000 | Backend server port |
| **JWT Secret** | pulseops-jwt-secret-change-in-production | Change in production |
| **JWT Expiry** | 24h | Token validity period |
| **Refresh Token Expiry** | 7d | Refresh token validity |
| **CORS Origin** | http://localhost:3000 | Frontend URL |
| **Rate Limit** | 200 requests/15min | Per IP address |

---

### Frontend Configuration

| Setting | Value | Location |
|---------|-------|----------|
| **API Base URL** | http://localhost:4000 | `src/shared/config/urls.json` |
| **App Name** | PulseOps | `src/shared/config/app.json` |
| **Port** | 3000 | Vite dev server |
| **Framework** | React 18 + Vite | `package.json` |
| **Styling** | Tailwind CSS | `tailwind.config.js` |
| **Icons** | Lucide React | Icon library |

---

## Core Components

### Frontend (pulseops-ui)

#### Shared Components
| Component | Location | Purpose |
|-----------|----------|---------|
| **ModuleLayout** | `src/shared/components/layouts/ModuleLayout.jsx` | Universal layout wrapper for all modules |
| **LoginForm** | `src/shared/components/LoginForm.jsx` | Single unified login page |
| **LoadingSpinner** | `src/shared/components/LoadingSpinner.jsx` | Full-overlay loading indicator |
| **ProgressBar** | `src/shared/components/ProgressBar.jsx` | Animated progress bar for multi-step ops |
| **ConfirmationModal** | `src/shared/components/ConfirmationModal.jsx` | Three-state confirmation dialog |
| **EmptyState** | `src/shared/components/EmptyState.jsx` | Placeholder for modules with no data |
| **SettingsModal** | `src/shared/components/SettingsModal.jsx` | Modal with tabbed sidebar navigation |

#### Shared Services
| Service | Location | Purpose |
|---------|----------|---------|
| **ApiClient** | `src/shared/services/apiClient.js` | HTTP client with JWT token management |
| **Logger** | `src/shared/services/logger.js` | Centralized structured logging |
| **AuthService** | `src/shared/services/authService.js` | User authentication (DB auth + OIDC placeholder) |
| **DemoDataService** | `src/shared/services/demoDataService.js` | Load demo data from JSON files |

#### Core App
| Component | Location | Purpose |
|-----------|----------|---------|
| **App.jsx** | `src/core/App.jsx` | Root orchestrator (auth state + routing) |
| **AppShell.jsx** | `src/core/AppShell.jsx` | Top navigation + module rendering |
| **ModuleRegistry** | `src/modules/moduleRegistry.js` | Dynamic module loading + role-based access |

#### Modules
| Module | Location | Accessible To | Components |
|--------|----------|----------------|------------|
| **Shift Roster** | `src/modules/roster/` | manager, admin | Dashboard, Config, Reports, Settings |
| **Platform Admin** | `src/modules/admin/` | admin | Overview, Users, Logs, Database Settings |

#### Config Files
| File | Location | Contains |
|------|----------|----------|
| **urls.json** | `src/shared/config/urls.json` | API endpoints |
| **database.json** | `src/shared/config/database.json` | PostgreSQL connection details |
| **logs.json** | `src/shared/config/logs.json` | Structured log message templates |
| **app.json** | `src/shared/config/app.json` | App metadata, roles, modules |
| **messages.json** | `src/shared/config/messages.json` | User-facing UI messages |

---

### Backend (pulseops-api)

#### Middleware
| Middleware | Location | Purpose |
|-----------|----------|---------|
| **Auth** | `src/core/middleware/auth.js` | JWT verification + RBAC |
| **Error Handler** | `src/core/middleware/errorHandler.js` | Global error handling |
| **Request Logger** | `src/core/middleware/requestLogger.js` | Log all HTTP requests |

#### Routes
| Route | Location | Endpoints | Auth Required |
|-------|----------|-----------|---------------|
| **Auth** | `src/core/routes/authRoutes.js` | POST /login, GET /me | No (login), Yes (me) |
| **Health** | `src/core/routes/healthRoutes.js` | GET /, /liveness, /readiness | No |
| **Database** | `src/core/routes/databaseRoutes.js` | Connection, schema, stats, seed, wipe | Yes (admin) |
| **Users** | `src/core/routes/userRoutes.js` | CRUD operations | Yes (admin) |
| **Config** | `src/core/routes/configRoutes.js` | CRUD system config | Yes (admin) |
| **Roster** | `src/modules/roster/routes/rosterRoutes.js` | Config + schedule CRUD | Yes |

#### Models
| Model | Location | Purpose | Key Fields |
|-------|----------|---------|-----------|
| **User** | `src/core/database/models/User.js` | Platform users | id, name, email, password (hashed), role, status |
| **SystemConfig** | `src/core/database/models/SystemConfig.js` | Key-value config store | id, key (unique), value, category, description |
| **RosterSchedule** | `src/modules/roster/models/RosterSchedule.js` | Generated schedules | id, year, month (unique), schedule (JSONB), metadata |
| **RosterConfig** | `src/modules/roster/models/RosterConfig.js` | Roster settings | id, shifts, employees, leaves (all JSONB), isActive |

#### Config Files
| File | Location | Contains |
|------|----------|----------|
| **app.json** | `src/config/app.json` | Port, JWT, CORS, rate-limit, default admin |
| **database.json** | `src/config/database.json` | PostgreSQL connection + pool config |
| **logs.json** | `src/config/logs.json` | Structured log message templates |
| **swagger.json** | `src/config/swagger.json` | OpenAPI spec configuration |

---

## Setup & Running

### Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 16 (or Docker)
- Docker & docker-compose (for local PostgreSQL)

### Installation

```bash
# Frontend
cd pulseops-ui
npm install

# Backend
cd pulseops-api
npm install
```

### Start PostgreSQL
```bash
cd pulseops
docker-compose -f docker-compose-pgsql.yml up -d
```

### Initialize Database
```bash
cd pulseops-api
node src/core/database/sync.js
```

This will:
- Create all tables
- Seed default admin user (admin@pulseops.local / admin123)

### Start Development Servers

**Terminal 1 — PostgreSQL:**
```bash
cd pulseops
docker-compose -f docker-compose-pgsql.yml up -d
# Wait 5-10 seconds for PostgreSQL to start
```

**Terminal 2 — Initialize Database:**
```bash
cd pulseops-api
node src/core/database/sync.js
# Creates tables and seeds default admin user
# Output: "Database sync complete."
```

**Terminal 3 — Backend API:**
```bash
cd pulseops-api
npm run dev
# Runs on http://localhost:4000
# Should see: "Server started successfully on port 4000"
```

**Terminal 4 — Frontend UI:**
```bash
cd pulseops-ui
npm run dev
# Runs on http://localhost:3000
# Should see: "VITE v... ready in ... ms"
```

### Verify Everything Works

```bash
# Check backend health
curl http://localhost:4000/api/health

# Check database readiness
curl http://localhost:4000/api/health/readiness

# View Swagger API docs
# Open http://localhost:4000/api/docs in browser

# Open frontend
# Open http://localhost:3000 in browser
# Login with: admin@pulseops.local / admin123
```

---

## API Endpoints Reference

### Authentication
```
POST   /api/auth/login          Login with email/password
GET    /api/auth/me             Get current user profile
```

### Health & Monitoring
```
GET    /api/health              General health check
GET    /api/health/liveness     K8s liveness probe
GET    /api/health/readiness    K8s readiness probe (includes DB)
```

### Users (Admin Only)
```
GET    /api/users               List all users
GET    /api/users/stats         User statistics
GET    /api/users/:id           Get user by ID
POST   /api/users               Create user
PUT    /api/users/:id           Update user
DELETE /api/users/:id           Delete user
```

### System Config (Admin Only)
```
GET    /api/config              List all config entries
GET    /api/config/:key         Get config by key
PUT    /api/config/:key         Upsert config
DELETE /api/config/:key         Delete config
```

### Database Management (Admin Only)
```
GET    /api/database/test-connection    Test DB connectivity
GET    /api/database/schema-status      Check if schema initialized
POST   /api/database/create-schema      Sync models & create tables
GET    /api/database/stats              Table and row counts
POST   /api/database/load-demo-data     Seed demo users
POST   /api/database/wipe               Delete all data
```

### Shift Roster (Authenticated)
```
GET    /api/roster/config                    Get active roster config
PUT    /api/roster/config                    Save roster config
GET    /api/roster/schedule/:year/:month     Get schedule for month
PUT    /api/roster/schedule/:year/:month     Save schedule
DELETE /api/roster/schedule/:year/:month     Delete schedule
GET    /api/roster/schedules                 List all saved schedules
```

---

## Troubleshooting

### Login Returns 500 Error
**Cause:** Database tables not created or default admin user not seeded

**Symptoms:**
- Frontend shows: `POST http://localhost:4000/api/auth/login 500 (Internal Server Error)`
- Browser console shows: `Login failed: Invalid credentials`

**Fix (Step by Step):**

1. **Verify PostgreSQL is running:**
   ```bash
   docker ps | grep postgres
   # Should show: postgres_db container running
   ```

2. **If PostgreSQL is not running, start it:**
   ```bash
   cd pulseops
   docker-compose -f docker-compose-pgsql.yml up -d
   # Wait 5-10 seconds for it to fully start
   ```

3. **Initialize the database (creates tables + seeds admin user):**
   ```bash
   cd pulseops-api
   node src/core/database/sync.js
   # Should output: "Database sync complete."
   ```

4. **Restart the backend server:**
   ```bash
   # Kill the running npm run dev process (Ctrl+C)
   # Then restart:
   npm run dev
   # Should see: "Server started successfully on port 4000"
   ```

5. **Try logging in again:**
   - Go to http://localhost:3000
   - Email: `admin@pulseops.local`
   - Password: `admin123`
   - Should now succeed and show the app shell

### Cannot Connect to PostgreSQL
**Cause:** PostgreSQL container not running or credentials wrong

**Fix:**
```bash
# Check if container is running
docker ps | grep postgres

# If not running, start it
docker-compose -f docker-compose-pgsql.yml up -d

# Check credentials in pulseops-api/src/config/database.json
```

### Frontend Cannot Reach Backend
**Cause:** Backend not running or CORS issue

**Fix:**
```bash
# Ensure backend is running on port 4000
curl http://localhost:4000/api/health

# Check CORS origin in pulseops-api/src/config/app.json
# Should include http://localhost:3000
```

### Command Output Not Captured
**Fix:** Add output redirection to shell commands:
```bash
npm install 2>&1
npx vite build 2>&1
npm run dev 2>&1
```

---

## Project Structure

```
pulseops/
├── pulseops-ui/                    # React frontend
│   ├── src/
│   │   ├── core/                   # App orchestration
│   │   ├── shared/                 # Shared components, services, configs
│   │   ├── modules/                # Feature modules (roster, admin)
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Global styles
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── pulseops-api/                   # Express backend
│   ├── src/
│   │   ├── config/                 # JSON configs
│   │   ├── core/                   # Database, middleware, core routes
│   │   ├── modules/                # Feature modules (roster)
│   │   ├── app.js                  # Express factory
│   │   └── server.js               # Entry point
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose-pgsql.yml        # PostgreSQL + pgAdmin
├── README.md                       # This file
└── aiprompt/
    └── PULSEOPS_REFACTOR.md        # Detailed project documentation
```

---

## Key Architecture Decisions

- **Single Login Page** — All users login via email/password; role determined by backend
- **No Multi-Tenancy** — Standalone product, single database
- **Externalized Config** — All settings in JSON files, no hardcoded values
- **Centralized Logging** — All log messages from JSON, no inline logs
- **Stateless Backend** — JWT tokens, no session state; Kubernetes-ready
- **Module Registry** — Dynamic module loading with role-based access control
- **Sequelize ORM** — Type-safe database operations with PostgreSQL
- **Swagger UI** — Auto-generated API documentation

---

## Support & Documentation

- **Detailed Architecture:** See `aiprompt/PULSEOPS_REFACTOR.md`
- **API Docs:** http://localhost:4000/api/docs (Swagger UI)
- **Frontend Config:** `pulseops-ui/src/shared/config/`
- **Backend Config:** `pulseops-api/src/config/`

---

**Last Updated:** Feb 25, 2026 5:04 PM UTC+05:30
