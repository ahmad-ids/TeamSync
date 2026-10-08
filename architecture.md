# IDS Architecture

## Purpose

IDS is a full-stack workload and task-management system for two primary roles:

- `TeamLeader`: creates tasks, monitors workload, reviews change requests, and inspects member capacity.
- `Member`: receives tasks, acknowledges work, updates status, requests changes, and tracks personal workload.

The repository is split into two applications:

- `src/`: ASP.NET Core Web API with Entity Framework Core and ASP.NET Identity.
- `frontend/`: React + Vite single-page application using MUI for UI composition and theming.

At a high level, the architecture is a practical layered system:

1. The frontend renders role-specific pages and talks to the backend over JSON HTTP APIs.
2. The API layer authenticates the caller, applies role checks, and delegates to services.
3. Application contracts define service interfaces and DTO shapes.
4. Infrastructure implements those services using EF Core, Identity, JWT, email delivery, and seed data.
5. Domain types model the core business concepts: tasks, teams, change requests, reassignment, workload states.

## Repository Layout

```text
IDS/
├─ src/
│  ├─ Api/               # HTTP entry point, controllers, startup/presentation wiring
│  ├─ Application/       # service contracts, DTOs, workload calculation abstraction
│  ├─ Domain/            # entities, enums, constants, core business concepts
│  └─ Infrastructure/    # EF Core, Identity, JWT, service implementations, seeding
├─ frontend/
│  ├─ src/app/           # router, auth context, route guards, shell composition
│  ├─ src/components/    # reusable UI building blocks
│  ├─ src/pages/         # page-level containers and flows
│  ├─ src/services/      # HTTP client and endpoint wrappers
│  ├─ src/theme/         # MUI theme and shared visual tokens
│  └─ tests/             # focused regression tests, including Playwright visual checks
└─ tests/                # backend-facing repo-level test area
```

## System Shape

```text
React SPA
  -> axios service wrappers
  -> ASP.NET Core controllers
  -> application service interfaces
  -> infrastructure implementations
  -> EF Core / Identity / SQL Server
```

This is not strict textbook Clean Architecture. It is a simplified layered variant:

- `Application` is mostly contracts and DTOs, with a small amount of shared business logic such as `WorkloadCalculator`.
- `Infrastructure` contains most of the actual use-case implementation.
- `Api` stays thin and works mainly as the transport and authorization boundary.

That tradeoff keeps the codebase relatively direct, but it means some business workflows live closer to persistence than in a separate orchestration layer.

## Backend Architecture

### 1. API Layer

Key file: `src/Api/Program.cs`

The API bootstraps in a small, conventional pipeline:

- `AddApplication()`
- `AddInfrastructure(configuration)`
- `AddPresentation()`
- initialize infrastructure and seed state
- enable CORS, HTTPS redirection, authentication, authorization
- map controllers

This keeps startup simple and pushes most wiring into extension methods.

Key presentation responsibilities:

- controller routing
- JSON serialization rules
- CORS policy for local frontend hosts
- HTTP status code selection
- extraction of current user identity from claims
- role-based authorization via `[Authorize]`

The presentation layer is intentionally thin. It should not own business calculations.

### 2. Application Layer

Representative files:

- `src/Application/Abstractions/Services/IAuthService.cs`
- `src/Application/Abstractions/Services/ITaskQueryService.cs`
- `src/Application/Abstractions/Services/IWorkloadQueryService.cs`
- `src/Application/Services/WorkloadCalculator.cs`

This layer defines:

- service contracts used by controllers
- DTOs exchanged between backend and frontend
- shared calculation logic that is independent of transport and database concerns

The DTO-heavy structure is deliberate. Controllers do not expose EF entities directly. That gives the codebase:

- stable API response shapes
- controlled serialization
- separation between persistence model and HTTP contract

The current application layer is light on orchestrators. Most workflows are delegated straight to infrastructure service implementations.

### 3. Domain Layer

Representative files:

- `src/Domain/Entities/TaskItem.cs`
- `src/Domain/Entities/Team.cs`
- `src/Domain/Constants/WorkloadThresholds.cs`

The domain layer holds the core vocabulary of the system:

- entities
- enums
- role names
- workload thresholds

Important domain concepts:

- `TaskItem`: the central work unit, including ownership, effort, dates, status, calculated weight, and acknowledgement state
- `Team`: a team with a leader and a collection of tasks
- `TaskStatusHistory`: timeline of status changes
- `TaskChangeRequest`: member-requested changes to task properties
- `TaskReassignmentRequest`: reassignment workflow records
- `WeightMultiplierSetting`: persistence support for weighting logic

The domain model is intentionally persistence-friendly. Entities are mutable EF entities rather than highly encapsulated aggregates.

### 4. Infrastructure Layer

Representative files:

- `src/Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs`
- `src/Infrastructure/Persistence/ApplicationDbContext.cs`
- `src/Infrastructure/Authentication/AuthService.cs`
- `src/Infrastructure/Tasks/TaskQueryService.cs`
- `src/Infrastructure/Workload/WorkloadQueryService.cs`

Infrastructure is where most behavior actually runs. It owns:

- EF Core persistence
- Identity user management
- JWT token generation
- external OAuth wiring
- password reset email delivery
- query and command services for tasks/workload/change requests
- seed/bootstrap logic

This is the heaviest layer in the system.

## Backend Request Flow

### Example: workload summary

1. Frontend calls `GET /api/workload`.
2. `src/Api/Controllers/WorkloadController.cs` verifies the caller is authenticated and in `TeamLeader` or `Member`.
3. The controller resolves the current user ID from claims.
4. It calls `IWorkloadQueryService.GetSummaryAsync(...)`.
5. `src/Infrastructure/Workload/WorkloadQueryService.cs` builds the caller’s team scope, queries members and tasks, calculates capacity, and maps DTOs.
6. The controller returns a `WorkloadSummaryDto`.

Why this structure matters:

- authorization stays at the transport boundary
- team scoping is enforced in service logic
- the frontend receives shaped data without needing to know EF or database details

### Example: task details

1. Frontend calls `GET /api/tasks/{id}`.
2. `src/Api/Controllers/TasksController.cs` resolves the caller and whether they are a `TeamLeader`.
3. `ITaskQueryService.GetTaskDetailsAsync(...)` is called.
4. `src/Infrastructure/Tasks/TaskQueryService.cs` loads the task, checks access rules, builds the status timeline, builds the change audit, and computes assignee capacity.
5. A fully assembled `TaskDetailsDto` is returned.

This service is doing both authorization-aware access control and view-model assembly. That is pragmatic, but it also means query services are carrying significant business responsibility.

## Authentication and Authorization

### Backend auth model

Authentication setup lives in `src/Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs`.

The backend supports:

- JWT bearer auth for SPA API calls
- ASP.NET Identity for user and role management
- external OAuth with Google and GitHub
- external sign-in cookie for OAuth handshake completion
- password reset tokens with configurable lifespan

Auth flow:

1. A user logs in with credentials or external OAuth.
2. `src/Infrastructure/Authentication/AuthService.cs` validates the user and creates a session response.
3. `JwtService`/`JwtTokenGenerator` issues a signed token.
4. The frontend stores the token and sends it on future API requests.

Role model:

- `TeamLeader`
- `Member`

Authorization is enforced in two places:

- transport level with `[Authorize]` and role constraints in controllers
- service level with scope and ownership checks, such as same-team access or assigned-member access

That second layer is important because role checks alone are not enough for object-level access control.

## ClickUp Integration

A Team Leader can bind a ClickUp workspace to a team and import its members and
tasks into SQL Server.

Key files:

- `src/Api/Controllers/Integrations/ClickUpController.cs`
- `src/Infrastructure/Authentication/ClickUpApiClient.cs`
- `src/Infrastructure/Authentication/ClickUpConnectionService.cs`
- `src/Infrastructure/Authentication/ClickUpTokenProtector.cs`
- `src/Infrastructure/Authentication/ClickUpTaskDiscoveryService.cs`
- `src/Infrastructure/Integrations/ClickUpSynchronizationService.cs`

### File layout caveat

ClickUp code is spread across three directories. The API client, connection
service, token protector, and discovery service live under
`Infrastructure/Authentication/` — because the integration entered the codebase
through the OAuth work — while only the synchronization service sits under
`Infrastructure/Integrations/`. The API client is not an authentication concern
and would be better placed alongside the sync service.

### The central architectural rule

**The workload dashboard never calls ClickUp at request time.** Synchronization
writes into the same `Tasks` and Identity tables the rest of the system uses, and
every read path is ordinary EF Core. That keeps dashboard latency independent of
a third-party API and means workload calculation needs no special cases for
imported work.

### Flow

1. Team Leader starts OAuth via `GET /api/auth/external/clickup/start`.
2. ClickUp redirects to `GET /api/auth/external/clickup/complete`, which issues a
   one-time setup ticket and redirects into the SPA.
3. `/integrations/clickup/select` lists workspaces and posts a selection to
   `POST /api/integrations/clickup/connect`.
4. `ClickUpConnectionService` stores a `ClickUpConnection`, protecting the access
   token via `ClickUpTokenProtector` and deactivating any other connection for
   that user.
5. `POST /api/integrations/clickup/sync` runs `ClickUpSynchronizationService`
   inside a transaction: upsert members, then upsert tasks.

### Sync semantics

Idempotency comes from a unique filtered index on
`(TaskItem.ExternalSource, TaskItem.ExternalId)`, so re-syncing updates rather
than duplicates. Two lossy mappings are worth knowing: imported tasks are always
`TaskComplexity.Simple` and `TaskSpecialization.Unknown`, because ClickUp models
neither. Tasks whose assignee cannot be matched to a synchronized member are
skipped, not imported unassigned.

### Token handling

Access tokens are encrypted at rest (`ProtectedAccessToken`) and never returned
by the API — `DiscoveryController_DoesNotExposeRawTokens` in
`tests/IDS.Project.Tests/ClickUpDiscoveryTests.cs` guards that.

### A note on the API client

`ClickUpApiClient` parses responses by walking `JsonElement` by hand through
`TryGetPropertyCaseInsensitive` and `GetOptionalString`. These two helpers are
the most-called functions in the entire backend. The defensiveness is
deliberate — ClickUp payload shapes vary by plan and endpoint — but it makes the
client the densest file in the integration and the first place to look when a
sync silently drops a field.

## Persistence Model

Key file: `src/Infrastructure/Persistence/ApplicationDbContext.cs`

The backend uses SQL Server via EF Core. `ApplicationDbContext` inherits from `IdentityDbContext<ApplicationUser>`, which means business tables and auth tables live in one database context.

Core tables represented by DbSets:

- `Teams`
- `Tasks`
- `TaskStatusHistories`
- `TaskChangeRequests`
- `TaskReassignmentRequests`
- `WeightMultiplierSettings`
- `ClickUpConnections`

Important model choices:

- task-to-team is `Restrict` on delete
- task status history cascades with task delete
- change requests and reassignment requests cascade with task delete
- enums are stored in a database-friendly way
- effort and multiplier values use explicit numeric precision

This is a straightforward transactional design optimized for one relational database rather than distributed systems complexity.

## Seeding and Initialization

Infrastructure initialization happens during startup through `InitializeInfrastructureAsync()`.

The repository includes seed/bootstrap code for:

- initial database content
- member profile defaults
- team directory lookups
- sample task data
- reassignment schema support

This indicates the app is designed to be usable quickly in local development without a large external data setup phase.

## Frontend Architecture

### 1. Application Bootstrap

Key files:

- `frontend/src/main.tsx`
- `frontend/src/app/App.tsx`

The frontend boot sequence is:

1. create React root
2. apply a public MUI theme
3. install global CSS baseline
4. mount `AuthProvider`
5. mount React Router

Inside the protected app shell, a separate app theme is used. That creates a practical split:

- public auth-facing pages use `publicTheme`
- authenticated application pages use `appTheme`

### 2. Routing Model

Key file: `frontend/src/app/routes.tsx`

Routing is organized around nested route guards:

- `PublicOnlyRoute`: for login, signup, forgot/reset password, OAuth callback
- `ProtectedRoute`: for authenticated sections
- `RoleRoute`: for role-specific page access

Important route branches:

- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/oauth/callback`
- `/` for team leader dashboard
- `/member`, `/member/tasks`, `/member/change-requests`, `/member/history`
- `/members/:memberId` for leader view of a member
- `/tasks/new`, `/tasks/:taskId`, `/tasks/:taskId/edit`
- `/change-requests`
- `/integrations/clickup/select`

Note that `/tasks/:taskId` is the one protected route with **no** `RoleRoute`
wrapper — both roles reach the same page, and access control is enforced
server-side in `TaskQueryService`.

This design keeps authorization decisions close to navigation. It avoids rendering pages the current role should never access.

### 3. Auth State Management

Key file: `frontend/src/app/auth/AuthProvider.tsx`

`AuthProvider` is the frontend session boundary. It owns:

- current auth status
- current user
- current session token metadata
- login flow
- OAuth ticket completion
- logout
- session hydration from storage on app boot

Hydration pattern:

1. read stored session from local storage
2. reject it if expired
3. call `/auth/me` to validate it server-side
4. establish authenticated or unauthenticated state

This is a good fit for a SPA with JWTs because it avoids trusting stale client state blindly.

### 4. API Access Layer

Key files:

- `frontend/src/services/apiClient.ts`
- `frontend/src/services/authService.ts`
- `frontend/src/services/workloadService.ts`
- `frontend/src/services/taskService.ts`

The frontend uses a thin service-wrapper model:

- a shared Axios instance defines base URL and timeout
- a request interceptor injects the bearer token from stored session state
- each domain service file maps one backend area into typed functions

Examples:

- `authService`: login, register, password reset, current user, OAuth exchange
- `workloadService`: workload summary and member workload details
- `taskService`: task details, form options, preview, create/update/delete, reassignment, acknowledgement, status updates

This is a clean separation. Pages do not build raw HTTP calls inline.

### 5. Page and Component Composition

The frontend is organized around page containers plus reusable components.

Structure:

- `pages/`: route-level containers, data loading, state transitions, page-specific workflows
- `components/`: reusable UI sections used by pages
- `theme/`: shared MUI tokens and component-level style overrides
- `types/`: frontend API models and shared TS types

Typical page pattern:

1. load data with `useEffect`
2. store API result in local component state
3. pass shaped data into reusable presentational components
4. render loading, error, or success state

Example:

- `frontend/src/pages/Dashboard/DashboardPage.tsx` loads workload summary state and passes it to `WorkloadOverview`

This is a conventional page-container architecture rather than a global state-store architecture.

## Frontend Styling Architecture

The styling system is mixed, but intentional:

- primary styling approach: MUI theme, `styled(...)`, and `sx`
- page-specific style modules: `*.styles.ts`
- targeted CSS file extraction where plain CSS is simpler, such as `frontend/src/pages/MemberDetails/MemberDetailsSections.css`

Key file: `frontend/src/theme/theme.ts`

The theme centralizes:

- color tokens
- typography
- component defaults and overrides
- motion/transition values
- workload-specific color helpers

Architecturally, the app is not using CSS Modules or a utility-class framework. It is predominantly MUI-driven with selective escape hatches.

Implication:

- shared UI consistency is strong because component behavior is themed centrally
- some page files can become style-heavy because MUI `styled` and `sx` are colocated with component code

## Workload and Task Business Logic

One of the most important architectural ideas in this repo is that workload is not just a count of tasks. It is a weighted model.

Key file: `src/Application/Services/WorkloadCalculator.cs`

Weight is derived from:

- estimated effort hours
- complexity multiplier
- priority multiplier

That means:

- a few critical complex tasks can outweigh many simple low-priority tasks
- workload status is based on weighted capacity, not raw task volume

This weighting model shapes multiple screens:

- team dashboard
- member workload details
- task preview during creation/editing
- capacity insights in task details

### Caveat: the calculation is not actually centralized

`IWorkloadCalculator` is the intended single source of truth, but the multiplier
tables are restated in five places:

1. `src/Application/Services/WorkloadCalculator.cs` — the canonical implementation
2. `src/Infrastructure/ChangeRequests/ChangeRequestService.cs` — a private `CalculateWeight` duplicate
3. `src/Infrastructure/Tasks/TaskCommandService.cs` — `Resolve*Multiplier` helpers
4. `src/Infrastructure/Tasks/TaskQueryService.cs` — `Resolve*Multiplier` helpers
5. the `WeightMultiplierSettings` table — seeded with the same values and **never read**

All five agree today, so there is no live defect. But the contract is not
enforcing what it appears to enforce, and copy 5 in particular looks like
runtime configuration while having no effect. Treat a multiplier change as a
cross-cutting edit, not a one-line change.

The `Resolve*Multiplier` helpers exist for a legitimate reason — `TaskPreviewDto`
and `TaskDetailsDto` expose the individual multipliers, which
`IWorkloadCalculator` does not return. Widening the interface to return a
breakdown would let copies 2–4 collapse into it.

## Data Ownership and Boundaries

Current ownership lines are:

- controllers own HTTP and auth boundary concerns
- service interfaces own use-case contracts
- infrastructure services own query/command implementation
- EF DbContext owns relational persistence mapping
- frontend services own API transport details
- frontend pages own UI state and API lifecycle handling
- frontend components own composition and display

These boundaries are mostly coherent, but a few areas are intentionally blended:

- query services also assemble rich response models
- infrastructure owns much of the use-case logic rather than a separate application orchestration layer
- frontend pages manage local server state directly instead of using React Query or a centralized cache

None of those are wrong. They are tradeoffs that favor speed and directness over extra abstraction.

## Testing and Verification Structure

The repository currently includes targeted regression checks rather than a single unified testing architecture.

Frontend examples:

- `frontend/tests/no-inline-style.member-details.test.mjs`
- `frontend/tests/member-details-inline-style.visual.spec.ts`
- `frontend/playwright.config.ts`

Plus `frontend/tests/oauth-flow-regression.spec.ts` for the OAuth handshake.

Backend tests live in `tests/IDS.Project.Tests/`:

- `ClickUpDiscoveryTests.cs` — discovery, pagination, token non-exposure
- `ClickUpIntegrationTests.cs` — connect/sync, weight mapping, token protection
- `JwtServiceTests.cs` — token generation
- `OAuthRedirectUrlBuilderTests.cs` — redirect URL construction

This shows a layered verification strategy:

- static source assertions for specific constraints
- visual regression for UI-sensitive behavior
- frontend build as a type/integration gate
- backend unit/integration tests concentrated on the ClickUp and auth seams

Coverage is deliberately uneven. The ClickUp integration and auth are the
best-tested areas; the task, workload, and change-request services — which carry
most of the business logic — have no dedicated backend test files.

## Architectural Strengths

- Clear backend layer separation with understandable responsibilities
- Thin controllers and typed DTO boundaries
- Consistent auth model across JWT, Identity, and OAuth
- Strong role-aware routing in the frontend
- A defined workload calculation contract (`IWorkloadCalculator`), though it is
  bypassed in several places — see the caveat above
- MUI theme centralization gives the UI a coherent visual language
- Frontend service wrappers keep network code out of page components

## Architectural Constraints and Tradeoffs

- `Infrastructure` is doing a lot of use-case work, so it is the most change-sensitive layer
- rich query services may become large because they combine filtering, authorization, calculation, and DTO assembly
- frontend data loading is page-local, so cross-page caching and invalidation are manual
- mixed styling approaches can drift unless the team stays disciplined
- a single relational database context is simple and effective, but it also couples auth and business persistence together

These are not immediate defects. They are the pressure points that will matter most as the app grows.

## Recommended Mental Model For Future Changes

When changing this system, the safest way to reason about it is:

1. Start from the user role and route.
2. Identify the frontend page and service wrapper involved.
3. Find the matching controller endpoint.
4. Trace into the service interface and infrastructure implementation.
5. Check domain constants/enums/entities that constrain the behavior.
6. Verify whether the change affects auth scope, workload calculation, or shared DTOs.

That path matches the real architecture of this repo better than thinking in isolated files.

## Short Summary

IDS is a layered monolithic application with:

- a .NET API for auth, workload, tasks, and change workflows
- a React SPA for role-specific dashboards and task operations
- EF Core + Identity + JWT as the backend platform
- MUI + React Router + Axios as the frontend platform
- weighted workload calculations as a central business concept

The codebase favors directness and explicit boundaries over heavy framework abstraction. That makes it easier to navigate today, while putting most architectural weight in the infrastructure services and frontend page flows.
