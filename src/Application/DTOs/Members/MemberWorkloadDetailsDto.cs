using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.Members;

public sealed record MemberWorkloadDetailsDto(
    string MemberId,
    string FullName,
    string JobTitle,
    string Email,
    string TeamName,
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalTasks,
    int TaskDeltaFromPreviousPeriod,
    decimal TotalEffortHours,
    double TotalWeight,
    double CapacityPercentage,
    double ImpactScore,
    int BlockedTasks,
    int CriticalTasks,
    string Insight,
    WorkloadStatus Status,
    IReadOnlyCollection<MemberPrioritySplitDto> PrioritySplit,
    IReadOnlyCollection<decimal> DailyEffortHours,
    IReadOnlyCollection<MemberActivityHistoryItemDto> History,
    IReadOnlyCollection<TaskListItemDto> Tasks)
{
    public static MemberWorkloadDetailsDto Empty(string id) =>
        new(
            id,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            default,
            default,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            string.Empty,
            WorkloadStatus.Available,
            Array.Empty<MemberPrioritySplitDto>(),
            Array.Empty<decimal>(),
            Array.Empty<MemberActivityHistoryItemDto>(),
            Array.Empty<TaskListItemDto>());
}
