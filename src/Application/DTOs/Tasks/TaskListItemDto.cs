using IDS.Project.Domain.Enums;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskListItemDto(
    Guid Id,
    string Title,
    string AssignedMemberName,
    TaskPriority Priority,
    TaskComplexity Complexity,
    decimal EstimatedEffortHours,
    double CalculatedWeight,
    DateOnly DueDate,
    DomainTaskStatus Status,
    bool IsAcknowledged,
    DateTimeOffset? AcknowledgedAt);
