# IDS Project

## Overview

IDS Project is a full-stack team workload and task management platform designed to help organizations efficiently manage employees, tasks, workload distribution, and capacity planning.

The system enables team leaders to assign work, monitor team capacity, manage change requests, and track task progress in real time. It also integrates with **ClickUp**, allowing organizations to synchronize their ClickUp workspace directly into the application while keeping the workload dashboard powered entirely by the local database.

---

# Features

## Team Management

- Team creation and management
- Team member management
- Role-based access control
- Team capacity monitoring

## Task Management

- Create, edit, assign, and track tasks
- Task status management
- Change request workflow
- Task history
- Member task details
- Due date tracking

## Workload Dashboard

- Team workload overview
- Team capacity analysis
- Employee workload percentages
- Total effort hours
- Workload weight calculations
- Overloaded member detection
- Available member detection
- Team insights
- Member workload details
- Search, filtering, and sorting
- Date range filtering
    - This Week
    - Next Week
    - Custom Range

## Authentication

- JWT Authentication
- Google OAuth
- GitHub OAuth
- ClickUp OAuth
- Forgot Password
- User Registration
- Secure Password Reset

There are exactly **two roles** — `TeamLeader` and `Member` (see
`src/Domain/Constants/RoleNames.cs`). There is no Admin role.

> **Not implemented:** email verification. New accounts are created with
> `EmailConfirmed = true` unconditionally (`AuthService.cs`), and there is no
> confirmation endpoint or `RequireConfirmedEmail` policy. Password *reset*
> tokens are real and are validated.

## ClickUp Integration

- OAuth 2.0 authentication with ClickUp
- Secure encrypted token storage
- Workspace connection management
- Workspace member synchronization
- Task synchronization
- Automatic user matching
- Team creation from ClickUp workspace
- SQL-based synchronization
- Dashboard powered from synchronized data

---

# Project Structure

## Backend

```
src/
│
├── Api
│   ├── Controllers
│   │   └── Integrations        # ClickUpController
│   ├── Extensions              # AddPresentation() wiring
│   ├── Program.cs
│   └── appsettings.json
│
├── Application                 # contracts + DTOs (no orchestrators)
│   ├── Abstractions
│   │   ├── Authentication
│   │   ├── Integrations/ClickUp
│   │   └── Services            # the 11 I*Service contracts
│   ├── DTOs
│   │   ├── Auth
│   │   ├── ChangeRequests
│   │   ├── ClickUp
│   │   ├── Members
│   │   ├── Tasks
│   │   └── Workload
│   ├── DependencyInjection
│   └── Services                # WorkloadCalculator.cs only
│
├── Domain                      # 7 entities, 7 enums, 2 constant classes
│   ├── Common                  # BaseEntity
│   ├── Constants               # RoleNames, WorkloadThresholds
│   ├── Entities
│   └── Enums
│
└── Infrastructure              # the largest layer; most logic lives here
    ├── Authentication          # AuthService, JWT, + the ClickUp API client
    ├── ChangeRequests          # ChangeRequestService
    ├── DependencyInjection
    ├── Identity                # ApplicationUser
    ├── Integrations            # ClickUpSynchronizationService
    ├── Persistence             # DbContext, migrations, seeding
    ├── Tasks                   # Command / Query / Workflow services
    └── Workload                # WorkloadQueryService, SeedTeamDirectory
```

> **Layering note:** this is a simplified layered design, not textbook Clean
> Architecture. `Application` holds contracts and DTOs plus one calculator;
> `Infrastructure` carries most of the use-case logic. See
> [`../architecture.md`](../architecture.md) for the full rationale.

---

## Frontend

```
frontend/
│
├── src
│   ├── app
│   │   ├── App.tsx             # authenticated shell
│   │   ├── routes.tsx          # createBrowserRouter tree
│   │   └── auth                # AuthProvider + 3 route guards + roleAccess
│   │
│   ├── components
│   │   ├── approvals           # ChangeRequestTable
│   │   ├── auth                # AuthHeader, AuthFeatureSlider, …
│   │   ├── dashboard           # WorkloadOverview, WorkloadCard, Insights
│   │   ├── layout              # AppShell
│   │   └── members             # MemberTaskList
│   │
│   ├── pages                   # one folder per route (15 total)
│   │   ├── Dashboard  MemberDashboard  MemberDetails  MemberActivity
│   │   ├── MyTasks  TaskDetails  TaskForm
│   │   ├── ChangeRequests  MyChangeRequests
│   │   ├── Integrations        # ClickUp workspace selection
│   │   ├── Login  Signup  ForgotPassword  ResetPassword
│   │   └── OAuth               # OAuthCallbackPage
│   │
│   ├── services                # axios client + 8 endpoint wrappers
│   ├── theme                   # MUI theme + workload colour helpers
│   ├── types                   # auth.ts, domain.ts
│   └── utils
│
└── tests                       # node:test assertions + Playwright specs
```

There is no `hooks/` or `assets/` directory, and no global state store —
pages own their own server state via `useEffect` + local state.

---

# Technology Stack

## Backend

- ASP.NET Core 8
- Entity Framework Core
- ASP.NET Identity
- SQL Server
- JWT Authentication
- OAuth 2.0
- ClickUp API

## Frontend

- React
- TypeScript
- Material UI
- React Router
- Axios
- Vite

---

# Backend Configuration

The backend uses **.NET User Secrets** (recommended) or **environment variables** for all sensitive values.

Never commit secrets into:

```
appsettings.json
appsettings.Development.json
```


# ClickUp Configuration

Configure ClickUp using User Secrets or environment variables.

```bash
cd src/Api

dotnet user-secrets set "ClickUp:ClientId" "<clickup-client-id>"
dotnet user-secrets set "ClickUp:ClientSecret" "<clickup-client-secret>"
dotnet user-secrets set "ClickUp:RedirectUri" "https://localhost:5202/api/integrations/clickup/callback"
dotnet user-secrets set "ClickUp:WorkspaceId" "<workspace-id>"
```

Equivalent environment variables:

```
ClickUp__ClientId
ClickUp__ClientSecret
ClickUp__RedirectUri
ClickUp__WorkspaceId
```

> Never commit ClickUp credentials or OAuth tokens to source control.

---

# ClickUp Integration Flow

```
User
      │
      ▼
Connect ClickUp
      │
      ▼
OAuth Authorization
      │
      ▼
Access Token
      │
      ▼
Workspace Selection
      │
      ▼
Store Secure Connection
      │
      ▼
Synchronize Members
      │
      ▼
Synchronize Tasks
      │
      ▼
SQL Database
      │
      ▼
Workload Dashboard
```

---

# ClickUp Synchronization

The synchronization service imports data from ClickUp into the local SQL database.

## Members

Synchronizes:

- ClickUp User ID
- Name
- Email (when available)
- Team
- Local Identity User

Members without email addresses are still synchronized using their ClickUp User ID.

---

## Tasks

Synchronizes:

- External Task ID
- Title
- Assigned Member
- Status
- Priority
- Start Date
- Due Date
- Time Estimate
- External Source

Previously synchronized tasks are updated rather than duplicated — the upsert
is keyed on `(ExternalSource, ExternalId)`, which carries a unique filtered
index. The whole sync runs inside a single transaction.

Mapping behaviour worth knowing:

| Field | How it is derived |
|-------|-------------------|
| `Complexity` | **Always `Simple`** — ClickUp has no complexity concept |
| `RequiredSpecialization` | **Always `Unknown`** |
| `EstimatedEffortHours` | ClickUp `time_estimate` (ms) ÷ 3,600,000, else `0` |
| `Description` | Copied from the title |
| `DueDate` | ClickUp due date, else today |
| `StartDate` | ClickUp start date, else the resolved due date |

> **Unmatched assignees are skipped.** A ClickUp task whose assignee cannot be
> matched to a synchronized member is counted in `TasksSkipped` and not
> imported. Because imported tasks are always `Simple` complexity, their
> calculated weight is `EffortHours × 1.0 × PriorityMultiplier`.

---

# Database

Primary synchronized entities:

- ClickUpConnections
- AspNetUsers
- Teams
- Tasks

Each synchronized task stores:

- ExternalSource = ClickUp
- ExternalId
- AssignedMemberId
- TeamId

---

# Workload Engine

The dashboard **never calls ClickUp directly.**

Instead, it reads synchronized SQL data through the workload services.

The workload engine uses:

- Estimated Effort Hours
- Task Priority
- Task Complexity
- Task Status
- Start Date
- Due Date

Calculations include:

- Total Team Members
- Total Tasks
- Total Effort Hours
- Total Workload Weight
- Capacity Percentage
- Overloaded Members

Date filters:

- This Week
- Next Week
- Custom Range

---

# OAuth Routes

All routes are under `AuthController` (`[Route("api/auth")]`) and are
anonymous. Three providers are supported: **Google, GitHub, and ClickUp.**

### List enabled providers

```
GET /api/auth/external/providers
```

### Start OAuth

Per-provider routes plus a generic fallback:

```
GET /api/auth/external/google/start
GET /api/auth/external/github/start
GET /api/auth/external/clickup/start
GET /api/auth/external/{provider}/start
GET /api/auth/oauth/{provider}            # alias
```

### Complete OAuth

The provider redirects back to a `complete` endpoint — **not** `callback`:

```
GET /api/auth/external/google/complete
GET /api/auth/external/github/complete
GET /api/auth/external/clickup/complete
GET /api/auth/external/complete           # generic, no {provider} segment
GET /api/auth/oauth/callback              # alias
```

### Exchange SPA Ticket

The `complete` endpoint redirects the browser to the SPA with a one-time
ticket, which the frontend trades for a JWT:

```
POST /api/auth/external/exchange
POST /api/auth/oauth/exchange             # alias
```

Frontend callback route

```
/oauth/callback
```

---

# ClickUp API Endpoints

`ClickUpController` — `[Route("api/integrations/clickup")]`.
**Every endpoint requires the `TeamLeader` role.**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/workspaces` | List workspaces available to the OAuth ticket |
| `POST` | `/connect` | Bind a workspace to a team; stores the encrypted token |
| `GET` | `/connection` | Current connection status |
| `GET` | `/discovery/structure` | Browse spaces / folders / lists |
| `GET` | `/discovery/tasks` | Preview tasks before syncing |
| `POST` | `/sync` | Run member + task synchronization |
| `GET` | `/test-data` | Sanity-check payload (never exposes raw tokens) |

> There is **no disconnect endpoint** and no `/callback` or `/status` route on
> this controller. The OAuth callback is handled by
> `GET /api/auth/external/clickup/complete` instead.

---

# Forgot Password Email

Supports two delivery modes.

## SMTP

Configure:

```bash
dotnet user-secrets set "Email:FromAddress" "<verified-sender@example.com>"
dotnet user-secrets set "Email:FromName" "IDS Project"

dotnet user-secrets set "Email:Smtp:Host" "<smtp-host>"
dotnet user-secrets set "Email:Smtp:Port" "587"
dotnet user-secrets set "Email:Smtp:EnableSsl" "true"
dotnet user-secrets set "Email:Smtp:UseDefaultCredentials" "false"
dotnet user-secrets set "Email:Smtp:Username" "<smtp-username>"
dotnet user-secrets set "Email:Smtp:Password" "<smtp-password>"
```

---

## Local Pickup

If SMTP is not configured, emails are written to:

```
src/Api/App_Data/Emails
```

---

# Local Development

## Backend

```bash
cd src/Api

dotnet restore

dotnet ef database update

dotnet run
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

---

# Security

- JWT authentication
- OAuth 2.0 authentication
- Encrypted ClickUp OAuth tokens
- ASP.NET Identity
- SQL Server
- User Secrets for local development
- Environment variables for deployment
- No secrets committed to Git

---

# Notes

- Every project targets **`net8.0`**.
- `global.json` pins the SDK to **8.0.419** with `rollForward: latestFeature`, so
  a newer 8.0.x SDK is used automatically while a newer *major* SDK (9, 10) will
  not silently take over the build. If you have only a newer major SDK
  installed, install the .NET 8 SDK rather than editing `global.json`.
- Store OAuth credentials, SMTP credentials, JWT keys, and ClickUp credentials using **User Secrets** or **environment variables**.
- The Workload Dashboard reads synchronized SQL data rather than calling ClickUp directly, ensuring consistent performance and supporting existing workload calculations.
