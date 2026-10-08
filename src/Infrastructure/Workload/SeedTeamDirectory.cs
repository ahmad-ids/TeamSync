using IDS.Project.Domain.Enums;

namespace IDS.Project.Infrastructure.Workload;

internal static class SeedTeamDirectory
{
    private static readonly IReadOnlyDictionary<string, SeedMemberDirectoryEntry> MembersByEmail =
        new Dictionary<string, SeedMemberDirectoryEntry>(StringComparer.OrdinalIgnoreCase)
        {
            ["marcus.chen@ids.local"] = new("Senior Frontend Engineer", TaskSpecialization.Frontend),
            ["anita.lopez@ids.local"] = new("Senior Backend Engineer", TaskSpecialization.Backend),
            ["david.park@ids.local"] = new("Platform DevOps Engineer", TaskSpecialization.DevOps),
            ["elena.rodriguez@ids.local"] = new("Senior QA Engineer", TaskSpecialization.Qa),
            ["sanjay.kapoor@ids.local"] = new("Product UI/UX Designer", TaskSpecialization.UiUx),
            ["chloe.sims@ids.local"] = new("Backend Platform Engineer", TaskSpecialization.Backend),
            ["maya.saab@ids.local"] = new("Frontend Application Engineer", TaskSpecialization.Frontend),
            ["omar.khoury@ids.local"] = new("QA Automation Engineer", TaskSpecialization.Qa),
            ["lea.haddad@ids.local"] = new("UX Researcher", TaskSpecialization.UiUx),
            ["nour.haddad@ids.local"] = new("Release Operations Coordinator", TaskSpecialization.DevOps),
            ["fadi.nasr@ids.local"] = new("Site Reliability Engineer", TaskSpecialization.DevOps),
            ["rana.touma@ids.local"] = new("Visual Product Designer", TaskSpecialization.UiUx),
            ["lara.haddad@ids.local"] = new("Junior Frontend Developer", TaskSpecialization.Frontend),
            ["yusuf.nasser@ids.local"] = new("Junior Backend Developer", TaskSpecialization.Backend),
            ["jana.saab@ids.local"] = new("Junior QA Analyst", TaskSpecialization.Qa)
        };

    public static string ResolveJobTitle(string email) =>
        ResolveMemberEntry(email).JobTitle;

    public static TaskSpecialization ResolveSpecialization(string email) =>
        ResolveMemberEntry(email).Specialization;

    public static string ResolveSpecializationLabel(TaskSpecialization specialization) => specialization switch
    {
        TaskSpecialization.Frontend => "Frontend",
        TaskSpecialization.Backend => "Backend",
        TaskSpecialization.Qa => "QA",
        TaskSpecialization.UiUx => "UI/UX",
        TaskSpecialization.DevOps => "DevOps",
        TaskSpecialization.BusinessAnalysis => "Business Analysis",
        TaskSpecialization.ProjectCoordination => "Project Coordination",
        TaskSpecialization.Security => "Security",
        TaskSpecialization.Data => "Data",
        _ => "Unspecified"
    };

    private static SeedMemberDirectoryEntry ResolveMemberEntry(string email) =>
        MembersByEmail.TryGetValue(email, out var entry)
            ? entry
            : new SeedMemberDirectoryEntry("Software Team Specialist", TaskSpecialization.Unknown);

    private sealed record SeedMemberDirectoryEntry(string JobTitle, TaskSpecialization Specialization);
}
