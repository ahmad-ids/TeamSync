using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Persistence;
using IDS.Project.Infrastructure.Workload;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Tasks;

public sealed class TaskWorkflowService(
    ApplicationDbContext dbContext,
    ITaskQueryService taskQueryService) : ITaskWorkflowService
{
    public async Task<bool> DeleteTaskAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var isTeamLeader = await ResolveRoleFlagsAsync(currentUserId, cancellationToken);
        if (!isTeamLeader)
        {
            throw new ArgumentException("Only Team Leaders can delete tasks.");
        }

        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return false;
        }

        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == taskId && item.TeamId == scope.Value.TeamId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        var relatedStatusHistory = await dbContext.TaskStatusHistories
            .Where(item => item.TaskId == taskId)
            .ToArrayAsync(cancellationToken);
        var relatedChangeRequests = await dbContext.TaskChangeRequests
            .Where(item => item.TaskId == taskId)
            .ToArrayAsync(cancellationToken);
        var relatedReassignmentRequests = await dbContext.TaskReassignmentRequests
            .Where(item => item.TaskId == taskId)
            .ToArrayAsync(cancellationToken);

        if (relatedStatusHistory.Length > 0)
        {
            dbContext.TaskStatusHistories.RemoveRange(relatedStatusHistory);
        }

        if (relatedChangeRequests.Length > 0)
        {
            dbContext.TaskChangeRequests.RemoveRange(relatedChangeRequests);
        }

        if (relatedReassignmentRequests.Length > 0)
        {
            dbContext.TaskReassignmentRequests.RemoveRange(relatedReassignmentRequests);
        }

        dbContext.Tasks.Remove(task);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            throw new ArgumentException($"Task deletion failed: {exception.GetBaseException().Message}");
        }
        catch (SqlException exception)
        {
            throw new ArgumentException($"Task deletion failed: {exception.Message}");
        }

        return true;
    }

    public async Task<TaskDetailsDto?> ReassignTaskAsync(
        Guid taskId,
        CreateTaskReassignmentRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.ProposedAssigneeId))
        {
            throw new ArgumentException("A new assignee is required.");
        }

        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return null;
        }

        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == taskId && item.TeamId == scope.Value.TeamId, cancellationToken);
        if (task is null)
        {
            return null;
        }

        if (task.AssignedMemberId == request.ProposedAssigneeId)
        {
            throw new ArgumentException("Choose a different member for reassignment.");
        }

        var proposedMember = await QueryAssignableMemberAsync(request.ProposedAssigneeId, scope.Value.TeamId, cancellationToken);
        if (proposedMember is null)
        {
            return null;
        }

        EnsureRoleMatch(proposedMember, task.RequiredSpecialization);

        var now = DateTimeOffset.UtcNow;
        var originalAssigneeId = task.AssignedMemberId;
        task.AssignedMemberId = proposedMember.Id;
        task.IsAcknowledged = false;
        task.AcknowledgedAt = null;
        task.UpdatedAt = now;

        AddApprovedChangeRequest(
            task.Id,
            currentUserId,
            ChangeRequestType.ChangeOwner,
            originalAssigneeId,
            proposedMember.Id,
            now,
            "Task reassigned by Team Leader.");

        dbContext.TaskReassignmentRequests.Add(new TaskReassignmentRequest
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            RequestedById = currentUserId,
            CurrentAssigneeId = originalAssigneeId,
            ProposedAssigneeId = proposedMember.Id,
            Reason = "Task reassigned by Team Leader.",
            Status = ChangeRequestStatus.Approved,
            CurrentAssigneeDecision = ChangeRequestStatus.Approved,
            CurrentAssigneeRespondedAt = now,
            ProposedAssigneeDecision = ChangeRequestStatus.Approved,
            ProposedAssigneeRespondedAt = now,
            FinalizedById = currentUserId,
            FinalizedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return await taskQueryService.GetTaskDetailsAsync(task.Id, currentUserId, true, cancellationToken);
    }

    public async Task<bool> AcknowledgeTaskAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == taskId && item.AssignedMemberId == currentUserId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        if (task.IsAcknowledged)
        {
            return true;
        }

        var now = DateTimeOffset.UtcNow;
        task.IsAcknowledged = true;
        task.AcknowledgedAt = now;
        task.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<TaskDetailsDto?> UpdateTaskStatusAsync(
        Guid taskId,
        UpdateTaskStatusDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == taskId && item.AssignedMemberId == currentUserId, cancellationToken);
        if (task is null)
        {
            return null;
        }

        if (task.Status == request.Status)
        {
            return await taskQueryService.GetTaskDetailsAsync(taskId, currentUserId, false, cancellationToken);
        }

        EnsureMemberStatusTransition(task.Status, request.Status, task.IsAcknowledged);

        var now = DateTimeOffset.UtcNow;
        dbContext.TaskStatusHistories.Add(new TaskStatusHistory
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            OldStatus = task.Status,
            NewStatus = request.Status,
            ChangedById = currentUserId,
            ChangedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });

        task.Status = request.Status;
        task.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await taskQueryService.GetTaskDetailsAsync(taskId, currentUserId, false, cancellationToken);
    }

    private void AddApprovedChangeRequest(
        Guid taskId,
        string requesterId,
        ChangeRequestType requestType,
        string oldValue,
        string newValue,
        DateTimeOffset now,
        string reason)
    {
        dbContext.TaskChangeRequests.Add(new TaskChangeRequest
        {
            Id = Guid.NewGuid(),
            TaskId = taskId,
            RequesterId = requesterId,
            RequestType = requestType,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason,
            Status = ChangeRequestStatus.Approved,
            ReviewedById = requesterId,
            ReviewedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private async Task<(Guid TeamId, string TeamName)?> ResolveScopeAsync(string currentUserId, CancellationToken cancellationToken)
    {
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.TeamId })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser?.TeamId is Guid teamId)
        {
            var team = await dbContext.Teams.AsNoTracking()
                .Where(item => item.Id == teamId)
                .Select(item => new { item.Id, item.Name })
                .SingleOrDefaultAsync(cancellationToken);

            return team is null ? null : (team.Id, team.Name);
        }

        return null;
    }

    private async Task<bool> ResolveRoleFlagsAsync(string currentUserId, CancellationToken cancellationToken)
    {
        var roles = await (
            from userRole in dbContext.UserRoles.AsNoTracking()
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where userRole.UserId == currentUserId
            select role.Name)
            .ToArrayAsync(cancellationToken);

        return roles.Contains(RoleNames.TeamLeader, StringComparer.OrdinalIgnoreCase);
    }

    private async Task<MemberProjection?> QueryAssignableMemberAsync(string memberId, Guid teamId, CancellationToken cancellationToken)
    {
        return await (
            from user in dbContext.Users.AsNoTracking()
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId == teamId
                && user.Id == memberId
            select new MemberProjection(
                user.Id,
                user.FullName,
                user.Email!,
                SeedTeamDirectory.ResolveJobTitle(user.Email!),
                SeedTeamDirectory.ResolveSpecialization(user.Email!)))
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static void EnsureRoleMatch(MemberProjection member, TaskSpecialization requiredSpecialization)
    {
        if (member.Specialization != requiredSpecialization)
        {
            throw new ArgumentException(
                $"{member.FullName} is a {member.JobTitle} and does not match the required {SeedTeamDirectory.ResolveSpecializationLabel(requiredSpecialization)} specialization.");
        }
    }

    private static void EnsureMemberStatusTransition(DomainTaskStatus currentStatus, DomainTaskStatus nextStatus, bool isAcknowledged)
    {
        if (!isAcknowledged && nextStatus != DomainTaskStatus.New)
        {
            throw new ArgumentException("Acknowledge the task before updating its status.");
        }

        var isAllowed = currentStatus switch
        {
            DomainTaskStatus.New => nextStatus is DomainTaskStatus.InProgress or DomainTaskStatus.Blocked,
            DomainTaskStatus.InProgress => nextStatus is DomainTaskStatus.Blocked or DomainTaskStatus.Done,
            DomainTaskStatus.Blocked => nextStatus == DomainTaskStatus.InProgress,
            DomainTaskStatus.Done => false,
            _ => false
        };

        if (!isAllowed)
        {
            throw new ArgumentException($"The task cannot move from {currentStatus} to {nextStatus}.");
        }
    }

    private sealed record MemberProjection(string Id, string FullName, string Email, string JobTitle, TaskSpecialization Specialization);
}
