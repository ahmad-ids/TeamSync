using IDS.Project.Domain.Enums;

namespace IDS.Project.Infrastructure.Persistence;

internal static class SeedMemberProfiles
{
    public static readonly SeedMemberProfile[] All =
    [
        new(
            "marcus.chen@ids.local",
            "Marcus Chen",
            "Frontend Developer",
            4,
            18m,
            TaskComplexity.Complex,
            TaskPriority.High,
            [
                "Harden Google OAuth callback recovery",
                "Add auth sign-in retry and error states",
                "Wire role-aware redirects after sign-in",
                "Polish social login loading interactions"
            ],
            [
                "Finish the React callback flow for Google sign-in, including token exchange recovery and protected route fallback handling.",
                "Add resilient retry and recovery states for frontend auth failures so users can safely return to the sign-in flow.",
                "Update the router and auth provider so role-based destinations resolve cleanly after successful external sign-in.",
                "Polish the login and signup social sign-in interactions so loading and failure states stay clear during auth hardening work."
            ]),
        new(
            "anita.lopez@ids.local",
            "Anita Lopez",
            "Backend Developer",
            4,
            17m,
            TaskComplexity.Complex,
            TaskPriority.High,
            [
                "Refactor external login ticket exchange and JWT issuance",
                "Harden login and registration validation responses in auth endpoints",
                "Audit auth controller callback branches for provider failures",
                "Tighten duplicate-account handling in registration and external sign-in"
            ],
            [
                "Consolidate backend auth ticket exchange, role resolution, and JWT generation for external provider sign-in paths without breaking password login.",
                "Normalize backend auth validation and problem details responses so frontend error handling remains consistent across password and external auth.",
                "Review callback and remote-failure branches so provider errors surface with stable messages and no token leakage.",
                "Make duplicate-email and already-associated external login cases resolve consistently across all auth entry points."
            ]),
        new(
            "david.park@ids.local",
            "David Park",
            "DevOps Engineer",
            4,
            16m,
            TaskComplexity.Complex,
            TaskPriority.High,
            [
                "Stand up staging deployment pipeline for API and frontend auth changes",
                "Automate post-deploy smoke checks for auth and workload endpoints",
                "Rotate environment secret handling for OAuth and JWT settings",
                "Add deployment health probes for task and workload APIs"
            ],
            [
                "Build the CI/CD pipeline updates required for deploying the .NET API and Vite frontend together with environment-specific secrets and health checks.",
                "Add deployment verification steps that validate sign-in, token exchange, and the Team Leader workload API after each staging rollout.",
                "Move the OAuth and JWT configuration into environment-managed secrets with safer deployment validation.",
                "Add application health checks that detect auth, task, and workload regressions immediately after release."
            ]),
        new(
            "elena.rodriguez@ids.local",
            "Elena Rodriguez",
            "QA Engineer",
            3,
            13m,
            TaskComplexity.Medium,
            TaskPriority.Medium,
            [
                "Expand authentication regression coverage for role-based access",
                "Validate workload dashboard filtering and error recovery states",
                "Document post-release auth verification checklist"
            ],
            [
                "Create and execute regression scenarios that verify protected routes, Team Leader access, member access, and failed login edge cases across browsers.",
                "Run exploratory and scripted checks for search, period filters, loading states, and failed-fetch handling on the Team Leader dashboard.",
                "Summarize the repeatable QA checklist used to validate the full authentication rollout during release week."
            ]),
        new(
            "sanjay.kapoor@ids.local",
            "Sanjay Kapoor",
            "UI/UX Designer",
            3,
            12m,
            TaskComplexity.Medium,
            TaskPriority.Medium,
            [
                "Design improved login, signup, and callback state experiences",
                "Review workload dashboard card density and state clarity",
                "Prepare final interaction notes for task form previews"
            ],
            [
                "Produce the UI states for loading, empty, validation, and recovery moments in the auth journey so engineering can implement a consistent experience.",
                "Adjust the card-level visual language so overloaded, moderate, available, and unscheduled members remain easy to distinguish at a glance.",
                "Document the expected interaction behavior for live workload preview and validation messaging in task assignment flows."
            ]),
        new(
            "chloe.sims@ids.local",
            "Chloe Sims",
            "Backend Developer",
            3,
            14m,
            TaskComplexity.Simple,
            TaskPriority.High,
            [
                "Implement audit-ready change request approval records",
                "Refine task details response payload for timeline and audit consumers",
                "Stabilize change request metrics calculations for dashboard consumers"
            ],
            [
                "Extend backend change request processing so approved and rejected actions preserve reviewer attribution and a clean audit history for tasks.",
                "Tighten the task details API contract so the frontend can render audit entries and timelines without extra transformation or missing fields.",
                "Review the change request metrics payload so queue health and impact values remain consistent across filters and refreshes."
            ]),
        new(
            "maya.saab@ids.local",
            "Maya Saab",
            "Frontend Developer",
            3,
            12m,
            TaskComplexity.Medium,
            TaskPriority.Low,
            [
                "Integrate live workload preview into task creation flow",
                "Improve task form validation and save-failure messaging",
                "Polish task edit interactions for assignee and schedule changes"
            ],
            [
                "Wire the task form to the preview API and surface projected capacity impact in a way Team Leaders can act on before assignment.",
                "Refine task form field validation, save-error recovery, and helper text for assignment and scheduling edge cases.",
                "Tighten the task editing UX so assignee, status, and date changes remain clear during live editing."
            ]),
        new(
            "omar.khoury@ids.local",
            "Omar Khoury",
            "QA Automation Engineer",
            2,
            10m,
            TaskComplexity.Medium,
            TaskPriority.Low,
            [
                "Validate task lifecycle automation for role-specific access",
                "Prepare stable regression data for task workflow automation"
            ],
            [
                "Run automation coverage for task details, task edits, and Team Leader/member authorization boundaries across the workload workflows.",
                "Organize and verify the seeded task states needed for repeatable automation of task lifecycle and change request scenarios."
            ]),
        new(
            "lea.haddad@ids.local",
            "Lea Haddad",
            "UX Researcher",
            2,
            9m,
            TaskComplexity.Simple,
            TaskPriority.Medium,
            [
                "Run moderated usability review for the Team Leader assignment flow",
                "Synthesize role-based dashboard feedback into design recommendations"
            ],
            [
                "Interview Team Leaders on how they choose specialists and convert those findings into clear usability recommendations for the assignment journey.",
                "Review dashboard filter behavior and summarize the UX changes needed to make role-based staffing decisions faster and clearer."
            ]),
        new(
            "nour.haddad@ids.local",
            "Nour Haddad",
            "Release Operations Coordinator",
            2,
            9m,
            TaskComplexity.Simple,
            TaskPriority.Low,
            [
                "Coordinate release checklist for task assignment and workload updates",
                "Prepare deployment communication pack for Team Leader workflow changes"
            ],
            [
                "Track release readiness steps across frontend, backend, and test environments for the workload and assignment improvements.",
                "Publish the deployment timeline, rollback notes, and stakeholder communication plan for the next internal release."
            ]),
        new(
            "fadi.nasr@ids.local",
            "Fadi Nasr",
            "Site Reliability Engineer",
            2,
            8m,
            TaskComplexity.Medium,
            TaskPriority.Low,
            [
                "Tune API health probes and alert thresholds for workload services",
                "Improve build agent reliability for frontend and backend deployment jobs"
            ],
            [
                "Adjust the production-style health signals so Team Leader workload and task APIs report failures early during release testing.",
                "Stabilize the CI agents and job retries used by the frontend and backend delivery pipelines."
            ]),
        new(
            "rana.touma@ids.local",
            "Rana Touma",
            "Visual Product Designer",
            2,
            8m,
            TaskComplexity.Simple,
            TaskPriority.Low,
            [
                "Polish assignee selection states for role-matched member cards",
                "Prepare high-fidelity UI for filtered workload views and empty states"
            ],
            [
                "Refine the visual hierarchy of assignee cards so role, status, and workload cues remain readable during fast assignment decisions.",
                "Deliver the final UI states for filtered lists, empty role buckets, and overloaded-role guidance across the Team Leader experience."
            ]),
        new(
            "lara.haddad@ids.local",
            "Lara Haddad",
            "Junior Frontend Developer",
            2,
            7.5m,
            TaskComplexity.Simple,
            TaskPriority.Low,
            [
                "Implement responsive card spacing updates for the workload dashboard",
                "Fix keyboard focus states in the task assignment form"
            ],
            [
                "Apply the dashboard spacing and responsive polish needed to keep role-filtered member cards easy to scan on smaller screens.",
                "Improve focus handling and keyboard navigation in the task creation form so assignment remains accessible during quick team updates."
            ]),
        new(
            "yusuf.nasser@ids.local",
            "Yusuf Nasser",
            "Junior Backend Developer",
            2,
            8m,
            TaskComplexity.Simple,
            TaskPriority.Medium,
            [
                "Add API validation messages for missing role specialization on task create",
                "Write integration checks for task preview role-mismatch handling"
            ],
            [
                "Implement the validation path that rejects tasks missing a required specialization before they can be assigned.",
                "Add test coverage around role-mismatch preview requests so invalid assignments are rejected consistently."
            ]),
        new(
            "jana.saab@ids.local",
            "Jana Saab",
            "Junior QA Analyst",
            2,
            7m,
            TaskComplexity.Simple,
            TaskPriority.Low,
            [
                "Run smoke tests for role-filtered dashboard views",
                "Verify assignee suggestions stay within the selected specialization"
            ],
            [
                "Validate that each role filter returns the expected member set and correct workload order on the Team Leader dashboard.",
                "Check that task assignment suggestions remain within the selected specialization even when only moderate or overloaded members exist."
            ])
    ];
}

internal sealed record SeedMemberProfile(
    string Email,
    string FullName,
    string JobTitle,
    int ThisWeekTaskCount,
    decimal ThisWeekTotalHours,
    TaskComplexity Complexity,
    TaskPriority Priority,
    string[] TaskTitles,
    string[] TaskDescriptions);
