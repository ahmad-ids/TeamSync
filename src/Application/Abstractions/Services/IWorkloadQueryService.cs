using IDS.Project.Application.DTOs.Members;
using IDS.Project.Application.DTOs.Workload;

namespace IDS.Project.Application.Abstractions.Services;

public interface IWorkloadQueryService
{
    Task<WorkloadSummaryDto> GetSummaryAsync(
        string currentUserId,
        string period,
        DateOnly? startDate,
        DateOnly? endDate,
        Guid? teamId,
        string? search,
        string? sortBy,
        CancellationToken cancellationToken = default);

    Task<MemberWorkloadDetailsDto?> GetMemberDetailsAsync(
        string memberId,
        string currentUserId,
        string period,
        DateOnly? startDate,
        DateOnly? endDate,
        bool includeCompletedTasks = false,
        CancellationToken cancellationToken = default);
}
