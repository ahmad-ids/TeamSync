namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpTaskSyncModel(
    string TaskId,
    string Title,
    string Status,
    string? Priority,
    DateTimeOffset? StartDate,
    DateTimeOffset? DueDate,
    long? TimeEstimate,
    IReadOnlyCollection<ClickUpAssigneeSyncModel> Assignees,
    bool Archived);
