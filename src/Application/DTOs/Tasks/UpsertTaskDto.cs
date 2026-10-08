using IDS.Project.Domain.Enums;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record UpsertTaskDto(
    string Title,
    string Description,
    string AssignedMemberId,
    TaskSpecialization RequiredSpecialization,
    TaskPriority Priority,
    TaskComplexity Complexity,
    decimal EstimatedEffortHours,
    DateOnly StartDate,
    DateOnly DueDate,
    DomainTaskStatus Status);
