namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpSyncResult(
    int FetchedTasks,
    int Inserted,
    int Updated,
    int Skipped,
    IReadOnlyCollection<string> UnmatchedUsers,
    IReadOnlyCollection<string> Errors,
    bool TeamCreatedOrReused = true,
    bool TeamLeaderAssigned = true,
    int MembersFetched = 0,
    int MembersInserted = 0,
    int MembersUpdated = 0,
    int MembersSkipped = 0);
