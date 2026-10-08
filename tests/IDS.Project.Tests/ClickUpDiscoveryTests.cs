using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using IDS.Project.Application.Abstractions.Integrations.ClickUp;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Entities;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;

namespace IDS.Project.Tests;

public sealed class ClickUpDiscoveryTests
{
    [Fact]
    public async Task DiscoveryService_ReturnsNull_WhenNoActiveConnectionExists()
    {
        var service = CreateService(
            BuildDbContext(),
            new DiscoveryApiClientStub(),
            new FakeClickUpTokenProtector());

        var result = await service.GetDiscoveryStructureAsync("user-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task DiscoveryService_DecryptsToken_AndIncludesFolderlessAndFolderLists()
    {
        var dbContext = BuildDbContext();
        dbContext.ClickUpConnections.Add(new ClickUpConnection
        {
            Id = Guid.NewGuid(),
            ApplicationUserId = "user-1",
            ClickUpUserId = "clickup-user",
            WorkspaceId = "workspace-1",
            WorkspaceName = "Workspace One",
            ProtectedAccessToken = "protected::raw-token",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var apiClient = new DiscoveryApiClientStub
        {
            Spaces = [new ClickUpSpaceDto("space-1", "Space One")],
            FoldersBySpace = new Dictionary<string, IReadOnlyList<ClickUpFolderDto>>
            {
                ["space-1"] = [new ClickUpFolderDto("folder-1", "Folder One", "space-1")]
            },
            SpaceListsBySpace = new Dictionary<string, IReadOnlyList<ClickUpListDto>>
            {
                ["space-1"] = [new ClickUpListDto("list-1", "Folderless List", "space-1", null)]
            },
            FolderListsByFolder = new Dictionary<string, IReadOnlyList<ClickUpListDto>>
            {
                ["folder-1"] = [new ClickUpListDto("list-2", "Folder List", "space-1", "folder-1")]
            }
        };

        var service = CreateService(dbContext, apiClient, new FakeClickUpTokenProtector());

        var structure = await service.GetDiscoveryStructureAsync("user-1");

        Assert.NotNull(structure);
        Assert.Equal("workspace-1", structure!.WorkspaceId);
        Assert.Equal("Workspace One", structure.WorkspaceName);
        Assert.Equal("raw-token", apiClient.CapturedAccessToken);
        Assert.Single(structure.Spaces);
        Assert.Single(structure.Folders);
        Assert.Equal(2, structure.Lists.Count);
        Assert.Contains(structure.Lists, item => item.FolderId is null);
        Assert.Contains(structure.Lists, item => item.FolderId == "folder-1");
    }

    [Fact]
    public async Task DiscoveryService_DeduplicatesTasks_AndForwardsIncludeClosed_AndEnforcesLimit()
    {
        var dbContext = BuildDbContext();
        dbContext.ClickUpConnections.Add(new ClickUpConnection
        {
            Id = Guid.NewGuid(),
            ApplicationUserId = "user-1",
            ClickUpUserId = "clickup-user",
            WorkspaceId = "workspace-1",
            WorkspaceName = "Workspace One",
            ProtectedAccessToken = "protected::raw-token",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var apiClient = new DiscoveryApiClientStub
        {
            Spaces = [new ClickUpSpaceDto("space-1", "Space One")],
            SpaceListsBySpace = new Dictionary<string, IReadOnlyList<ClickUpListDto>>
            {
                ["space-1"] = [
                    new ClickUpListDto("list-1", "List One", "space-1", null),
                    new ClickUpListDto("list-2", "List Two", "space-1", null),
                ]
            },
            TaskPagesByList = new Dictionary<string, IReadOnlyList<IReadOnlyList<ClickUpDiscoveredTaskDto>>>
            {
                ["list-1"] =
                [
                    [
                        new ClickUpDiscoveredTaskDto("task-1", "Task One", string.Empty, "Open", "open", false, "1", ["user-1"], ["user@example.com"], null, null, null, null, "list-1", "List One", null, "space-1", "workspace-1", "https://clickup.com/t/task-1"),
                        new ClickUpDiscoveredTaskDto("task-1", "Task One Duplicate", string.Empty, "Open", "open", false, "1", ["user-1"], ["user@example.com"], null, null, null, null, "list-1", "List One", null, "space-1", "workspace-1", "https://clickup.com/t/task-1"),
                    ]
                ],
                ["list-2"] =
                [
                    [
                        new ClickUpDiscoveredTaskDto("task-2", "Task Two", string.Empty, "Closed", "closed", true, "2", ["user-2"], ["user2@example.com"], null, null, null, null, "list-2", "List Two", null, "space-1", "workspace-1", "https://clickup.com/t/task-2"),
                    ]
                ]
            }
        };

        var service = CreateService(dbContext, apiClient, new FakeClickUpTokenProtector());

        var tasks = await service.GetDiscoveredTasksAsync("user-1", includeClosed: false, limit: 1);

        Assert.NotNull(tasks);
        Assert.Single(tasks!);
        Assert.Equal("task-1", tasks[0].Id);
        Assert.False(apiClient.IncludeClosedValues.Any(value => value));
        Assert.All(apiClient.Limits, limit => Assert.InRange(limit, 1, 1));
        Assert.Equal("raw-token", apiClient.CapturedAccessToken);
    }

    [Fact]
    public async Task DiscoveryApiClient_PaginatesTasks_AndHonorsLimit()
    {
        HttpRequestMessage? firstRequest = null;
        HttpRequestMessage? secondRequest = null;
        var handler = new DelegatingHandlerStub(async request =>
        {
            var page = int.Parse(request.RequestUri!.Query.Split("page=")[1].Split('&')[0]);
            if (page == 0)
            {
                firstRequest = request;
                return CreateTaskPageResponse(100, 0);
            }

            secondRequest = request;
            return CreateTaskPageResponse(100, 100);
        });

        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.clickup.com/api/v2/") };
        var apiClient = new ClickUpApiClient(client, NullLogger<ClickUpApiClient>.Instance, new FakeHostEnvironment());

        var tasks = await apiClient.GetListTasksAsync("raw-token", "list-1", includeClosed: true, limit: 120);

        Assert.Equal(120, tasks.Count);
        Assert.NotNull(firstRequest);
        Assert.NotNull(secondRequest);
        Assert.Contains("include_closed=true", firstRequest!.RequestUri!.Query);
        Assert.Contains("page=0", firstRequest.RequestUri!.Query);
        Assert.Contains("page=1", secondRequest!.RequestUri!.Query);
    }

    [Fact]
    public async Task DiscoveryController_Returns404_WhenNoActiveConnectionExists()
    {
        var controller = new IDS.Project.Api.Controllers.Integrations.ClickUpController(
            new MemoryCache(new MemoryCacheOptions()),
            new FakeClickUpConnectionService(),
            new DiscoveryApiClientStub(),
            new FakeClickUpTaskDiscoveryService(),
            new FakeClickUpSynchronizationService(),
            new FakeClickUpTokenProtector(),
            new FakeWebHostEnvironment(),
            NullLogger<IDS.Project.Api.Controllers.Integrations.ClickUpController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, "user-1"),
                        new Claim(ClaimTypes.Role, "TeamLeader"),
                    }, "test"))
                }
            }
        };

        var result = await controller.GetDiscoveryStructure(CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status404NotFound, problem.StatusCode);
    }

    [Fact]
    public async Task DiscoveryService_DoesNotWriteToDatabase()
    {
        var dbContext = BuildDbContext();
        dbContext.ClickUpConnections.Add(new ClickUpConnection
        {
            Id = Guid.NewGuid(),
            ApplicationUserId = "user-1",
            ClickUpUserId = "clickup-user",
            WorkspaceId = "workspace-1",
            WorkspaceName = "Workspace One",
            ProtectedAccessToken = "protected::raw-token",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var before = dbContext.ChangeTracker.Entries().Count();
        var service = CreateService(dbContext, new DiscoveryApiClientStub
        {
            Spaces = [new ClickUpSpaceDto("space-1", "Space One")]
        }, new FakeClickUpTokenProtector());

        _ = await service.GetDiscoveryStructureAsync("user-1");
        _ = await service.GetDiscoveredTasksAsync("user-1");

        var after = dbContext.ChangeTracker.Entries().Count();
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task DiscoveryController_DoesNotExposeRawTokens()
    {
        var controller = new IDS.Project.Api.Controllers.Integrations.ClickUpController(
            new MemoryCache(new MemoryCacheOptions()),
            new FakeClickUpConnectionService(new ClickUpConnectionDto("workspace-1", "Workspace One", true)),
            new DiscoveryApiClientStub(),
            new FakeClickUpTaskDiscoveryService(new ClickUpDiscoveryStructureDto(
                "workspace-1",
                "Workspace One",
                [new ClickUpSpaceDto("space-1", "Space One")],
                [],
                [],
                1,
                0,
                0)),
            new FakeClickUpSynchronizationService(),
            new FakeClickUpTokenProtector(),
            new FakeWebHostEnvironment(),
            NullLogger<IDS.Project.Api.Controllers.Integrations.ClickUpController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, "user-1"),
                        new Claim(ClaimTypes.Role, "TeamLeader"),
                    }, "test"))
                }
            }
        };

        var result = await controller.GetDiscoveryStructure(CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var json = JsonSerializer.Serialize(ok.Value);

        Assert.DoesNotContain("protected::", json, StringComparison.OrdinalIgnoreCase);
    }

    private static ClickUpTaskDiscoveryService CreateService(
        ApplicationDbContext dbContext,
        DiscoveryApiClientStub apiClient,
        FakeClickUpTokenProtector protector)
    {
        return new ClickUpTaskDiscoveryService(dbContext, apiClient, protector, NullLogger<ClickUpTaskDiscoveryService>.Instance);
    }

    private static ApplicationDbContext BuildDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new ApplicationDbContext(options);
    }

    private static HttpResponseMessage CreateTaskPageResponse(int taskCount, int startIndex)
    {
        var tasks = Enumerable.Range(0, taskCount)
            .Select(index => new
            {
                id = $"task-{startIndex + index}",
                name = $"Task {startIndex + index}",
                text_content = $"Task {startIndex + index} description",
                status = new { status = "open", type = "open", closed = false },
                priority = "1",
                assignees = new[] { new { id = "user-1", email = "user@example.com" } },
                due_date = 1_700_000_000_000L,
                start_date = 1_700_000_000_000L,
                time_estimate = 3600000L,
                date_updated = 1_700_000_000_000L,
                list = "list-1",
                list_name = "List One",
                folder_id = "folder-1",
                space_id = "space-1",
                workspace_id = "workspace-1",
                url = $"https://clickup.com/t/task-{startIndex + index}"
            });

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(new { tasks }), Encoding.UTF8, "application/json")
        };
    }

    private sealed class DiscoveryApiClientStub : IClickUpApiClient
    {
        public string CapturedAccessToken { get; private set; } = string.Empty;
        public List<bool> IncludeClosedValues { get; } = [];
        public List<int> Limits { get; } = [];

        public IReadOnlyList<ClickUpSpaceDto> Spaces { get; set; } = Array.Empty<ClickUpSpaceDto>();
        public Dictionary<string, IReadOnlyList<ClickUpFolderDto>> FoldersBySpace { get; set; } = [];
        public Dictionary<string, IReadOnlyList<ClickUpListDto>> SpaceListsBySpace { get; set; } = [];
        public Dictionary<string, IReadOnlyList<ClickUpListDto>> FolderListsByFolder { get; set; } = [];
        public Dictionary<string, IReadOnlyList<IReadOnlyList<ClickUpDiscoveredTaskDto>>> TaskPagesByList { get; set; } = [];

        public Task<ClickUpUserInfoDto> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult(new ClickUpUserInfoDto("user-1", "user@example.com"));

        public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpWorkspaceDto>>(Array.Empty<ClickUpWorkspaceDto>());

        public Task<IReadOnlyList<ClickUpMemberDto>> GetWorkspaceMembersAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpMemberDto>>(Array.Empty<ClickUpMemberDto>());

        public Task<IReadOnlyList<ClickUpSpaceDto>> GetWorkspaceSpacesAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
        {
            CapturedAccessToken = accessToken;
            return Task.FromResult(Spaces);
        }

        public Task<IReadOnlyList<ClickUpFolderDto>> GetSpaceFoldersAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult(FoldersBySpace.TryGetValue(spaceId, out var folders) ? folders : Array.Empty<ClickUpFolderDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetSpaceListsAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult(SpaceListsBySpace.TryGetValue(spaceId, out var lists) ? lists : Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetFolderListsAsync(string accessToken, string folderId, CancellationToken cancellationToken = default)
            => Task.FromResult(FolderListsByFolder.TryGetValue(folderId, out var lists) ? lists : Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpDiscoveredTaskDto>> GetListTasksAsync(string accessToken, string listId, bool includeClosed = true, int limit = 100, CancellationToken cancellationToken = default)
        {
            CapturedAccessToken = accessToken;
            IncludeClosedValues.Add(includeClosed);
            Limits.Add(limit);

            if (!TaskPagesByList.TryGetValue(listId, out var pages))
            {
                return Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>>(Array.Empty<ClickUpDiscoveredTaskDto>());
            }

            var tasks = pages.SelectMany(page => page).ToArray();
            if (!includeClosed)
            {
                tasks = tasks.Where(task => !task.IsClosed).ToArray();
            }

            return Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>>(tasks.Take(limit).ToArray());
        }

        public Task<IReadOnlyList<ClickUpTaskSyncModel>> GetWorkspaceTasksAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpTaskSyncModel>>(Array.Empty<ClickUpTaskSyncModel>());
    }

    private sealed class FakeClickUpTaskDiscoveryService : IClickUpTaskDiscoveryService
    {
        private readonly ClickUpDiscoveryStructureDto? structure;

        public FakeClickUpTaskDiscoveryService(ClickUpDiscoveryStructureDto? structure = null)
        {
            this.structure = structure;
        }

        public Task<ClickUpDiscoveryStructureDto?> GetDiscoveryStructureAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult(structure);

        public Task<IReadOnlyList<ClickUpDiscoveredTaskDto>?> GetDiscoveredTasksAsync(string applicationUserId, string? listId = null, bool includeClosed = true, int limit = 100, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>?>(structure is null ? null : Array.Empty<ClickUpDiscoveredTaskDto>());
    }

    private sealed class FakeClickUpSynchronizationService : IClickUpSynchronizationService
    {
        public Task<ClickUpSyncResult> SynchronizeAsync(Guid currentUserId, CancellationToken cancellationToken)
            => Task.FromResult(new ClickUpSyncResult(0, 0, 0, 0, Array.Empty<string>(), Array.Empty<string>()));
    }

    private sealed class FakeClickUpConnectionService : IClickUpConnectionService
    {
        private readonly ClickUpConnectionDto? connection;

        public FakeClickUpConnectionService(ClickUpConnectionDto? connection = null)
        {
            this.connection = connection;
        }

        public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpWorkspaceDto>>(Array.Empty<ClickUpWorkspaceDto>());

        public Task<ClickUpConnectionDto?> GetActiveConnectionAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult(connection);

        public Task<ClickUpConnectionDetailsDto?> GetActiveConnectionDetailsAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult<ClickUpConnectionDetailsDto?>(connection is null
                ? null
                : new ClickUpConnectionDetailsDto(connection.WorkspaceId, connection.WorkspaceName, "clickup-user", "protected::raw-token", connection.IsActive));

        public Task<ClickUpConnectionDto> SaveConnectionAsync(string applicationUserId, string clickupUserId, string accessToken, ClickUpWorkspaceDto workspace, CancellationToken cancellationToken = default)
            => Task.FromResult(new ClickUpConnectionDto(workspace.WorkspaceId, workspace.WorkspaceName, true));

        public Task DeactivateOtherConnectionsAsync(string applicationUserId, string activeWorkspaceId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeClickUpTokenProtector : IClickUpTokenProtector
    {
        public string Protect(string accessToken) => $"protected::{accessToken}";

        public string Unprotect(string protectedAccessToken) => protectedAccessToken.Replace("protected::", string.Empty, StringComparison.Ordinal);
    }

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string ApplicationName { get; set; } = "Tests";
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ContentRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class DelegatingHandlerStub(Func<HttpRequestMessage, Task<HttpResponseMessage>> sendAsync) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => sendAsync(request);
    }
}
