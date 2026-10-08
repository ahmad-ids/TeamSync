# Technical Documentation

# Web-Based Team Workload & Task Tracking System

## 1. Project Overview

### 1.1 Purpose

The purpose of this system is to help a Team Leader:

- Track tasks assigned to each team member
- Monitor workload for the current and upcoming weeks
- Distribute tasks fairly based on workload
- View detailed breakdown of task effort and weight
- Track confirmations (acknowledgements) and approvals for task changes

### 1.2 Main Problem This System Solves

Instead of only counting the number of tasks per person, this system calculates **workload based on task effort and importance**, allowing fair and data-driven task distribution.

---

## 2. System Scope

### 2.1 In Scope

The system includes:

1. User authentication (credentials + Google / GitHub / ClickUp OAuth)
2. Role-based access (Team Leader, Member)
3. Task management (Create, Update, Delete, View)
4. Weekly workload calculation
5. Task weight calculation
6. Member workload dashboard
7. Task detail drill-down
8. Simple approval system for major changes
9. Task acknowledgement by assigned member
10. Two-sided task reassignment workflow
11. Task specialization matching
12. ClickUp workspace synchronization

---

## 3. System Architecture

### 3.1 Technology Stack

#### Backend

- .NET 8 Web API
- SQL Server

#### Frontend

- React + TypeScript
- Vite
- Material UI (theme-driven; `styled()` / `sx`, with selective plain CSS)
- React Router
- Axios

#### Authentication

- ASP.NET Identity with JWT bearer tokens
- OAuth 2.0 — Google, GitHub, ClickUp

### 3.2 Architecture Style

Monolithic web application, simplified layered design:

```text
React SPA → axios service wrappers → ASP.NET Core controllers
          → Application service interfaces
          → Infrastructure implementations
          → EF Core / Identity / SQL Server
```

This is deliberately **not** textbook Clean Architecture. `Application` holds
service contracts and DTOs plus one shared calculator; `Infrastructure` is the
largest layer and carries most use-case logic; `Api` stays thin and acts as the
transport and authorization boundary.

For the full architectural rationale, layer-by-layer breakdown, and request-flow
walkthroughs, see [`../architecture.md`](../architecture.md).

---

## 4. User Roles

The system defines **two** roles, declared in
`src/Domain/Constants/RoleNames.cs`:

```csharp
public const string TeamLeader = "TeamLeader";
public const string Member     = "Member";
```

### 4.1 Team Leader

- Create, edit, delete, and assign tasks
- Reassign tasks
- Approve or reject change requests
- View the team workload dashboard and per-member detail
- Connect and synchronize a ClickUp workspace

### 4.2 Member

- View assigned tasks and personal workload
- Update task status
- Acknowledge assigned tasks
- Raise change requests

> **No Admin role exists.** An Admin role was specified in an earlier draft of
> this document but was never implemented. The administrative duties it listed
> are handled elsewhere: users and teams are provisioned by the seeding code in
> `src/Infrastructure/Persistence/`, and weight multipliers are compiled
> constants in `WorkloadCalculator` rather than runtime configuration. The
> `WeightMultiplierSettings` table exists but is not used to drive calculation
> (see §5.3).

---

## 5. Functional Requirements

### 5.1 User Management

- Create user
- Assign role
- Assign user to team
- Login / Logout

### 5.2 Task Management

Each task contains:

- Title
- Description
- Assigned Member
- Priority (Low / Medium / High / Critical)
- Complexity (Simple / Medium / Complex)
- Estimated Effort (Hours)
- Start Date
- Due Date
- Status (New / In Progress / Blocked / Done)

### 5.3 Task Weight Calculation

**Formula**

```text
Weight = EffortHours × ComplexityMultiplier × PriorityMultiplier
```

#### Complexity Multiplier

| Complexity | Multiplier |
|------------|-----------:|
| Simple | 1.0 |
| Medium | 1.5 |
| Complex | 2.0 |

#### Priority Multiplier

| Priority | Multiplier |
|---------|-----------:|
| Low | 1.0 |
| Medium | 1.2 |
| High | 1.5 |
| Critical | 2.0 |

Weights are rounded to one decimal place and persisted on
`TaskItem.CalculatedWeight`.

#### ⚠️ The multiplier tables are duplicated in five places

The contract is `IWorkloadCalculator` / `WorkloadCalculator`, but the same
numbers are independently restated across the codebase:

| # | Location | Form |
|---|----------|------|
| 1 | `src/Application/Services/WorkloadCalculator.cs` | canonical `IReadOnlyDictionary` pair |
| 2 | `src/Infrastructure/ChangeRequests/ChangeRequestService.cs` | private `CalculateWeight` with `decimal` switches |
| 3 | `src/Infrastructure/Tasks/TaskCommandService.cs` | `ResolveComplexityMultiplier` / `ResolvePriorityMultiplier` |
| 4 | `src/Infrastructure/Tasks/TaskQueryService.cs` | `ResolveComplexityMultiplier` / `ResolvePriorityMultiplier` |
| 5 | `WeightMultiplierSettings` table | seeded by `ApplicationDbContextSeed`, **never read** |

All five currently hold identical values, so there is **no behavioural bug
today**. Copies 3 and 4 exist to expose the individual multipliers in
`TaskPreviewDto` / `TaskDetailsDto`, which the interface does not surface;
copy 2 is a plain duplicate.

Anyone changing a multiplier must change every applicable copy. Copy 5 is the
trap: it looks like the configuration source and is not.

### 5.4 Weekly Workload Calculation

For each member:

- Sum all task weights within the selected week.
- Sum all effort hours within the selected week.

Supported views:

- This Week
- Next Week
- Custom Date Range

### 5.5 Workload Status Indicator

| Weekly Weight | Status |
|--------------:|--------|
| 0–15 | Available (Green) |
| 16–25 | Moderate (Yellow) |
| 26+ | Overloaded (Red) |

### 5.6 Member Dashboard

Displays:

- Member list
- Total tasks per week
- Total effort
- Total weight
- Status indicator (Green / Yellow / Red)

Selecting a member displays:

- Assigned tasks
- Task weight breakdown

### 5.7 Task Details Screen

Displays:

- Full task information
- Weight calculation breakdown
- Status history
- Assigned member
- Change history

### 5.8 Approval System

Approval required for:

- Changing task owner
- Changing due date
- Increasing effort estimate

Workflow:

1. Member requests change.
2. System creates a pending change.
3. Team Leader approves or rejects.
4. If approved, the task is updated.

### 5.9 Task Acknowledgement

When a task is assigned:

- Member clicks **Acknowledge**.
- System records the acknowledgement date.

Purpose: Prevents situations where a member claims they never saw the task.

### 5.10 Task Reassignment

Separate from §5.8, reassignment is a **two-sided** workflow backed by
`TaskReassignmentRequest`. Both the current assignee and the proposed assignee
carry their own decision and response timestamp, and a Team Leader finalizes
the request.

### 5.11 Task Specialization

Each task carries a `RequiredSpecialization`. `ChangeRequestService` enforces a
role match, so a task cannot be assigned to a member whose specialization does
not fit.

### 5.12 ClickUp Synchronization

A Team Leader can bind a ClickUp workspace to a team and import its members and
tasks into SQL Server. The workload dashboard always reads local SQL — it never
calls ClickUp at request time. See
[`README.md`](README.md#clickup-synchronization) for field-level mapping.

---

## 6. Data Model

Reference: `src/Domain/Entities/`, `src/Infrastructure/Persistence/ApplicationDbContext.cs`

`ApplicationDbContext` extends `IdentityDbContext<ApplicationUser>`, so ASP.NET
Identity tables and business tables share one database and one context.

### 6.1 Common base

Every business entity derives from `BaseEntity`:

| Field | Type | Notes |
|-------|------|-------|
| `Id` | `Guid` | defaults to `Guid.NewGuid()` |
| `CreatedAt` | `DateTimeOffset` | defaults to UTC now |
| `UpdatedAt` | `DateTimeOffset` | defaults to UTC now |

### 6.2 ApplicationUser

Extends `IdentityUser` with: `FullName`, `TeamId` (`Guid?`), `IsActive`,
`ClickUpUserId` (`string?`, unique filtered index), `CreatedAt`, `UpdatedAt`.

Note that team membership lives on the **user**, while `Team.LeaderId` points
back at a user — there is no join table.

### 6.3 Entities and tables

| Entity | DbSet / table | Purpose |
|--------|---------------|---------|
| `Team` | `Teams` | `Name`, `LeaderId`, `Tasks` |
| `TaskItem` | `Tasks` | the central work unit |
| `TaskStatusHistory` | `TaskStatusHistories` | old → new status, who, when |
| `TaskChangeRequest` | `TaskChangeRequests` | §5.8 approval workflow |
| `TaskReassignmentRequest` | `TaskReassignmentRequests` | §5.10 two-sided workflow |
| `WeightMultiplierSetting` | `WeightMultiplierSettings` | seeded, **never read** (§5.3) |
| `ClickUpConnection` | `ClickUpConnections` | encrypted per-user workspace token |

### 6.4 TaskItem

| Field | Type | Notes |
|-------|------|-------|
| `Title` | `string` | max 200, required |
| `Description` | `string` | |
| `AssignedMemberId` | `string` | max 450, required (Identity user id) |
| `CreatedById` | `string` | max 450, required |
| `TeamId` | `Guid` | FK → `Teams`, **`Restrict`** on delete |
| `Priority` | `TaskPriority` | |
| `Complexity` | `TaskComplexity` | |
| `RequiredSpecialization` | `TaskSpecialization` | stored as `int` |
| `EstimatedEffortHours` | `decimal` | precision `(8,2)` |
| `StartDate` / `DueDate` | `DateOnly` | |
| `Status` | `TaskStatus` | |
| `CalculatedWeight` | `double` | persisted, rounded to 1 dp |
| `IsAcknowledged` | `bool` | §5.9 |
| `AcknowledgedAt` | `DateTimeOffset?` | |
| `ExternalId` | `string?` | max 100 — ClickUp task id |
| `ExternalSource` | `string?` | max 50 — `"ClickUp"` |

`(ExternalSource, ExternalId)` carries a **unique filtered index**
(`WHERE [ExternalSource] IS NOT NULL AND [ExternalId] IS NOT NULL`), which is
what makes ClickUp sync idempotent.

### 6.5 Delete behaviour

- `Tasks` → `Teams`: **`Restrict`** — a team with tasks cannot be deleted
- `TaskStatusHistories`, `TaskChangeRequests`, `TaskReassignmentRequests` → `Tasks`: **`Cascade`**
- `ClickUpConnections` → `AspNetUsers`: **`Cascade`**
- `ClickUpConnections` → `Teams`: **`Restrict`**

### 6.6 Enumerations

All enums are 1-based except `TaskSpecialization`, which starts at `Unknown = 0`.

| Enum | Values |
|------|--------|
| `TaskStatus` | `New`, `InProgress`, `Blocked`, `Done` |
| `TaskPriority` | `Low`, `Medium`, `High`, `Critical` |
| `TaskComplexity` | `Simple`, `Medium`, `Complex` |
| `WorkloadStatus` | `Available`, `Moderate`, `Overloaded` |
| `ChangeRequestStatus` | `Pending`, `Approved`, `Rejected` |
| `ChangeRequestType` | `ChangeOwner`, `ChangeDueDate`, `IncreaseEstimatedEffort` |
| `TaskSpecialization` | `Unknown`, `Frontend`, `Backend`, `Qa`, `UiUx`, `DevOps`, `BusinessAnalysis`, `ProjectCoordination`, `Security`, `Data` |

---

## 7. API Reference

All controllers are under `/api`. Responses are DTOs from
`src/Application/DTOs/` — EF entities are never returned directly.

### 7.1 Auth — `/api/auth`

Anonymous unless marked. OAuth routes are listed in
[`README.md`](README.md#oauth-routes).

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/register` | |
| `POST` | `/login` | returns a JWT |
| `GET` | `/me` | `[Authorize]` |
| `POST` | `/forgot-password` | |
| `GET` | `/password-reset` | validates a reset token |
| `POST` | `/reset-password` | |

### 7.2 Workload — `/api/workload`

`[Authorize(Roles = "TeamLeader,Member")]`

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | `WorkloadSummaryDto` for the caller's team scope |

### 7.3 Members — `/api/members`

| Method | Path | Role |
|--------|------|------|
| `GET` | `/me/workload` | `Member` |
| `GET` | `/{id}/workload` | `TeamLeader` |

### 7.4 Tasks — `/api/tasks`

`[Authorize]` at controller level; per-action roles below.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/` | any authenticated |
| `GET` | `/{id:guid}` | any authenticated |
| `GET` | `/form-options` | `TeamLeader` |
| `POST` | `/preview` | `TeamLeader` — weight preview before saving |
| `POST` | `/` | `TeamLeader` |
| `PUT` | `/{id:guid}` | `TeamLeader` |
| `DELETE` | `/{id:guid}` | `TeamLeader` |
| `POST` | `/{id:guid}/reassign` | `TeamLeader` |
| `GET` | `/{id:guid}/change-request-options` | `Member` |
| `POST` | `/{id:guid}/acknowledge` | `Member` |
| `POST` | `/{id:guid}/status` | `Member` |

### 7.5 Change Requests — `/api/change-requests`

| Method | Path | Role |
|--------|------|------|
| `GET` | `/` | `TeamLeader,Member` |
| `POST` | `/` | `Member` |
| `POST` | `/{id:guid}/approve` | `TeamLeader` |
| `POST` | `/{id:guid}/reject` | `TeamLeader` |

### 7.6 ClickUp Integration — `/api/integrations/clickup`

`[Authorize(Roles = "TeamLeader")]` for the whole controller. See
[`README.md`](README.md#clickup-api-endpoints) for the endpoint table.

### 7.7 Authorization model

Authorization is enforced at **two** levels, and both matter:

1. **Transport** — `[Authorize]` and `Roles` constraints on controllers/actions.
2. **Object level** — services re-check scope and ownership (same-team access,
   assigned-member access). Role checks alone are not sufficient, since
   `GET /api/tasks/{id}` is open to any authenticated user and relies on
   `TaskQueryService` to enforce access.

---

## 8. UI Requirements

### 8.1 Routes and pages

Defined in `frontend/src/app/routes.tsx`. Guards are `PublicOnlyRoute`,
`ProtectedRoute`, and `RoleRoute`, so a role never renders a page it cannot access.

**Public (redirect away if already signed in)**

| Route | Page |
|-------|------|
| `/login` | `LoginPage` |
| `/signup` | `SignupPage` |
| `/forgot-password` | `ForgotPasswordPage` |
| `/reset-password` | `ResetPasswordPage` |
| `/oauth/callback` | `OAuthCallbackPage` |

**Team Leader**

| Route | Page |
|-------|------|
| `/` | `DashboardPage` — team workload overview |
| `/members/:memberId` | `MemberDetailsPage` |
| `/tasks/new` | `TaskFormPage` |
| `/tasks/:taskId/edit` | `TaskFormPage` |
| `/change-requests` | `ChangeRequestsPage` |
| `/integrations/clickup/select` | `ClickUpWorkspaceSelectionPage` |

**Member**

| Route | Page |
|-------|------|
| `/member` | `MemberDashboardPage` |
| `/member/tasks` | `MyTasksPage` |
| `/member/change-requests` | `MyChangeRequestsPage` |
| `/member/history` | `MemberActivityPage` |

**Any authenticated role**

| Route | Page |
|-------|------|
| `/tasks/:taskId` | `TaskDetailsPage` — access enforced server-side |

### 8.2 Dashboard Layout

The dashboard displays:

- Week selector (This Week / Next Week / Custom Range)
- Member list
- Workload colour indicators (green / yellow / red per §5.5)
- Total weight
- Total effort

### 8.3 Theming

Two MUI themes are applied: `publicTheme` for unauthenticated auth-facing pages
and `appTheme` inside the authenticated shell. Workload colour helpers live in
`frontend/src/theme/theme.ts` so the status colours stay consistent across the
dashboard, member details, and task screens.
