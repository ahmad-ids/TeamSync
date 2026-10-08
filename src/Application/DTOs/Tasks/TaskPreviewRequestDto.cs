using IDS.Project.Domain.Enums;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskPreviewRequestDto(
    string AssignedMemberId,
    TaskSpecialization RequiredSpecialization,
    TaskPriority Priority,
    TaskComplexity Complexity,
    decimal EstimatedEffortHours,
    DateOnly StartDate,
    DateOnly DueDate,
    DomainTaskStatus Status,
    Guid? TaskId = null);
