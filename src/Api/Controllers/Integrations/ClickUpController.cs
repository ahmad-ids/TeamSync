using System.Security.Claims;
using IDS.Project.Application.Abstractions.Integrations.ClickUp;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace IDS.Project.Api.Controllers.Integrations;

[ApiController]
[Authorize(Roles = "TeamLeader")]
[Route("api/integrations/clickup")]
public sealed class ClickUpController(
    IMemoryCache cache,
    IClickUpConnectionService clickUpConnectionService,
    IClickUpApiClient clickUpApiClient,
    IClickUpTaskDiscoveryService clickUpTaskDiscoveryService,
    IClickUpSynchronizationService clickUpSynchronizationService,
    IClickUpTokenProtector clickUpTokenProtector,
    IWebHostEnvironment environment,
    ILogger<ClickUpController> logger) : ControllerBase
{
    private const string ClickUpSetupTicketCachePrefix = "auth.clickup.setup:";

    [HttpGet("workspaces")]
    public ActionResult<IEnumerable<ClickUpWorkspaceDto>> GetWorkspaces([FromQuery] string ticket)
    {
        var state = ResolveSetupTicket(ticket, out var error);
        if (state is null)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Workspace selection failed", detail: error);
        }

        if (!MatchesCurrentUser(state.ApplicationUserId))
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Workspace selection failed", detail: "You cannot use this workspace selection ticket.");
        }

        return Ok(state.Workspaces.Select(workspace => new ClickUpWorkspaceDto(workspace.WorkspaceId, workspace.WorkspaceName)));
    }

    [HttpPost("connect")]
    public async Task<ActionResult<ClickUpConnectionDto>> Connect([FromBody] ClickUpConnectRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Ticket) || string.IsNullOrWhiteSpace(request.WorkspaceId))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Workspace connection failed", detail: "A valid ticket and workspace are required.");
        }

        var state = ResolveSetupTicket(request.Ticket, out var error);
        if (state is null)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Workspace connection failed", detail: error);
        }

        if (!MatchesCurrentUser(state.ApplicationUserId))
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Workspace connection failed", detail: "You cannot use this workspace selection ticket.");
        }

        var workspace = state.Workspaces.FirstOrDefault(item => string.Equals(item.WorkspaceId, request.WorkspaceId, StringComparison.Ordinal));
        if (workspace is null)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Workspace connection failed", detail: "The selected workspace is not available for this ticket.");
        }

        try
        {
            await clickUpConnectionService.SaveConnectionAsync(
                state.ApplicationUserId,
                state.ClickUpUserId,
                state.AccessToken,
                workspace,
                cancellationToken);

            cache.Remove(GetSetupTicketCacheKey(request.Ticket));
            return Ok(new ClickUpConnectionDto(workspace.WorkspaceId, workspace.WorkspaceName, true));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to connect ClickUp workspace {WorkspaceId} for application user {ApplicationUserId}.", workspace.WorkspaceId, state.ApplicationUserId);
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Workspace connection failed", detail: "Unable to save the ClickUp workspace connection.");
        }
    }

    [HttpGet("connection")]
    public async Task<ActionResult<ClickUpConnectionDto?>> GetConnection(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var connection = await clickUpConnectionService.GetActiveConnectionAsync(userId, cancellationToken);
        return Ok(connection);
    }

    [HttpGet("discovery/structure")]
    public async Task<ActionResult<ClickUpDiscoveryStructureDto>> GetDiscoveryStructure(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var structure = await clickUpTaskDiscoveryService.GetDiscoveryStructureAsync(userId, cancellationToken);
            return structure is null
                ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Discovery failed", detail: "No active ClickUp connection exists for the current account.")
                : Ok(structure);
        }
        catch (ClickUpApiException exception)
        {
            logger.LogWarning(exception, "ClickUp structure discovery failed at {Endpoint} with status {StatusCode}.", exception.Endpoint, (int)exception.StatusCode);
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Discovery failed",
                detail: string.IsNullOrWhiteSpace(exception.Details)
                    ? "ClickUp returned an error while discovering workspace structure."
                    : exception.Details);
        }
    }

    [HttpGet("discovery/tasks")]
    public async Task<ActionResult<IReadOnlyList<ClickUpDiscoveredTaskDto>>> GetDiscoveryTasks(
        [FromQuery] string? listId,
        [FromQuery] bool includeClosed = true,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        try
        {
            var tasks = await clickUpTaskDiscoveryService.GetDiscoveredTasksAsync(userId, listId, includeClosed, limit, cancellationToken);
            return tasks is null
                ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Discovery failed", detail: "No active ClickUp connection exists for the current account.")
                : Ok(tasks);
        }
        catch (ArgumentException exception)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Discovery failed", detail: exception.Message);
        }
        catch (ClickUpApiException exception)
        {
            logger.LogWarning(exception, "ClickUp discovery request failed at {Endpoint} with status {StatusCode}.", exception.Endpoint, (int)exception.StatusCode);
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Discovery failed",
                detail: string.IsNullOrWhiteSpace(exception.Details)
                    ? "ClickUp returned an error while discovering workspace data."
                    : exception.Details);
        }
    }

    [HttpPost("sync")]
    public async Task<ActionResult<ClickUpSyncResult>> Sync(CancellationToken cancellationToken)
    {
        var currentUserId = CurrentUserId();
        if (currentUserId is null)
        {
            return Unauthorized();
        }

        if (!Guid.TryParse(currentUserId, out var currentUserGuid))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Sync failed", detail: "The current user identifier is invalid.");
        }

        try
        {
            var result = await clickUpSynchronizationService.SynchronizeAsync(currentUserGuid, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException exception)
        {
            var status = exception.Message.Contains("local team", StringComparison.OrdinalIgnoreCase)
                ? StatusCodes.Status400BadRequest
                : StatusCodes.Status404NotFound;

            return Problem(statusCode: status, title: "Sync failed", detail: exception.Message);
        }
        catch (ClickUpApiException exception)
        {
            logger.LogWarning(exception, "ClickUp synchronization failed at {Endpoint} with status {StatusCode}.", exception.Endpoint, (int)exception.StatusCode);
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Sync failed",
                detail: string.IsNullOrWhiteSpace(exception.Details)
                    ? "ClickUp returned an error while synchronizing workspace tasks."
                    : exception.Details);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unexpected ClickUp synchronization failure for user {UserId}.", currentUserId);
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Sync failed", detail: "Unable to synchronize ClickUp tasks.");
        }
    }

    [HttpGet("test-data")]
    public async Task<ActionResult<ClickUpTestDataDto>> TestData(CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        var userId = CurrentUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var errors = new List<string>();
        ClickUpConnectionDetailsDto? connection;
        try
        {
            connection = await clickUpConnectionService.GetActiveConnectionDetailsAsync(userId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ClickUp test-data failed while loading the active connection for user {UserId}.", userId);
            return Ok(FailedTestData(new[] { "A. active connection lookup" }));
        }

        if (connection is null)
        {
            return Ok(FailedTestData(new[] { "A. active connection lookup" }));
        }

        string accessToken;
        try
        {
            accessToken = clickUpTokenProtector.Unprotect(connection.ProtectedAccessToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ClickUp test-data failed while unprotecting the access token for user {UserId}.", userId);
            return Ok(FailedTestData(new[] { "B. token unprotection" }, connection));
        }

        var members = new List<ClickUpTestMemberDto>();
        var membersSucceeded = false;
        try
        {
            var clickUpMembers = await clickUpApiClient.GetWorkspaceMembersAsync(accessToken, connection.WorkspaceId, cancellationToken);
            membersSucceeded = true;
            members = clickUpMembers
                .Take(10)
                .Select(member => new ClickUpTestMemberDto(member.Id, member.FullName, member.Email))
                .ToList();
        }
        catch (ClickUpApiException ex)
        {
            logger.LogWarning(ex, "ClickUp test-data members request failed for workspace {WorkspaceId}.", connection.WorkspaceId);
            errors.Add($"C. ClickUp workspace/member request: {ex.Details}");
        }

        IReadOnlyList<ClickUpSpaceDto> spaces = Array.Empty<ClickUpSpaceDto>();
        var folders = new List<ClickUpFolderDto>();
        var lists = new List<ClickUpListDto>();
        var structureSucceeded = false;
        try
        {
            spaces = await clickUpApiClient.GetWorkspaceSpacesAsync(accessToken, connection.WorkspaceId, cancellationToken);
            structureSucceeded = true;

            foreach (var space in spaces)
            {
                var spaceFolders = await clickUpApiClient.GetSpaceFoldersAsync(accessToken, space.Id, cancellationToken);
                folders.AddRange(spaceFolders);

                var folderlessLists = await clickUpApiClient.GetSpaceListsAsync(accessToken, space.Id, cancellationToken);
                lists.AddRange(folderlessLists);

                foreach (var folder in spaceFolders)
                {
                    try
                    {
                        var folderLists = await clickUpApiClient.GetFolderListsAsync(accessToken, folder.Id, cancellationToken);
                        lists.AddRange(folderLists.Select(list => list with
                        {
                            SpaceId = folder.SpaceId,
                            FolderId = folder.Id
                        }));
                    }
                    catch (ClickUpApiException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.NotFound)
                    {
                        errors.Add($"D. Workspace structure discovery (folder {folder.Id}): {ex.Details}");
                    }
                }
            }
        }
        catch (ClickUpApiException ex)
        {
            logger.LogWarning(ex, "ClickUp test-data structure request failed for workspace {WorkspaceId}.", connection.WorkspaceId);
            errors.Add($"D. Workspace structure discovery: {ex.Details}");
        }

        var tasks = new List<ClickUpTestTaskDto>();
        var tasksSucceeded = false;
        try
        {
            tasksSucceeded = true;
            var normalizedLists = lists
                .GroupBy(list => list.Id, StringComparer.Ordinal)
                .Select(group => group.First())
                .Take(50)
                .ToArray();

            var seenTaskIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var list in normalizedLists)
            {
                try
                {
                    var listTasks = await clickUpApiClient.GetListTasksAsync(accessToken, list.Id, includeClosed: true, limit: 10, cancellationToken);
                    foreach (var task in listTasks)
                    {
                        if (!seenTaskIds.Add(task.Id))
                        {
                            continue;
                        }

                        tasks.Add(new ClickUpTestTaskDto(
                            task.Id,
                            task.Name,
                            task.StatusName,
                            task.AssigneeEmails.Take(10).ToArray(),
                            task.DueDate,
                            task.TimeEstimateMilliseconds));

                        if (tasks.Count >= 10)
                        {
                            break;
                        }
                    }
                }
                catch (ClickUpApiException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.NotFound)
                {
                    errors.Add($"E. Task retrieval (list {list.Id}): {ex.Details}");
                }

                if (tasks.Count >= 10)
                {
                    break;
                }
            }
        }
        catch (ClickUpApiException ex)
        {
            logger.LogWarning(ex, "ClickUp test-data tasks request failed for workspace {WorkspaceId}.", connection.WorkspaceId);
            errors.Add($"E. Task retrieval: {ex.Details}");
        }

        return Ok(new ClickUpTestDataDto(
            true,
            connection.WorkspaceId,
            connection.WorkspaceName,
            membersSucceeded,
            members.Count,
            members,
            structureSucceeded,
            spaces.Count,
            folders.Count,
            lists.Count,
            tasksSucceeded,
            tasks.Count,
            tasks,
            errors));
    }

    private static ClickUpTestDataDto FailedTestData(IReadOnlyCollection<string> errors, ClickUpConnectionDetailsDto? connection = null)
    {
        return new ClickUpTestDataDto(
            connection is not null,
            connection?.WorkspaceId ?? string.Empty,
            connection?.WorkspaceName ?? string.Empty,
            false,
            0,
            Array.Empty<ClickUpTestMemberDto>(),
            false,
            0,
            0,
            0,
            false,
            0,
            Array.Empty<ClickUpTestTaskDto>(),
            errors);
    }

    private ClickUpSetupTicketDto? ResolveSetupTicket(string ticket, out string error)
    {
        error = string.Empty;

        if (string.IsNullOrWhiteSpace(ticket))
        {
            error = "A valid workspace selection ticket is required.";
            return null;
        }

        if (!cache.TryGetValue(GetSetupTicketCacheKey(ticket), out ClickUpSetupTicketDto? state) || state is null)
        {
            error = "The workspace selection ticket is invalid or expired.";
            return null;
        }

        return state;
    }

    private bool MatchesCurrentUser(string applicationUserId)
    {
        return string.Equals(CurrentUserId(), applicationUserId, StringComparison.Ordinal);
    }

    private string? CurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
    }

    private static string GetSetupTicketCacheKey(string ticket) => $"{ClickUpSetupTicketCachePrefix}{ticket.Trim()}";

    public sealed record ClickUpConnectRequest(string Ticket, string WorkspaceId);
}
