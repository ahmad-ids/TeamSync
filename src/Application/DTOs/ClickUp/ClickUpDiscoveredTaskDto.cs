namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpDiscoveredTaskDto(
    string Id,
    string Name,
    string Description,
    string StatusName,
    string StatusType,
    bool IsClosed,
    string? Priority,
    IReadOnlyCollection<string> AssigneeIds,
    IReadOnlyCollection<string> AssigneeEmails,
    DateTimeOffset? DueDate,
    DateTimeOffset? StartDate,
    long? TimeEstimateMilliseconds,
    DateTimeOffset? DateUpdated,
    string ListId,
    string ListName,
    string? FolderId,
    string SpaceId,
    string WorkspaceId,
    string Url);
