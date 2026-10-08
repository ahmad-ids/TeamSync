using IDS.Project.Application.DTOs.ChangeRequests;
using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.Abstractions.Services;

public interface IChangeRequestService
{
    Task<ChangeRequestListResponseDto?> GetChangeRequestsAsync(
        ChangeRequestStatus? status,
        ChangeRequestType? type,
        string? search,
        string? sort,
        string currentUserId,
        bool isMember,
        Guid? taskId = null,
        CancellationToken cancellationToken = default);

    Task<ChangeRequestOptionsDto?> GetChangeRequestOptionsAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<ChangeRequestDto?> CreateChangeRequestAsync(
        CreateChangeRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<ChangeRequestDto?> ApproveAsync(
        Guid id,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<ChangeRequestDto?> RejectAsync(
        Guid id,
        string currentUserId,
        CancellationToken cancellationToken = default);
}
