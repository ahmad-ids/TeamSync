using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record ChangeRequestDto(
    Guid Id,
    Guid TaskId,
    string TaskTitle,
    string RequesterId,
    string RequesterName,
    string AssignedMemberName,
    ChangeRequestType RequestType,
    string RequestTypeLabel,
    string OldValue,
    string NewValue,
    string Reason,
    DateTimeOffset SubmittedAt,
    ChangeRequestStatus Status,
    DateTimeOffset? ReviewedAt,
    string? ReviewedByName,
    double ImpactPercentage);
