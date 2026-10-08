using IDS.Project.Application.DTOs.ClickUp;

namespace IDS.Project.Application.Abstractions.Services;

public interface IClickUpConnectionService
{
    Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default);

    Task<ClickUpConnectionDto?> GetActiveConnectionAsync(string applicationUserId, CancellationToken cancellationToken = default);

    Task<ClickUpConnectionDetailsDto?> GetActiveConnectionDetailsAsync(string applicationUserId, CancellationToken cancellationToken = default);

    Task<ClickUpConnectionDto> SaveConnectionAsync(
        string applicationUserId,
        string clickupUserId,
        string accessToken,
        ClickUpWorkspaceDto workspace,
        CancellationToken cancellationToken = default);

    Task DeactivateOtherConnectionsAsync(string applicationUserId, string activeWorkspaceId, CancellationToken cancellationToken = default);
}
