using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Domain.Entities;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class ClickUpConnectionService(
    ApplicationDbContext dbContext,
    IClickUpApiClient clickUpApiClient,
    IClickUpTokenProtector tokenProtector,
    UserManager<ApplicationUser> userManager) : IClickUpConnectionService
{
    public Task<IReadOnlyList<ClickUpWorkspaceDto>> GetAuthorizedWorkspacesAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        return clickUpApiClient.GetAuthorizedWorkspacesAsync(accessToken, cancellationToken);
    }

    public async Task<ClickUpConnectionDto?> GetActiveConnectionAsync(string applicationUserId, CancellationToken cancellationToken = default)
    {
        var connection = await GetActiveConnectionEntityAsync(applicationUserId, cancellationToken);

        return connection is null
            ? null
            : new ClickUpConnectionDto(connection.WorkspaceId, connection.WorkspaceName, connection.IsActive);
    }

    public async Task<ClickUpConnectionDetailsDto?> GetActiveConnectionDetailsAsync(string applicationUserId, CancellationToken cancellationToken = default)
    {
        var connection = await GetActiveConnectionEntityAsync(applicationUserId, cancellationToken);

        return connection is null
            ? null
            : new ClickUpConnectionDetailsDto(
                connection.WorkspaceId,
                connection.WorkspaceName,
                connection.ProtectedAccessToken,
                connection.ClickUpUserId,
                connection.IsActive);
    }

    private async Task<ClickUpConnection?> GetActiveConnectionEntityAsync(string applicationUserId, CancellationToken cancellationToken)
    {
        return await dbContext.ClickUpConnections
            .AsNoTracking()
            .Where(x => x.ApplicationUserId == applicationUserId && x.IsActive)
            .OrderByDescending(x => x.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<ClickUpConnectionDto> SaveConnectionAsync(
        string applicationUserId,
        string clickupUserId,
        string accessToken,
        ClickUpWorkspaceDto workspace,
        CancellationToken cancellationToken = default)
    {
        var protectedToken = tokenProtector.Protect(accessToken);
        var now = DateTimeOffset.UtcNow;

        var existing = await dbContext.ClickUpConnections
            .SingleOrDefaultAsync(
                x => x.ApplicationUserId == applicationUserId && x.WorkspaceId == workspace.WorkspaceId,
                cancellationToken);

        var teamId = existing?.TeamId;
        if (teamId is null)
        {
            var team = new Team
            {
                Id = Guid.NewGuid(),
                Name = workspace.WorkspaceName,
                LeaderId = applicationUserId,
                CreatedAt = now,
                UpdatedAt = now
            };

            dbContext.Teams.Add(team);
            teamId = team.Id;
        }

        var leader = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == applicationUserId, cancellationToken)
            ?? throw new InvalidOperationException("The authenticated TeamLeader could not be found.");
        leader.TeamId = teamId.Value;
        leader.IsActive = true;
        leader.UpdatedAt = now;

        if (existing is null)
        {
            existing = new ClickUpConnection
            {
                Id = Guid.NewGuid(),
                ApplicationUserId = applicationUserId,
                TeamId = teamId.Value,
                ClickUpUserId = clickupUserId,
                WorkspaceId = workspace.WorkspaceId,
                WorkspaceName = workspace.WorkspaceName,
                ProtectedAccessToken = protectedToken,
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.ClickUpConnections.Add(existing);
        }
        else
        {
            existing.TeamId = teamId.Value;
            existing.ClickUpUserId = clickupUserId;
            existing.WorkspaceName = workspace.WorkspaceName;
            existing.ProtectedAccessToken = protectedToken;
            existing.IsActive = true;
            existing.UpdatedAt = now;
        }

        await DeactivateOtherConnectionsAsync(applicationUserId, workspace.WorkspaceId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ClickUpConnectionDto(existing.WorkspaceId, existing.WorkspaceName, existing.IsActive);
    }

    public async Task DeactivateOtherConnectionsAsync(string applicationUserId, string activeWorkspaceId, CancellationToken cancellationToken = default)
    {
        var otherConnections = await dbContext.ClickUpConnections
            .Where(x => x.ApplicationUserId == applicationUserId && x.WorkspaceId != activeWorkspaceId && x.IsActive)
            .ToListAsync(cancellationToken);

        if (otherConnections.Count == 0)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var connection in otherConnections)
        {
            connection.IsActive = false;
            connection.UpdatedAt = now;
        }
    }
}
