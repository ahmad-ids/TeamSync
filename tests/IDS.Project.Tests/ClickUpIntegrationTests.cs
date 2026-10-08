using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using IDS.Project.Application.Abstractions.Integrations.ClickUp;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Integrations;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace IDS.Project.Tests;

public sealed class ClickUpIntegrationTests
{
    [Fact]
    public async Task ApiClient_UsesBearerToken_AndParsesWorkspaces()
    {
        HttpRequestMessage? capturedRequest = null;
        var handler = new DelegatingHandlerStub(async request =>
        {
            capturedRequest = request;
            var body = JsonSerializer.Serialize(new
            {
                teams = new[]
                {
                    new { id = "ws-1", name = "Workspace One" },
                    new { id = "ws-2", name = "Workspace Two" }
                }
            });
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        });

        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.clickup.com/api/v2/") };
        var apiClient = new ClickUpApiClient(client, NullLogger<ClickUpApiClient>.Instance, new FakeHostEnvironment());

        var workspaces = await apiClient.GetAuthorizedWorkspacesAsync("raw-token");

        Assert.Equal(2, workspaces.Count);
        Assert.Equal("ws-1", workspaces[0].WorkspaceId);
        Assert.Equal("Workspace One", workspaces[0].WorkspaceName);
        Assert.NotNull(capturedRequest);
        Assert.Equal("Bearer", capturedRequest!.Headers.Authorization?.Scheme);
        Assert.Equal("raw-token", capturedRequest.Headers.Authorization?.Parameter);
    }

    [Fact]
    public async Task ConnectionService_ProtectsToken_AndDeactivatesOtherConnections()
    {
        var protector = new FakeClickUpTokenProtector();

        var dbContext = BuildDbContext();
        dbContext.Users.Add(new ApplicationUser
        {
            Id = "user-1",
            UserName = "user@example.com",
            Email = "user@example.com",
            NormalizedUserName = "USER@EXAMPLE.COM",
            NormalizedEmail = "USER@EXAMPLE.COM",
            TeamId = null,
            IsActive = true
        });
        await dbContext.SaveChangesAsync();
        var service = new ClickUpConnectionService(dbContext, new FakeClickUpApiClient(), protector, BuildUserManager(dbContext));

        dbContext.ClickUpConnections.Add(new ClickUpConnection
        {
            Id = Guid.NewGuid(),
            ApplicationUserId = "user-1",
            ClickUpUserId = "clickup-old",
            WorkspaceId = "old-workspace",
            WorkspaceName = "Old Workspace",
            ProtectedAccessToken = protector.Protect("old-token"),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1),
        });
        await dbContext.SaveChangesAsync();

        var result = await service.SaveConnectionAsync(
            "user-1",
            "clickup-user",
            "raw-token",
            new ClickUpWorkspaceDto("new-workspace", "New Workspace"));

        var newConnection = await dbContext.ClickUpConnections.SingleAsync(x => x.WorkspaceId == "new-workspace");
        var oldConnection = await dbContext.ClickUpConnections.SingleAsync(x => x.WorkspaceId == "old-workspace");

        Assert.True(result.IsActive);
        Assert.NotEqual("raw-token", newConnection.ProtectedAccessToken);
        Assert.Equal("raw-token", protector.Unprotect(newConnection.ProtectedAccessToken));
        Assert.False(oldConnection.IsActive);
        Assert.Equal("New Workspace", newConnection.WorkspaceName);
    }

    [Fact]
    public Task ClickUpController_ReturnsWorkspaces_AndRejectsInvalidTicket()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var setupTicket = "setup-ticket";
        cache.Set(
            $"auth.clickup.setup:{setupTicket}",
            new ClickUpSetupTicketDto(
                "user-1",
                "clickup-user",
                "raw-token",
                new[]
                {
                    new ClickUpWorkspaceDto("ws-1", "Workspace One"),
                    new ClickUpWorkspaceDto("ws-2", "Workspace Two"),
                }),
            TimeSpan.FromMinutes(5));

        var controller = new IDS.Project.Api.Controllers.Integrations.ClickUpController(
            cache,
            new FakeClickUpConnectionService(),
            new FakeClickUpApiClient(),
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

        var okResult = controller.GetWorkspaces(setupTicket);
        var workspaces = Assert.IsType<OkObjectResult>(okResult.Result).Value as IEnumerable<ClickUpWorkspaceDto>;
        Assert.NotNull(workspaces);
        Assert.Equal(2, workspaces!.Count());

        var invalidResult = controller.GetWorkspaces("missing-ticket");
        Assert.IsType<ObjectResult>(invalidResult.Result);

        return Task.CompletedTask;
    }

    [Fact]
    public async Task ClickUpController_ConnectsWorkspace_AndConsumesTicket()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var setupTicket = "setup-ticket";
        cache.Set(
            $"auth.clickup.setup:{setupTicket}",
            new ClickUpSetupTicketDto(
                "user-1",
                "clickup-user",
                "raw-token",
                new[]
                {
                    new ClickUpWorkspaceDto("ws-1", "Workspace One"),
                }),
            TimeSpan.FromMinutes(5));

        var connectionService = new FakeClickUpConnectionService();
        var controller = new IDS.Project.Api.Controllers.Integrations.ClickUpController(
            cache,
            connectionService,
            new FakeClickUpApiClient(),
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

        var result = await controller.Connect(
            new IDS.Project.Api.Controllers.Integrations.ClickUpController.ClickUpConnectRequest(setupTicket, "ws-1"),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.True(connectionService.SaveCalled);
        Assert.False(cache.TryGetValue($"auth.clickup.setup:{setupTicket}", out _));
    }

    [Fact]
    public async Task Synchronization_MapsMissingEstimateFromPriority_AndCalculatesWeight()
    {
        var dbContext = BuildDbContext();
        var userManager = BuildUserManager(dbContext);
        var roleManager = BuildRoleManager(dbContext);
        dbContext.Roles.Add(new IdentityRole
        {
            Id = Guid.NewGuid().ToString(),
            Name = RoleNames.Member,
            NormalizedName = RoleNames.Member.ToUpperInvariant(),
            ConcurrencyStamp = Guid.NewGuid().ToString()
        });
        await dbContext.SaveChangesAsync();

        var currentUserId = "74b5b4d0-ad4d-40e9-a2e4-de0715d4b13e";
        var currentUser = new ApplicationUser
        {
            Id = currentUserId,
            UserName = "leader@example.com",
            Email = "leader@example.com",
            NormalizedUserName = "LEADER@EXAMPLE.COM",
            NormalizedEmail = "LEADER@EXAMPLE.COM",
            FullName = "Leader",
            TeamId = null,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        };
        await userManager.CreateAsync(currentUser);

        var teamId = Guid.NewGuid();
        dbContext.Teams.Add(new Team
        {
            Id = teamId,
            Name = "Workspace One",
            LeaderId = currentUser.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        });
        dbContext.ClickUpConnections.Add(new ClickUpConnection
        {
            Id = Guid.NewGuid(),
            ApplicationUserId = currentUser.Id,
            ClickUpUserId = "clickup-leader",
            WorkspaceId = "workspace-1",
            WorkspaceName = "Workspace One",
            TeamId = teamId,
            ProtectedAccessToken = "protected::token",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
        });
        await dbContext.SaveChangesAsync();

        var member = new ClickUpMemberDto("member-1", "Member One", "member@example.com", true, null, "member");
        var task = new ClickUpTaskSyncModel(
            "task-1",
            "Priority fallback task",
            "open",
            "high",
            null,
            null,
            null,
            new[]
            {
                new ClickUpAssigneeSyncModel("member-1", "Member One", "member@example.com")
            },
            false);

        var apiClient = new FakeClickUpApiClientWithSyncData(
            new[] { member },
            new[] { task });

        var service = new ClickUpSynchronizationService(
            dbContext,
            apiClient,
            new FakeClickUpTokenProtector(),
            new IDS.Project.Application.Services.WorkloadCalculator(),
            userManager,
            roleManager,
            NullLogger<ClickUpSynchronizationService>.Instance);

        var result = await service.SynchronizeAsync(Guid.Parse(currentUser.Id), CancellationToken.None);

        var storedTask = await dbContext.Tasks.SingleAsync(x => x.ExternalSource == "ClickUp" && x.ExternalId == "task-1");

        Assert.Equal(1, result.Inserted);
        Assert.Equal(0, result.Skipped);
        Assert.Equal(6m, storedTask.EstimatedEffortHours);
        Assert.Equal(TaskPriority.High, storedTask.Priority);
        Assert.Equal(TaskComplexity.Medium, storedTask.Complexity);
        Assert.True(storedTask.CalculatedWeight > 0);
    }

    private static ApplicationDbContext BuildDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    private sealed class FakeClickUpApiClient : IClickUpApiClient
    {
        public Task<ClickUpUserInfoDto> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult(new ClickUpUserInfoDto("clickup-user", "user@example.com"));

        public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpWorkspaceDto>>(Array.Empty<ClickUpWorkspaceDto>());

        public Task<IReadOnlyList<ClickUpMemberDto>> GetWorkspaceMembersAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpMemberDto>>(Array.Empty<ClickUpMemberDto>());

        public Task<IReadOnlyList<ClickUpSpaceDto>> GetWorkspaceSpacesAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpSpaceDto>>(Array.Empty<ClickUpSpaceDto>());

        public Task<IReadOnlyList<ClickUpFolderDto>> GetSpaceFoldersAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpFolderDto>>(Array.Empty<ClickUpFolderDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetSpaceListsAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpListDto>>(Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetFolderListsAsync(string accessToken, string folderId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpListDto>>(Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpDiscoveredTaskDto>> GetListTasksAsync(string accessToken, string listId, bool includeClosed = true, int limit = 100, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>>(Array.Empty<ClickUpDiscoveredTaskDto>());

        public Task<IReadOnlyList<ClickUpTaskSyncModel>> GetWorkspaceTasksAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpTaskSyncModel>>(Array.Empty<ClickUpTaskSyncModel>());
    }

    private sealed class FakeClickUpConnectionService : IClickUpConnectionService
    {
        public bool SaveCalled { get; private set; }

        public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpWorkspaceDto>>(Array.Empty<ClickUpWorkspaceDto>());

        public Task<ClickUpConnectionDto?> GetActiveConnectionAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult<ClickUpConnectionDto?>(new ClickUpConnectionDto("ws-1", "Workspace One", true));

        public Task<ClickUpConnectionDetailsDto?> GetActiveConnectionDetailsAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult<ClickUpConnectionDetailsDto?>(new ClickUpConnectionDetailsDto("workspace-1", "Workspace One", "clickup-user", "protected::raw-token", true));

        public Task<ClickUpConnectionDto> SaveConnectionAsync(string applicationUserId, string clickupUserId, string accessToken, ClickUpWorkspaceDto workspace, CancellationToken cancellationToken = default)
        {
            SaveCalled = true;
            return Task.FromResult(new ClickUpConnectionDto(workspace.WorkspaceId, workspace.WorkspaceName, true));
        }

        public Task DeactivateOtherConnectionsAsync(string applicationUserId, string activeWorkspaceId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeClickUpTokenProtector : IClickUpTokenProtector
    {
        public string Protect(string accessToken) => $"protected::{accessToken}";

        public string Unprotect(string protectedAccessToken) => protectedAccessToken.Replace("protected::", string.Empty, StringComparison.Ordinal);
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

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string ApplicationName { get; set; } = "Tests";
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ContentRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    private static UserManager<ApplicationUser> BuildUserManager(ApplicationDbContext dbContext)
    {
        var store = new UserStore<ApplicationUser, IdentityRole, ApplicationDbContext, string>(dbContext);
        return new UserManager<ApplicationUser>(
            store,
            null!,
            new PasswordHasher<ApplicationUser>(),
            Array.Empty<IUserValidator<ApplicationUser>>(),
            Array.Empty<IPasswordValidator<ApplicationUser>>(),
            null!,
            null!,
            null!,
            null!);
    }

    private static RoleManager<IdentityRole> BuildRoleManager(ApplicationDbContext dbContext)
    {
        var store = new RoleStore<IdentityRole, ApplicationDbContext, string>(dbContext);
        return new RoleManager<IdentityRole>(
            store,
            Array.Empty<IRoleValidator<IdentityRole>>(),
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            null!);
    }

    private sealed class FakeClickUpTaskDiscoveryService : IClickUpTaskDiscoveryService
    {
        public Task<ClickUpDiscoveryStructureDto?> GetDiscoveryStructureAsync(string applicationUserId, CancellationToken cancellationToken = default)
            => Task.FromResult<ClickUpDiscoveryStructureDto?>(null);

        public Task<IReadOnlyList<ClickUpDiscoveredTaskDto>?> GetDiscoveredTasksAsync(string applicationUserId, string? listId = null, bool includeClosed = true, int limit = 100, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>?>(null);
    }

    private sealed class FakeClickUpSynchronizationService : IClickUpSynchronizationService
    {
        public Task<ClickUpSyncResult> SynchronizeAsync(Guid currentUserId, CancellationToken cancellationToken)
            => Task.FromResult(new ClickUpSyncResult(0, 0, 0, 0, Array.Empty<string>(), Array.Empty<string>()));
    }

    private sealed class FakeClickUpApiClientWithSyncData(
        IReadOnlyList<ClickUpMemberDto> members,
        IReadOnlyList<ClickUpTaskSyncModel> tasks) : IClickUpApiClient
    {
        public Task<ClickUpUserInfoDto> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult(new ClickUpUserInfoDto("clickup-user", "user@example.com"));

        public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpWorkspaceDto>>(Array.Empty<ClickUpWorkspaceDto>());

        public Task<IReadOnlyList<ClickUpMemberDto>> GetWorkspaceMembersAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult(members);

        public Task<IReadOnlyList<ClickUpSpaceDto>> GetWorkspaceSpacesAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpSpaceDto>>(Array.Empty<ClickUpSpaceDto>());

        public Task<IReadOnlyList<ClickUpFolderDto>> GetSpaceFoldersAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpFolderDto>>(Array.Empty<ClickUpFolderDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetSpaceListsAsync(string accessToken, string spaceId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpListDto>>(Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpListDto>> GetFolderListsAsync(string accessToken, string folderId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpListDto>>(Array.Empty<ClickUpListDto>());

        public Task<IReadOnlyList<ClickUpDiscoveredTaskDto>> GetListTasksAsync(string accessToken, string listId, bool includeClosed = true, int limit = 100, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ClickUpDiscoveredTaskDto>>(Array.Empty<ClickUpDiscoveredTaskDto>());

        public Task<IReadOnlyList<ClickUpTaskSyncModel>> GetWorkspaceTasksAsync(string accessToken, string workspaceId, CancellationToken cancellationToken = default)
            => Task.FromResult(tasks);
    }

    private sealed class DelegatingHandlerStub(Func<HttpRequestMessage, Task<HttpResponseMessage>> sendAsync) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => sendAsync(request);
    }
}
