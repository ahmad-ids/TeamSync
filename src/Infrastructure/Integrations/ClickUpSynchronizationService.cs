using IDS.Project.Application.Abstractions.Integrations.ClickUp;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Integrations;

public sealed class ClickUpSynchronizationService(
    ApplicationDbContext dbContext,
    IClickUpApiClient clickUpApiClient,
    IClickUpTokenProtector tokenProtector,
    IWorkloadCalculator workloadCalculator,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager,
    ILogger<ClickUpSynchronizationService> logger) : IClickUpSynchronizationService
{
    private const string ClickUpSource = "ClickUp";

    public async Task<ClickUpSyncResult> SynchronizeAsync(Guid currentUserId, CancellationToken cancellationToken)
    {
        var currentUserKey = currentUserId.ToString();
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserKey && user.IsActive)
            .Select(user => new { user.Id, user.TeamId, user.FullName })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser is null)
        {
            throw new InvalidOperationException("The authenticated TeamLeader account could not be loaded.");
        }

        var connection = await dbContext.ClickUpConnections
            .Where(item => item.ApplicationUserId == currentUserKey && item.IsActive)
            .OrderByDescending(item => item.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (connection is null)
        {
            throw new InvalidOperationException("No active ClickUp connection exists for the current account.");
        }

        var accessToken = tokenProtector.Unprotect(connection.ProtectedAccessToken);
        var now = DateTimeOffset.UtcNow;
        var result = new ProvisioningResult();

        if (connection.TeamId is null)
        {
            var team = new Team
            {
                Id = Guid.NewGuid(),
                Name = connection.WorkspaceName,
                LeaderId = connection.ApplicationUserId,
                CreatedAt = now,
                UpdatedAt = now
            };

            connection.TeamId = team.Id;
            dbContext.Teams.Add(team);

            var leader = await dbContext.Users.SingleOrDefaultAsync(user => user.Id == currentUserKey, cancellationToken);
            if (leader is null)
            {
                throw new InvalidOperationException("The authenticated TeamLeader account could not be loaded.");
            }

            leader.TeamId = team.Id;
            leader.IsActive = true;
            leader.UpdatedAt = now;
            result.TeamCreatedOrReused = true;
            result.TeamLeaderAssigned = true;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var teamId = connection.TeamId.Value;

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var members = await clickUpApiClient.GetWorkspaceMembersAsync(accessToken, connection.WorkspaceId, cancellationToken);
        result.MembersFetched = members.Count;

        var teamMembers = await UpsertMembersAsync(
            teamId,
            members,
            now,
            result,
            cancellationToken);

        var clickUpTasks = await clickUpApiClient.GetWorkspaceTasksAsync(accessToken, connection.WorkspaceId, cancellationToken);
        result.TasksFetched = clickUpTasks.Count;

        var existingTasks = await dbContext.Tasks
            .Where(task => task.ExternalSource == ClickUpSource && task.ExternalId != null && task.TeamId == teamId)
            .ToDictionaryAsync(task => task.ExternalId!, cancellationToken);

        foreach (var clickUpTask in clickUpTasks)
        {
            var matchedAssignee = ResolveAssignee(clickUpTask.Assignees, teamMembers, result);
            if (matchedAssignee is null)
            {
                result.TasksSkipped++;
                continue;
            }

            var taskStatus = ResolveTaskStatus(clickUpTask.Status, clickUpTask.Archived);
            var dueDate = ResolveDateOnly(clickUpTask.DueDate) ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var startDate = ResolveDateOnly(clickUpTask.StartDate) ?? dueDate;
            var priority = ResolveTaskPriority(clickUpTask.Priority);
            var effortHours = clickUpTask.TimeEstimate.HasValue && clickUpTask.TimeEstimate.Value > 0
                ? Math.Round((decimal)clickUpTask.TimeEstimate.Value / 3_600_000m, 2, MidpointRounding.AwayFromZero)
                : 0m;
            var complexity = TaskComplexity.Simple;
            var calculatedWeight = Math.Round(workloadCalculator.CalculateWeight(effortHours, complexity, priority), 1);

            if (!existingTasks.TryGetValue(clickUpTask.TaskId, out var existing))
            {
                dbContext.Tasks.Add(new TaskItem
                {
                    Id = Guid.NewGuid(),
                    Title = clickUpTask.Title.Trim(),
                    Description = clickUpTask.Title.Trim(),
                    ExternalId = clickUpTask.TaskId,
                    ExternalSource = ClickUpSource,
                    AssignedMemberId = matchedAssignee.UserId,
                    CreatedById = currentUserKey,
                    TeamId = teamId,
                    Priority = priority,
                    Complexity = complexity,
                    RequiredSpecialization = TaskSpecialization.Unknown,
                    EstimatedEffortHours = effortHours,
                    StartDate = startDate,
                    DueDate = dueDate,
                    Status = taskStatus,
                    CalculatedWeight = calculatedWeight,
                    IsAcknowledged = false,
                    AcknowledgedAt = null,
                    CreatedAt = now,
                    UpdatedAt = now
                });

                result.TasksInserted++;
                continue;
            }

            existing.Title = clickUpTask.Title.Trim();
            existing.Description = clickUpTask.Title.Trim();
            existing.ExternalId = clickUpTask.TaskId;
            existing.ExternalSource = ClickUpSource;
            existing.AssignedMemberId = matchedAssignee.UserId;
            existing.TeamId = teamId;
            existing.Priority = priority;
            existing.Complexity = complexity;
            existing.RequiredSpecialization = TaskSpecialization.Unknown;
            existing.EstimatedEffortHours = effortHours;
            existing.StartDate = startDate;
            existing.DueDate = dueDate;
            existing.Status = taskStatus;
            existing.CalculatedWeight = calculatedWeight;
            existing.UpdatedAt = now;

            result.TasksUpdated++;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation(
            "ClickUp sync completed for user {UserId}. MembersFetched: {MembersFetched}, MembersInserted: {MembersInserted}, MembersUpdated: {MembersUpdated}, TasksFetched: {Fetched}, TasksInserted: {Inserted}, TasksUpdated: {Updated}, TasksSkipped: {Skipped}.",
            currentUserKey,
            result.MembersFetched,
            result.MembersInserted,
            result.MembersUpdated,
            result.TasksFetched,
            result.TasksInserted,
            result.TasksUpdated,
            result.TasksSkipped);

        return new ClickUpSyncResult(
            result.TasksFetched,
            result.TasksInserted,
            result.TasksUpdated,
            result.TasksSkipped,
            result.UnmatchedMembers.ToArray(),
            result.Errors.ToArray(),
            result.TeamCreatedOrReused,
            result.TeamLeaderAssigned,
            result.MembersFetched,
            result.MembersInserted,
            result.MembersUpdated,
            result.MembersSkipped);
    }

    private async Task<IReadOnlyList<MemberProjection>> UpsertMembersAsync(
        Guid teamId,
        IReadOnlyList<ClickUpMemberDto> members,
        DateTimeOffset now,
        ProvisioningResult result,
        CancellationToken cancellationToken)
    {
        // An email is mandatory: Identity rejects a blank one, and a single bad entry
        // aborts the whole sync. Both an email and an id are required to proceed.
        var normalizedMembers = members
            .Where(member => !string.IsNullOrWhiteSpace(member.Email) && !string.IsNullOrWhiteSpace(member.Id))
            .ToArray();

        var existingUsers = await dbContext.Users
            .Where(user => user.TeamId == teamId)
            .ToListAsync(cancellationToken);

        var byClickUpId = existingUsers
            .Where(user => !string.IsNullOrWhiteSpace(user.ClickUpUserId))
            .ToDictionary(user => user.ClickUpUserId!, user => user, StringComparer.OrdinalIgnoreCase);

        var byEmail = existingUsers
            .Where(user => !string.IsNullOrWhiteSpace(user.Email))
            .GroupBy(user => NormalizeEmail(user.Email), StringComparer.OrdinalIgnoreCase)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var activeMemberRoleExists = await roleManager.RoleExistsAsync(RoleNames.Member);
        if (!activeMemberRoleExists)
        {
            await roleManager.CreateAsync(new IdentityRole(RoleNames.Member));
        }

        var synced = new List<MemberProjection>();
        foreach (var member in normalizedMembers)
        {
            var normalizedEmail = NormalizeEmail(member.Email);
            var hasUsableEmail = !string.IsNullOrWhiteSpace(normalizedEmail);
            ApplicationUser? user = null;
            if (!string.IsNullOrWhiteSpace(member.Id) && byClickUpId.TryGetValue(member.Id, out var matchedByClickUpId))
            {
                user = matchedByClickUpId;
            }
            else if (hasUsableEmail && byEmail.TryGetValue(normalizedEmail, out var matchedByEmail))
            {
                user = matchedByEmail;
            }

            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid().ToString(),
                    UserName = hasUsableEmail ? normalizedEmail : $"clickup-{member.Id}",
                    Email = hasUsableEmail ? normalizedEmail : null,
                    FullName = member.FullName.Trim(),
                    ClickUpUserId = member.Id,
                    TeamId = teamId,
                    IsActive = member.IsActive,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                var createResult = await userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                {
                    var errors = string.Join("; ", createResult.Errors.Select(error => error.Description));
                    throw new InvalidOperationException($"Failed to create ClickUp member {member.Id}: {errors}");
                }

                user = await userManager.FindByIdAsync(user.Id)
                    ?? throw new InvalidOperationException($"ClickUp member {member.Id} was created but could not be reloaded.");

                result.MembersInserted++;
            }
            else
            {
                user.ClickUpUserId = member.Id;
                user.FullName = string.IsNullOrWhiteSpace(member.FullName) ? user.FullName : member.FullName.Trim();
                if (hasUsableEmail)
                {
                    user.Email = normalizedEmail;
                    user.UserName = normalizedEmail;
                }
                user.TeamId = teamId;
                user.IsActive = true;
                user.UpdatedAt = now;

                var updateResult = await userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    var errors = string.Join("; ", updateResult.Errors.Select(error => error.Description));
                    throw new InvalidOperationException($"Failed to update ClickUp member {member.Id}: {errors}");
                }

                user = await userManager.FindByIdAsync(user.Id)
                    ?? throw new InvalidOperationException($"ClickUp member {member.Id} was updated but could not be reloaded.");

                result.MembersUpdated++;
            }

            if (!await userManager.IsInRoleAsync(user, RoleNames.Member))
            {
                var addRoleResult = await userManager.AddToRoleAsync(user, RoleNames.Member);
                if (!addRoleResult.Succeeded)
                {
                    var errors = string.Join("; ", addRoleResult.Errors.Select(error => error.Description));
                    throw new InvalidOperationException($"Failed to assign role '{RoleNames.Member}' to ClickUp member {member.Id}: {errors}");
                }
            }

            synced.Add(new MemberProjection(user.Id, user.FullName, normalizedEmail, member.Id));
        }

        return synced;
    }

    private static string NormalizeEmail(string? email)
    {
        return string.IsNullOrWhiteSpace(email)
            ? string.Empty
            : email.Trim().ToLowerInvariant();
    }

    private static DateOnly? ResolveDateOnly(DateTimeOffset? value)
    {
        return value.HasValue
            ? DateOnly.FromDateTime(value.Value.UtcDateTime)
            : null;
    }

    private static DomainTaskStatus ResolveTaskStatus(string status, bool archived)
    {
        if (archived)
        {
            return DomainTaskStatus.Done;
        }

        var normalized = NormalizeStatus(status);

        if (normalized.Contains("blocked", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("hold", StringComparison.OrdinalIgnoreCase))
        {
            return DomainTaskStatus.Blocked;
        }

        if (normalized.Contains("progress", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("active", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("working", StringComparison.OrdinalIgnoreCase))
        {
            return DomainTaskStatus.InProgress;
        }

        if (normalized.Contains("done", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("complete", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("closed", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("resolved", StringComparison.OrdinalIgnoreCase))
        {
            return DomainTaskStatus.Done;
        }

        if (normalized.Contains("open", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("new", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("todo", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("to do", StringComparison.OrdinalIgnoreCase))
        {
            return DomainTaskStatus.New;
        }

        return DomainTaskStatus.New;
    }

    private static string NormalizeStatus(string status)
    {
        return string.IsNullOrWhiteSpace(status)
            ? string.Empty
            : status.Trim();
    }

    private static TaskPriority ResolveTaskPriority(string? clickUpPriority)
    {
        var normalized = NormalizeClickUpPriority(clickUpPriority);
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

    private static string NormalizeClickUpPriority(string? clickUpPriority)
    {
        return string.IsNullOrWhiteSpace(clickUpPriority)
            ? string.Empty
            : clickUpPriority.Trim();
    }

    private static MemberProjection? ResolveAssignee(
        IReadOnlyCollection<ClickUpAssigneeSyncModel> assignees,
        IReadOnlyCollection<MemberProjection> members,
        ProvisioningResult result)
    {
        foreach (var assignee in assignees)
        {
            var byId = members.FirstOrDefault(member => !string.IsNullOrWhiteSpace(member.ClickUpUserId) && string.Equals(member.ClickUpUserId, assignee.ClickUpUserId, StringComparison.OrdinalIgnoreCase));
            if (byId is not null)
            {
                return byId;
            }
        }

        foreach (var assignee in assignees)
        {
            var normalizedEmail = NormalizeEmail(assignee.Email);
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                continue;
            }

            var byEmail = members.FirstOrDefault(member => string.Equals(member.NormalizedEmail, normalizedEmail, StringComparison.OrdinalIgnoreCase));
            if (byEmail is not null)
            {
                return byEmail;
            }

            result.UnmatchedMembers.Add(assignee.Email.Trim());
        }

        return null;
    }

    private sealed record MemberProjection(string UserId, string FullName, string NormalizedEmail, string? ClickUpUserId);

    private sealed class ProvisioningResult
    {
        public bool TeamCreatedOrReused { get; set; } = true;
        public bool TeamLeaderAssigned { get; set; } = true;
        public int MembersFetched { get; set; }
        public int MembersInserted { get; set; }
        public int MembersUpdated { get; set; }
        public int MembersSkipped { get; set; }
        public int TasksFetched { get; set; }
        public int TasksInserted { get; set; }
        public int TasksUpdated { get; set; }
        public int TasksSkipped { get; set; }
        public List<string> UnmatchedMembers { get; } = [];
        public List<string> Errors { get; } = [];
    }
}
