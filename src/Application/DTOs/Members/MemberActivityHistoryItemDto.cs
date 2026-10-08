namespace IDS.Project.Application.DTOs.Members;

public sealed record MemberActivityHistoryItemDto(
    Guid Id,
    Guid? TaskId,
    string TaskTitle,
    string EventType,
    string Summary,
    string? Details,
    DateTimeOffset OccurredAt,
    string? FromUserName = null,
    string? ToUserName = null,
    string? ActionByName = null);
