using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.Workload;

public sealed record WorkloadMemberDto(
    string MemberId,
    string FullName,
    string Email,
    string JobTitle,
    TaskSpecialization Specialization,
    string TeamName,
    int TotalTasks,
    decimal TotalEffortHours,
    double TotalWeight,
    double CapacityPercentage,
    WorkloadStatus Status,
    DateOnly? LastTaskDueDate);
