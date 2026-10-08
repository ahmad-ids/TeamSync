namespace IDS.Project.Application.DTOs.Workload;

public sealed record WorkloadSummaryDto(
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalTeamMembers,
    int TotalTasks,
    decimal TotalEffortHours,
    double TotalWeight,
    double CapacityPercentage,
    int OverloadedMembers,
    IReadOnlyCollection<WorkloadTeamDto> Teams,
    IReadOnlyCollection<WorkloadMemberDto> Members)
{
    public static WorkloadSummaryDto Empty() =>
        new(
            DateOnly.FromDateTime(DateTime.UtcNow),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            0,
            0,
            0,
            0,
            0,
            0,
            Array.Empty<WorkloadTeamDto>(),
            Array.Empty<WorkloadMemberDto>());
}
