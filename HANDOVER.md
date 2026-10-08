# Handover — IDS Project (TeamSync)

This is the starting point for getting into the codebase. It explains how to run
the project, where things live and how they behave in practice. Two longer
documents cover more detail:

- [`architecture.md`](architecture.md): layering, request flow, auth, and the frontend structure
- [`docs/Team_Workload_Technical_Documentation.md`](docs/Team_Workload_Technical_Documentation.md): data model, API reference, and workload formulas
- [`docs/README.md`](docs/README.md): feature overview. **Its ClickUp configuration section uses outdated key names.** Use the ones below.

---

## What it is

A team workload and task-tracking web app with two roles, `TeamLeader` and
`Member`. Team leaders create and assign tasks, watch each member's weighted
workload against capacity, and review change requests. A team leader can also
connect a ClickUp workspace and import its members and tasks into the local
database.

| Part | Stack | Location |
|---|---|---|
| API | ASP.NET Core 8, EF Core 8, ASP.NET Identity, JWT, SQL Server | `src/` |
| SPA | React + TypeScript, Vite, MUI 7, React Router, Axios | `frontend/` |
| Tests | xUnit (backend); node:test + Playwright (frontend) | `tests/`, `frontend/tests/` |

Solution file: `IDS.Project.sln`. The backend is split into four projects:
`Api` → `Application` (contracts and DTOs) → `Domain` (entities and enums), with
`Infrastructure` holding most of the real logic.

---

## Running it locally

### Prerequisites

- .NET 8 SDK. `global.json` pins **8.0.419** with `rollForward: latestFeature`.
- Node.js and npm
- SQL Server, running locally. See [Database](#database) below.
- `dotnet-ef` is a local tool (`.config/dotnet-tools.json`). Run `dotnet tool restore` to install it.

### 1. Backend secrets

The API **will not issue tokens without a JWT signing key**. If `Jwt:Key` is
empty, it throws `JWT signing key is missing`. Secrets go in user secrets and
never in `appsettings.json`:

```bash
cd src/Api
dotnet user-secrets set "Jwt:Key" "<random string, 32+ chars>"
```

Optional, needed only for those features:

```bash
# ClickUp sign-in / workspace connection
dotnet user-secrets set "Authentication:ClickUp:ClientId"     "<id>"
dotnet user-secrets set "Authentication:ClickUp:ClientSecret" "<secret>"

# Google / GitHub sign-in (same shape)
dotnet user-secrets set "Authentication:Google:ClientId" "<id>"
dotnet user-secrets set "Authentication:GitHub:ClientId" "<id>"

# SMTP for password-reset emails (otherwise emails are written to src/Api/App_Data/Emails)
dotnet user-secrets set "Email:Smtp:Host" "<host>"
```

If a provider's credentials are missing, that sign-in button is disabled and a
"not configured" warning is logged at startup. This is expected.

### 2. Start

```bash
# API: https://localhost:5202 (http 5203)
cd src/Api
dotnet run
```

```bash
# SPA: http://localhost:5173, proxies /api to https://localhost:5202
cd frontend
npm install
npm run dev
```

### Database

No database comes with the repository; each developer uses a local SQL Server.
**There is no need to create the database by hand.** On every startup the API
calls `MigrateAsync()` (`ApplicationDbContextSeed.cs`). That creates
`IdsProjectDb` if it doesn't exist, applies all migrations, and seeds the demo
team and accounts. Nothing reads the `DatabaseInitialization:ApplyMigrationsOnStartup`
setting in `appsettings.json`; migrations always run.

What you need:

- A running SQL Server instance. SQL Server Express or Developer edition both work.
- A Windows login that is allowed to create databases on it. The default connection string uses Windows auth (`Trusted_Connection=True`).

The default connection string is
`Server=.\SQLEXPRESS;Database=IdsProjectDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True`.
If your instance has a different name, or uses LocalDB or SQL authentication,
override the string in user secrets rather than editing `appsettings.json`:

```bash
cd src/Api
# LocalDB example
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=(localdb)\\MSSQLLocalDB;Database=IdsProjectDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True"
```

`dotnet ef` commands ignore that override. They use the design-time factory
`src/Infrastructure/Persistence/ApplicationDbContextFactory.cs`, which has
`.\SQLEXPRESS` hard-coded. This only matters when adding migrations: run them
against `.\SQLEXPRESS`, or change the string in the factory.

To reset to a clean demo state, drop `IdsProjectDb` and restart the API.

### 3. Demo accounts (seeded)

All seeded accounts use the password `Passw0rd!`.

| Email | Role |
|---|---|
| `leader@ids.local` | TeamLeader |
| `marcus.chen@ids.local`, `anita.lopez@ids.local`, `david.park@ids.local`, `elena.rodriguez@ids.local`, `sanjay.kapoor@ids.local`, `chloe.sims@ids.local` | Member |

Seed data is in `src/Infrastructure/Persistence/ApplicationDbContextSeed.cs` and
`SeedMemberProfiles.cs`.

### 4. Tests

```bash
dotnet test                                   # 16 backend tests: ClickUp, JWT, OAuth redirect
cd frontend && npm run build                  # type-check + build
node --test tests/no-inline-style.member-details.test.mjs
npx playwright test                           # visual + OAuth regression specs
```

The task, workload and change-request services have no dedicated backend tests.

---

## Where things live

| Concern | Start here |
|---|---|
| Startup / DI | `src/Api/Program.cs`, `src/Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs` |
| Auth (password, JWT, OAuth) | `src/Api/Controllers/AuthController*.cs`, `src/Infrastructure/Authentication/AuthService.cs` |
| Tasks | `TasksController` → `Infrastructure/Tasks/TaskQueryService`, `TaskCommandService`, `TaskWorkflowService` |
| Workload dashboard | `WorkloadController` → `Infrastructure/Workload/WorkloadQueryService`; formula in `Application/Services/WorkloadCalculator.cs` |
| Change requests | `ChangeRequestsController` → `Infrastructure/ChangeRequests/ChangeRequestService` |
| ClickUp integration | `Controllers/Integrations/ClickUpController`; `Infrastructure/Authentication/ClickUp*` (client, connection, discovery, token protector); `Infrastructure/Integrations/ClickUpSynchronizationService` |
| DB schema | `Infrastructure/Persistence/ApplicationDbContext.cs` + `Migrations/` |
| Frontend routes and guards | `frontend/src/app/routes.tsx`, `frontend/src/app/auth/` |
| Frontend API calls | `frontend/src/services/` (one wrapper per backend area) |

Authorization is applied in two places: role attributes on controllers, plus
team and ownership checks inside the services.

---

## ClickUp integration: how it works

1. The team leader signs in with ClickUp (`GET /api/auth/external/clickup/start`).
2. ClickUp redirects to the OAuth middleware at **`/api/auth/external/clickup/callback`**. This is the redirect URL to register in the ClickUp OAuth app, e.g. `https://localhost:5202/api/auth/external/clickup/callback`.
3. The app continues to `/api/auth/external/clickup/complete`, which hands the SPA a one-time ticket. The SPA exchanges that ticket for a JWT.
4. The leader picks a workspace (`/integrations/clickup/select` → `POST /api/integrations/clickup/connect`). If the leader has no team yet, a team is created for that workspace. The access token is stored encrypted in `ClickUpConnections`.
5. `POST /api/integrations/clickup/sync` upserts members, then tasks, in a single transaction. Tasks are keyed on `(ExternalSource, ExternalId)`, so re-running the sync updates existing rows instead of duplicating them.

Things to know about the integration:

- **Only users who already have the TeamLeader role can sign in with ClickUp.** Other users are rejected, and every `/api/integrations/clickup/*` endpoint requires TeamLeader.
- **The ClickUp API client only reads.** It makes GET requests and nothing else. Local edits to a ClickUp-sourced task are not sent to ClickUp, and the next sync replaces the synced fields with ClickUp's values.
- The sync sets imported tasks' `Complexity` to `Simple` and `RequiredSpecialization` to `Unknown`, on insert and again on every update.
- Tasks are matched to people **through the workspace member list.** If the connected ClickUp account can't see that list (ClickUp returns `members: []`), every task is skipped. The sync still reports success, with 0 tasks imported. If a sync imports nothing, check the account's permissions in that workspace before looking at the code. A workspace the account owns returns the full member list.

---

## Roles and accounts

- `RoleNames.All` contains exactly `TeamLeader` and `Member`. There is no Admin role.
- Every in-app path that creates a user assigns **Member**: self-registration, Google/GitHub sign-in, and ClickUp member sync.
- The only TeamLeader created automatically is the seeded `leader@ids.local`. To make another user a team leader, change their row in `dbo.AspNetUserRoles` to the TeamLeader role. Leave their `TeamId` null if they will connect ClickUp, because connecting creates the team.
- Email verification is not implemented. Accounts are created with `EmailConfirmed = true`.

---

## Housekeeping

- This folder is **not a git repository**. Run `git init` and make a first commit before changing anything.
- Ignored or generated output that can be deleted: `bin/`, `obj/`, `.vs/`, `frontend/node_modules/`, `frontend/dist/`.
- `frontend/.tmp-task-details-check.js` is a leftover one-off Playwright script with hardcoded paths. It isn't used by anything.
- `src/Api/IDS.Project.Api.http` still contains the template `weatherforecast` request, which doesn't exist in this API.
