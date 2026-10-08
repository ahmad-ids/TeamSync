namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskStatusTimelineItemDto(
    Guid Id,
    string Label,
    string Description,
    DateTimeOffset OccurredAt,
    bool IsCurrent);
