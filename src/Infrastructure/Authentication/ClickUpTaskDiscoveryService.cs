using System.Net;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Entities;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class ClickUpTaskDiscoveryService(
    ApplicationDbContext dbContext,
    IClickUpApiClient clickUpApiClient,
    IClickUpTokenProtector tokenProtector,
    ILogger<ClickUpTaskDiscoveryService> logger) : IClickUpTaskDiscoveryService
{
    public async Task<ClickUpDiscoveryStructureDto?> GetDiscoveryStructureAsync(
        string applicationUserId,
        CancellationToken cancellationToken = default)
    {
        var connection = await LoadActiveConnectionAsync(applicationUserId, cancellationToken);
        if (connection is null)
        {
            return null;
        }

        var accessToken = tokenProtector.Unprotect(connection.ProtectedAccessToken);
        var structure = await DiscoverStructureAsync(connection.WorkspaceId, accessToken, cancellationToken);
        logger.LogDebug("Discovered ClickUp workspace structure for {ApplicationUserId}.", applicationUserId);

        return new ClickUpDiscoveryStructureDto(
            connection.WorkspaceId,
            connection.WorkspaceName,
            structure.Spaces,
            structure.Folders,
            structure.Lists,
            structure.Spaces.Count,
            structure.Folders.Count,
            structure.Lists.Count);
    }

    public async Task<IReadOnlyList<ClickUpDiscoveredTaskDto>?> GetDiscoveredTasksAsync(
        string applicationUserId,
        string? listId = null,
        bool includeClosed = true,
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var connection = await LoadActiveConnectionAsync(applicationUserId, cancellationToken);
        if (connection is null)
        {
            return null;
        }

        var accessToken = tokenProtector.Unprotect(connection.ProtectedAccessToken);
        var structure = await DiscoverStructureAsync(connection.WorkspaceId, accessToken, cancellationToken);
        var normalizedLimit = Math.Clamp(limit, 1, 500);
        logger.LogDebug("Discovered ClickUp tasks for {ApplicationUserId}.", applicationUserId);

        IReadOnlyCollection<ClickUpListDto> targetLists;
        if (!string.IsNullOrWhiteSpace(listId))
        {
            var selectedList = structure.Lists.FirstOrDefault(item => string.Equals(item.Id, listId, StringComparison.Ordinal));
            if (selectedList is null)
            {
                throw new ArgumentException("The requested list does not belong to the active ClickUp workspace.");
            }

            targetLists = new[] { selectedList };
        }
        else
        {
            targetLists = structure.Lists;
        }

        var discoveredTasks = new List<ClickUpDiscoveredTaskDto>();
        var seenTaskIds = new HashSet<string>(StringComparer.Ordinal);

        foreach (var list in targetLists)
        {
            if (discoveredTasks.Count >= normalizedLimit)
            {
                break;
            }

            var remaining = normalizedLimit - discoveredTasks.Count;
            IReadOnlyList<ClickUpDiscoveredTaskDto> tasks;
            try
            {
                tasks = await clickUpApiClient.GetListTasksAsync(accessToken, list.Id, includeClosed, remaining, cancellationToken);
            }
            catch (ClickUpApiException exception) when (exception.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
            {
                logger.LogWarning(
                    exception,
                    "Skipping inaccessible ClickUp list {ListId} while discovering tasks for {ApplicationUserId}.",
                    list.Id,
                    applicationUserId);
                continue;
            }

            foreach (var task in tasks)
            {
                if (!seenTaskIds.Add(task.Id))
                {
                    continue;
                }

                discoveredTasks.Add(task with
                {
                    ListId = list.Id,
                    ListName = list.Name,
                    FolderId = list.FolderId,
                    SpaceId = list.SpaceId,
                    WorkspaceId = connection.WorkspaceId
                });

                if (discoveredTasks.Count >= normalizedLimit)
                {
                    break;
                }
            }
        }

        return discoveredTasks;
    }

    private async Task<ClickUpConnection?> LoadActiveConnectionAsync(string applicationUserId, CancellationToken cancellationToken)
    {
        return await dbContext.ClickUpConnections
            .AsNoTracking()
            .Where(connection => connection.ApplicationUserId == applicationUserId && connection.IsActive)
            .OrderByDescending(connection => connection.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<DiscoveredStructure> DiscoverStructureAsync(string workspaceId, string accessToken, CancellationToken cancellationToken)
    {
        var spaces = await clickUpApiClient.GetWorkspaceSpacesAsync(accessToken, workspaceId, cancellationToken);
        var discoveredSpaces = spaces
            .GroupBy(space => space.Id, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();

        var folders = new List<ClickUpFolderDto>();
        var lists = new List<ClickUpListDto>();

        foreach (var space in discoveredSpaces)
        {
            var spaceFolders = await clickUpApiClient.GetSpaceFoldersAsync(accessToken, space.Id, cancellationToken);
            folders.AddRange(spaceFolders);

            var folderlessLists = await clickUpApiClient.GetSpaceListsAsync(accessToken, space.Id, cancellationToken);
            lists.AddRange(folderlessLists);

            foreach (var folder in spaceFolders)
            {
                var folderLists = await clickUpApiClient.GetFolderListsAsync(accessToken, folder.Id, cancellationToken);
                lists.AddRange(folderLists.Select(list => list with
                {
                    SpaceId = folder.SpaceId,
                    FolderId = folder.Id
                }));
            }
        }

        var normalizedFolders = folders
            .GroupBy(folder => folder.Id, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();

        var normalizedLists = lists
            .GroupBy(list => list.Id, StringComparer.Ordinal)
            .Select(group => group.First())
            .ToArray();

        return new DiscoveredStructure(discoveredSpaces, normalizedFolders, normalizedLists);
    }

    private sealed record DiscoveredStructure(
        IReadOnlyCollection<ClickUpSpaceDto> Spaces,
        IReadOnlyCollection<ClickUpFolderDto> Folders,
        IReadOnlyCollection<ClickUpListDto> Lists);
}
