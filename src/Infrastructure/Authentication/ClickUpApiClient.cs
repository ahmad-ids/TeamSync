using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Enums;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class ClickUpApiClient(
    HttpClient httpClient,
    IWorkloadCalculator workloadCalculator,
    ILogger<ClickUpApiClient> logger,
    IHostEnvironment hostEnvironment) : IClickUpApiClient
{
    public async Task<ClickUpUserInfoDto> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, "user", accessToken, cancellationToken);
        var user = document.RootElement.TryGetProperty("user", out var userElement) ? userElement : document.RootElement;

        return new ClickUpUserInfoDto(
            GetRequiredString(user, "id"),
            GetOptionalString(user, "email") ?? string.Empty);
    }

    public async Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, "team", accessToken, cancellationToken);
        logger.LogDebug("ClickUp GET /team raw response: {Payload}", document.RootElement.GetRawText());
        var teamsElement =
            TryGetPropertyCaseInsensitive(document.RootElement, "teams")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "workspaces")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "team")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");

        return ParseArray(teamsElement, element =>
        {
            var id = GetOptionalString(element, "id");
            var name = GetOptionalString(element, "name");
            return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)
                ? null
                : new ClickUpWorkspaceDto(id, name);
        });
    }

    public async Task<IReadOnlyList<ClickUpMemberDto>> GetWorkspaceMembersAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, $"team/{workspaceId}", accessToken, cancellationToken);
        logger.LogDebug("ClickUp GET team/{WorkspaceId} raw response: {Payload}", workspaceId, document.RootElement.GetRawText());
        var people = ExtractWorkspacePeople(document.RootElement).ToArray();

        logger.LogInformation(
            "ClickUp workspace {WorkspaceId} resolved {MemberCount} member(s), {RoledMemberCount} of which carry a role.",
            workspaceId,
            people.Length,
            people.Count(person => !string.IsNullOrWhiteSpace(person.Role)));

        return people;
    }

    public async Task<IReadOnlyList<ClickUpSpaceDto>> GetWorkspaceSpacesAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, $"team/{workspaceId}/space?archived=false", accessToken, cancellationToken);
        var spacesElement =
            TryGetPropertyCaseInsensitive(document.RootElement, "spaces")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "teams")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");

        return ParseArray(spacesElement, element =>
        {
            var id = GetOptionalString(element, "id");
            var name = GetOptionalString(element, "name");
            return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)
                ? null
                : new ClickUpSpaceDto(id, name);
        });
    }

    public async Task<IReadOnlyList<ClickUpFolderDto>> GetSpaceFoldersAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, $"space/{spaceId}/folder?archived=false", accessToken, cancellationToken);
        var foldersElement =
            TryGetPropertyCaseInsensitive(document.RootElement, "folders")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");

        return ParseArray(foldersElement, element =>
        {
            var id = GetOptionalString(element, "id");
            var name = GetOptionalString(element, "name");
            var resolvedSpaceId = GetOptionalString(element, "space_id") ?? spaceId;
            return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)
                ? null
                : new ClickUpFolderDto(id, name, resolvedSpaceId);
        });
    }

    public async Task<IReadOnlyList<ClickUpListDto>> GetSpaceListsAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, $"space/{spaceId}/list?archived=false", accessToken, cancellationToken);
        var listsElement =
            TryGetPropertyCaseInsensitive(document.RootElement, "lists")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");

        return ParseArray(listsElement, element => ParseList(element, spaceId));
    }

    public async Task<IReadOnlyList<ClickUpListDto>> GetFolderListsAsync(string accessToken, string folderId, CancellationToken cancellationToken = default)
    {
        using var document = await SendAndParseAsync(HttpMethod.Get, $"folder/{folderId}/list?archived=false", accessToken, cancellationToken);
        var listsElement =
            TryGetPropertyCaseInsensitive(document.RootElement, "lists")
            ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");

        return ParseArray(listsElement, element => ParseList(element, null, folderId));
    }

    public async Task<IReadOnlyList<ClickUpDiscoveredTaskDto>> GetListTasksAsync(
        string accessToken,
        string listId,
        bool includeClosed = true,
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var maxLimit = Math.Clamp(limit, 1, 500);
        var discoveredTasks = new List<ClickUpDiscoveredTaskDto>();
        var seenTaskIds = new HashSet<string>(StringComparer.Ordinal);
        var page = 0;
        const int pageSize = 100;

        while (discoveredTasks.Count < maxLimit)
        {
            var path = $"list/{listId}/task?archived=false&include_closed={includeClosed.ToString().ToLowerInvariant()}&page={page}";
            using var document = await SendAndParseAsync(HttpMethod.Get, path, accessToken, cancellationToken);

            var tasksElement = TryGetPropertyCaseInsensitive(document.RootElement, "tasks") ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");
            var pageTasks = ParseArray(tasksElement, element => ParseTask(element, listId));

            if (pageTasks.Count == 0)
            {
                break;
            }

            foreach (var task in pageTasks)
            {
                if (!seenTaskIds.Add(task.Id))
                {
                    continue;
                }

                discoveredTasks.Add(task);
                if (discoveredTasks.Count >= maxLimit)
                {
                    break;
                }
            }

            if (pageTasks.Count < pageSize)
            {
                break;
            }

            page++;
        }

        return discoveredTasks;
    }

    public async Task<IReadOnlyList<ClickUpTaskSyncModel>> GetWorkspaceTasksAsync(
        string accessToken,
        string workspaceId,
        CancellationToken cancellationToken = default)
    {
        var workspaceTasks = new List<ClickUpTaskSyncModel>();
        var seenTaskIds = new HashSet<string>(StringComparer.Ordinal);
        var diagnosticCount = 0;

        var spaces = await GetWorkspaceSpacesAsync(accessToken, workspaceId, cancellationToken);
        foreach (var space in spaces.GroupBy(space => space.Id, StringComparer.Ordinal).Select(group => group.First()))
        {
            var spaceLists = await GetSpaceListsAsync(accessToken, space.Id, cancellationToken);
            var folders = await GetSpaceFoldersAsync(accessToken, space.Id, cancellationToken);
            var folderLists = new List<ClickUpListDto>();

            foreach (var folder in folders.GroupBy(folder => folder.Id, StringComparer.Ordinal).Select(group => group.First()))
            {
                var lists = await GetFolderListsAsync(accessToken, folder.Id, cancellationToken);
                folderLists.AddRange(lists.Select(list => list with
                {
                    SpaceId = folder.SpaceId,
                    FolderId = folder.Id
                }));
            }

            var listsToQuery = spaceLists
                .Concat(folderLists)
                .GroupBy(list => list.Id, StringComparer.Ordinal)
                .Select(group => group.First())
                .ToArray();

            foreach (var list in listsToQuery)
            {
                IReadOnlyList<ClickUpTaskSyncModel> listTasks;
                try
                {
                    listTasks = await GetListTasksForSyncAsync(accessToken, list, cancellationToken);
                }
                catch (ClickUpApiException exception) when (exception.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden)
                {
                    continue;
                }

                foreach (var task in listTasks)
                {
                    if (!seenTaskIds.Add(task.TaskId))
                    {
                        continue;
                    }

                    workspaceTasks.Add(task);
                    if (IsDevelopmentEnvironment() && diagnosticCount < 10 && task.TimeEstimate.GetValueOrDefault() > 0)
                    {
                        var effortHours = Math.Round((decimal)task.TimeEstimate.Value / 3_600_000m, 2, MidpointRounding.AwayFromZero);
                        var priority = ResolveTaskPriority(task.Priority);
                        var calculatedWeight = Math.Round(workloadCalculator.CalculateWeight(effortHours, TaskComplexity.Simple, priority), 1);
                        logger.LogInformation(
                            "ClickUp positive-effort task {Index}: TaskId={TaskId}; Name={Name}; time_estimate_ms={TimeEstimateMs}; effort_hours={EffortHours}; calculated_weight={CalculatedWeight}",
                            diagnosticCount + 1,
                            task.TaskId,
                            task.Title,
                            task.TimeEstimate.Value,
                            effortHours,
                            calculatedWeight);
                        diagnosticCount++;
                    }
                }
            }
        }

        return workspaceTasks;
    }

    private async Task<IReadOnlyList<ClickUpTaskSyncModel>> GetListTasksForSyncAsync(
        string accessToken,
        ClickUpListDto list,
        CancellationToken cancellationToken)
    {
        var discoveredTasks = new List<ClickUpTaskSyncModel>();
        var seenTaskIds = new HashSet<string>(StringComparer.Ordinal);
        var page = 0;
        const int pageSize = 100;
        var diagnosticCount = 0;

        while (true)
        {
            var path = $"list/{list.Id}/task?archived=false&include_closed=true&page={page}";
            using var document = await SendAndParseAsync(HttpMethod.Get, path, accessToken, cancellationToken);

            var tasksElement = TryGetPropertyCaseInsensitive(document.RootElement, "tasks") ?? TryGetPropertyCaseInsensitive(document.RootElement, "data");
            if (IsDevelopmentEnvironment() && diagnosticCount < 10)
            {
                diagnosticCount += LogTaskDiagnostics(tasksElement, list.Id, diagnosticCount);
            }
            var pageTasks = ParseArray(tasksElement, element => ParseSyncTask(element));

            if (pageTasks.Count == 0)
            {
                break;
            }

            foreach (var task in pageTasks)
            {
                if (!seenTaskIds.Add(task.TaskId))
                {
                    continue;
                }

                discoveredTasks.Add(task);
            }

            if (pageTasks.Count < pageSize)
            {
                break;
            }

            page++;
        }

        return discoveredTasks;
    }

    private bool IsDevelopmentEnvironment()
        => string.Equals(hostEnvironment.EnvironmentName, Environments.Development, StringComparison.OrdinalIgnoreCase);

    private int LogTaskDiagnostics(JsonElement? tasksElement, string listId, int alreadyLogged)
    {
        if (tasksElement is null || tasksElement.Value.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        var logged = 0;
        foreach (var task in tasksElement.Value.EnumerateArray())
        {
            if (alreadyLogged + logged >= 10)
            {
                break;
            }

            var id = GetOptionalString(task, "id") ?? string.Empty;
            var name = GetOptionalString(task, "name") ?? string.Empty;
            var timeEstimate = GetRawPropertyText(task, "time_estimate");
            var priority = GetRawPropertyText(task, "priority");
            var status = GetRawPropertyText(task, "status");
            var startDate = GetRawPropertyText(task, "start_date");
            var dueDate = GetRawPropertyText(task, "due_date");
            var assigneeIds = GetAssigneeIdsText(TryGetPropertyCaseInsensitive(task, "assignees"));

            logger.LogInformation(
                "ClickUp task diagnostic {Index} from list {ListId}: TaskId={TaskId}; Name={Name}; time_estimate={TimeEstimate}; priority={Priority}; status={Status}; start_date={StartDate}; due_date={DueDate}; assignee_ids={AssigneeIds}",
                alreadyLogged + logged + 1,
                listId,
                id,
                name,
                timeEstimate,
                priority,
                status,
                startDate,
                dueDate,
                assigneeIds);

            logged++;
        }

        return logged;
    }

    private async Task<JsonDocument> SendAndParseAsync(HttpMethod method, string path, string accessToken, CancellationToken cancellationToken)
    {
        using var request = CreateAuthorizedRequest(method, path, accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new ClickUpApiException(path, response.StatusCode, SanitizeErrorBody(body));
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string path, string accessToken)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    private static ClickUpListDto? ParseList(JsonElement element, string? spaceId, string? folderId = null)
    {
        var id = GetOptionalId(element, "id");
        var name = GetOptionalString(element, "name");
        var resolvedSpaceId = spaceId ?? GetOptionalString(element, "space_id");

        return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(resolvedSpaceId)
            ? null
            : new ClickUpListDto(id, name, resolvedSpaceId, folderId ?? GetOptionalString(element, "folder_id"));
    }

    private static ClickUpDiscoveredTaskDto? ParseTask(JsonElement element, string listId)
    {
        var id = GetOptionalId(element, "id");
        var name = GetOptionalString(element, "name");
        var description = GetOptionalString(element, "text_content")
            ?? GetOptionalString(element, "description")
            ?? string.Empty;
        var listIdentifier = GetOptionalId(element, "list")
            ?? GetOptionalId(element, "list_id")
            ?? listId;
        var statusElement = TryGetPropertyCaseInsensitive(element, "status");
        var statusName = statusElement.HasValue ? GetOptionalString(statusElement.Value, "status") ?? GetOptionalString(statusElement.Value, "name") ?? string.Empty : string.Empty;
        var statusType = statusElement.HasValue ? GetOptionalString(statusElement.Value, "type") ?? string.Empty : string.Empty;
        var isClosed = statusElement.HasValue && (GetOptionalBool(statusElement.Value, "closed") ?? false);
        var assignees = GetArrayStrings(TryGetPropertyCaseInsensitive(element, "assignees"));
        var assigneeEmails = GetArrayStrings(TryGetPropertyCaseInsensitive(element, "assignees"), "email");

        return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)
            ? null
            : new ClickUpDiscoveredTaskDto(
                id,
                name,
                description,
                statusName,
                statusType,
                isClosed,
                GetOptionalString(element, "priority"),
                assignees,
                assigneeEmails,
                GetNullableDateTimeOffset(element, "due_date"),
                GetNullableDateTimeOffset(element, "start_date"),
                GetNullableLong(element, "time_estimate"),
                GetNullableDateTimeOffset(element, "date_updated"),
                listIdentifier,
                GetOptionalString(element, "list_name") ?? string.Empty,
                GetOptionalString(element, "folder_id"),
                GetOptionalString(element, "space_id") ?? string.Empty,
                GetOptionalString(element, "workspace_id") ?? string.Empty,
                GetOptionalString(element, "url") ?? string.Empty);
    }

    private static ClickUpTaskSyncModel? ParseSyncTask(JsonElement element)
    {
        var id = GetOptionalId(element, "id");
        var title = GetOptionalString(element, "name");
        var statusElement = TryGetPropertyCaseInsensitive(element, "status");
        var statusName = statusElement.HasValue ? GetOptionalString(statusElement.Value, "status") ?? GetOptionalString(statusElement.Value, "name") ?? string.Empty : string.Empty;
        var statusType = statusElement.HasValue ? GetOptionalString(statusElement.Value, "type") ?? string.Empty : string.Empty;
        var archived = GetOptionalBool(element, "archived") ?? false;
        var isClosed = statusElement.HasValue && (GetOptionalBool(statusElement.Value, "closed") ?? false);
        var priority = ResolvePriorityText(TryGetPropertyCaseInsensitive(element, "priority"));

        return string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(title)
            ? null
            : new ClickUpTaskSyncModel(
                id,
                title,
                string.IsNullOrWhiteSpace(statusName) ? statusType : statusName,
                priority,
                GetNullableDateTimeOffset(element, "start_date"),
                GetNullableDateTimeOffset(element, "due_date"),
                GetNullableLong(element, "time_estimate"),
                ParseSyncAssignees(TryGetPropertyCaseInsensitive(element, "assignees")),
                archived || isClosed);
    }

    private static IReadOnlyCollection<ClickUpAssigneeSyncModel> ParseSyncAssignees(JsonElement? element)
    {
        if (element is null || element.Value.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<ClickUpAssigneeSyncModel>();
        }

        var assignees = new List<ClickUpAssigneeSyncModel>();
        foreach (var item in element.Value.EnumerateArray())
        {
            var id = GetOptionalId(item, "id");
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            assignees.Add(new ClickUpAssigneeSyncModel(
                id,
                GetOptionalString(item, "username")
                    ?? GetOptionalString(item, "full_name")
                    ?? GetOptionalString(item, "fullName")
                    ?? GetOptionalString(item, "name")
                    ?? string.Empty,
                GetOptionalString(item, "email") ?? string.Empty));
        }

        return assignees;
    }

    private static string? ResolvePriorityText(JsonElement? element)
    {
        if (element is null)
        {
            return null;
        }

        var value = element.Value;
        if (value.ValueKind == JsonValueKind.String)
        {
            return value.GetString();
        }

        if (value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetOptionalString(value, "priority")
            ?? GetOptionalString(value, "name")
            ?? GetOptionalString(value, "value")
            ?? GetOptionalString(value, "label")
            ?? GetOptionalString(value, "color");
    }

    private static TaskPriority ResolveTaskPriority(string? clickUpPriority)
    {
        var normalized = NormalizePriorityText(clickUpPriority);
        if (normalized.Contains("urgent", StringComparison.OrdinalIgnoreCase))
        {
            return TaskPriority.Critical;
        }

        if (normalized.Contains("high", StringComparison.OrdinalIgnoreCase))
        {
            return TaskPriority.High;
        }

        if (normalized.Contains("normal", StringComparison.OrdinalIgnoreCase))
        {
            return TaskPriority.Medium;
        }

        if (normalized.Contains("low", StringComparison.OrdinalIgnoreCase))
        {
            return TaskPriority.Low;
        }

        return TaskPriority.Medium;
    }

    private static string NormalizePriorityText(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim();
    }

    private static string GetRawPropertyText(JsonElement element, string propertyName)
    {
        var property = TryGetPropertyCaseInsensitive(element, propertyName);
        return property.HasValue ? property.Value.GetRawText() : "null";
    }

    private static string GetAssigneeIdsText(JsonElement? assigneesElement)
    {
        if (assigneesElement is null || assigneesElement.Value.ValueKind != JsonValueKind.Array)
        {
            return "[]";
        }

        var ids = new List<string>();
        foreach (var item in assigneesElement.Value.EnumerateArray())
        {
            var id = GetOptionalString(item, "id");
            if (!string.IsNullOrWhiteSpace(id))
            {
                ids.Add(id);
            }
        }

        return $"[{string.Join(", ", ids)}]";
    }

    private static IReadOnlyList<T> ParseArray<T>(JsonElement? element, Func<JsonElement, T?> map)
        where T : class
    {
        if (element is null || element.Value.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<T>();
        }

        var results = new List<T>();
        foreach (var item in element.Value.EnumerateArray())
        {
            var mapped = map(item);
            if (mapped is not null)
            {
                results.Add(mapped);
            }
        }

        return results;
    }

    private static IEnumerable<ClickUpMemberDto> ExtractWorkspacePeople(JsonElement root)
    {
        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in EnumerateObjects(root))
        {
            if (!LooksLikePerson(candidate))
            {
                continue;
            }

            var id = GetOptionalString(candidate, "id");
            if (string.IsNullOrWhiteSpace(id) || !seenIds.Add(id))
            {
                continue;
            }

            var fullName = GetOptionalString(candidate, "username")
                ?? GetOptionalString(candidate, "full_name")
                ?? GetOptionalString(candidate, "fullName")
                ?? GetOptionalString(candidate, "name")
                ?? string.Empty;
            var email = GetOptionalString(candidate, "email") ?? string.Empty;
            var isActive = GetOptionalBool(candidate, "is_active")
                ?? GetOptionalBool(candidate, "active")
                ?? true;
            var profilePictureUrl = GetOptionalString(candidate, "profilePicture")
                ?? GetOptionalString(candidate, "profile_picture")
                ?? GetOptionalString(candidate, "avatar")
                ?? GetOptionalString(candidate, "avatar_url");
            var role = GetOptionalString(candidate, "role")
                ?? GetOptionalString(candidate, "account_type")
                ?? GetOptionalString(candidate, "accountType")
                ?? GetOptionalString(candidate, "type");

            yield return new ClickUpMemberDto(id, fullName, email, isActive, profilePictureUrl, role);
        }
    }

    private static IEnumerable<JsonElement> EnumerateObjects(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            yield return element;

            foreach (var property in element.EnumerateObject())
            {
                foreach (var descendant in EnumerateObjects(property.Value))
                {
                    yield return descendant;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                foreach (var descendant in EnumerateObjects(item))
                {
                    yield return descendant;
                }
            }
        }
    }

    private static bool LooksLikePerson(JsonElement element)
    {
        // A person must carry a person-specific identifier. "name" is deliberately
        // excluded: workspaces and role-catalog entries are {id, name, ...} too, and
        // matching on it turns them into phantom members with no email.
        return TryGetPropertyCaseInsensitive(element, "id").HasValue &&
               (
                   TryGetPropertyCaseInsensitive(element, "email").HasValue ||
                   TryGetPropertyCaseInsensitive(element, "username").HasValue ||
                   TryGetPropertyCaseInsensitive(element, "full_name").HasValue ||
                   TryGetPropertyCaseInsensitive(element, "fullName").HasValue
               );
    }

    private static IReadOnlyCollection<string> GetArrayStrings(JsonElement? element, string propertyName = "id")
    {
        if (element is null || element.Value.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }

        var values = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in element.Value.EnumerateArray())
        {
            var value = propertyName == "id"
                ? GetOptionalString(item, "id")
                : GetOptionalString(item, propertyName);
            if (!string.IsNullOrWhiteSpace(value))
            {
                values.Add(value);
            }
        }

        return values;
    }

    private static string GetRequiredString(JsonElement element, string propertyName)
    {
        var value = GetOptionalString(element, propertyName);
        return string.IsNullOrWhiteSpace(value)
            ? throw new InvalidOperationException($"ClickUp response missing required property '{propertyName}'.")
            : value;
    }

    private static string? GetOptionalId(JsonElement element, string propertyName)
    {
        var value = GetOptionalString(element, propertyName);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? GetOptionalString(JsonElement element, string propertyName)
    {
        if (TryGetPropertyCaseInsensitive(element, propertyName) is not JsonElement value)
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString()?.Trim(),
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => bool.TrueString,
            JsonValueKind.False => bool.FalseString,
            _ => null
        };
    }

    private static bool? GetOptionalBool(JsonElement element, string propertyName)
    {
        if (TryGetPropertyCaseInsensitive(element, propertyName) is not JsonElement value)
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number when value.TryGetInt32(out var intValue) => intValue != 0,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }

    private static long? GetNullableLong(JsonElement element, string propertyName)
    {
        if (TryGetPropertyCaseInsensitive(element, propertyName) is not JsonElement value)
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt64(out var parsed) => parsed,
            JsonValueKind.String when long.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null
        };
    }

    private static DateTimeOffset? GetNullableDateTimeOffset(JsonElement element, string propertyName)
    {
        var value = GetNullableLong(element, propertyName);
        return value.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(value.Value)
            : null;
    }

    private static JsonElement? TryGetPropertyCaseInsensitive(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                return property.Value;
            }
        }

        return null;
    }

    private static string SanitizeErrorBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return string.Empty;
        }

        var trimmed = body.Trim();
        return trimmed.Length > 800 ? trimmed[..800] : trimmed;
    }
}
