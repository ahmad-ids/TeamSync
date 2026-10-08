namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskChangeAuditItemDto(
    Guid Id,
    string Field,
    string OldValue,
    string NewValue,
    string UpdatedByName,
    DateTimeOffset UpdatedAt,
    string Status,
    string? FromUserName = null,
    string? ToUserName = null,
    string? ActionByName = null);
