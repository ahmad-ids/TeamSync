using IDS.Project.Application.DTOs.ClickUp;

namespace IDS.Project.Application.Abstractions.Services;

public interface IClickUpApiClient
{
    Task<ClickUpUserInfoDto> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpMemberDto>> GetWorkspaceMembersAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpSpaceDto>> GetWorkspaceSpacesAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpFolderDto>> GetSpaceFoldersAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpListDto>> GetSpaceListsAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpListDto>> GetFolderListsAsync(string accessToken, string folderId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpDiscoveredTaskDto>> GetListTasksAsync(
        string accessToken,
        string listId,
        bool includeClosed = true,
        int limit = 100,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpTaskSyncModel>> GetWorkspaceTasksAsync(
        string accessToken,
        string workspaceId,
        CancellationToken cancellationToken = default);
}
