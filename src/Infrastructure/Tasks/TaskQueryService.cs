using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using IDS.Project.Infrastructure.Workload;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Tasks;

public sealed class TaskQueryService(
    ApplicationDbContext dbContext) : ITaskQueryService
{
    private const double MemberCapacityThreshold = 25d;

    public async Task<TaskListItemDto[]> GetTasksAsync(
        string currentUserId,
        bool isTeamLeader,
        CancellationToken cancellationToken = default)
    {
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.Id, user.TeamId })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser is null)
        {
            return Array.Empty<TaskListItemDto>();
        }

        var query =
            from taskItem in dbContext.Tasks.AsNoTracking()
            join assignedMember in dbContext.Users.AsNoTracking() on taskItem.AssignedMemberId equals assignedMember.Id
            where (isTeamLeader && currentUser.TeamId.HasValue && taskItem.TeamId == currentUser.TeamId.Value)
                || (!isTeamLeader && taskItem.AssignedMemberId == currentUserId)
            orderby taskItem.DueDate, taskItem.Title
            select new TaskListItemDto(
                taskItem.Id,
                taskItem.Title,
                assignedMember.FullName,
                taskItem.Priority,
                taskItem.Complexity,
                taskItem.EstimatedEffortHours,
                Math.Round(taskItem.CalculatedWeight, 1),
                taskItem.DueDate,
                taskItem.Status,
                taskItem.IsAcknowledged,
                taskItem.AcknowledgedAt);

        return await query.ToArrayAsync(cancellationToken);
    }

    public async Task<TaskDetailsDto?> GetTaskDetailsAsync(
        Guid taskId,
        string currentUserId,
        bool isTeamLeader,
        CancellationToken cancellationToken = default)
    {
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.Id, user.TeamId })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser is null)
        {
            return null;
        }

        var taskProjection = await (
            from taskItem in dbContext.Tasks.AsNoTracking()
            join team in dbContext.Teams.AsNoTracking() on taskItem.TeamId equals team.Id
            join assignedMember in dbContext.Users.AsNoTracking() on taskItem.AssignedMemberId equals assignedMember.Id
            join createdBy in dbContext.Users.AsNoTracking() on taskItem.CreatedById equals createdBy.Id
            where taskItem.Id == taskId
            select new
            {
                Task = taskItem,
                TeamName = team.Name,
                AssignedMemberName = assignedMember.FullName,
                AssignedMemberEmail = assignedMember.Email!,
                CreatedByName = createdBy.FullName
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (taskProjection is null)
        {
            return null;
        }

        var taskEntity = taskProjection.Task;
        // Allow the last assignee to keep read-only access after a Team Leader reassigns the task.
        var wasPreviouslyAssigned = await dbContext.TaskChangeRequests.AsNoTracking()
            .Where(request =>
                request.TaskId == taskEntity.Id &&
                request.RequestType == ChangeRequestType.ChangeOwner &&
                request.Status == ChangeRequestStatus.Approved)
            .OrderByDescending(request => request.ReviewedAt ?? request.CreatedAt)
            .Select(request => request.OldValue)
            .FirstOrDefaultAsync(cancellationToken);

        var isAllowed = (isTeamLeader && currentUser.TeamId.HasValue && currentUser.TeamId.Value == taskEntity.TeamId)
            || taskEntity.AssignedMemberId == currentUserId
            || (!string.IsNullOrWhiteSpace(wasPreviouslyAssigned) && wasPreviouslyAssigned == currentUserId);

        if (!isAllowed)
        {
            return null;
        }

        var nameLookup = await dbContext.Users.AsNoTracking()
            .Where(user => user.IsActive)
            .Select(user => new { user.Id, user.FullName })
            .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        var reassignmentRequests = await BuildReassignmentRequestsAsync(taskEntity.Id, nameLookup, cancellationToken);
        var statusTimeline = await BuildStatusTimelineAsync(taskEntity, taskProjection.CreatedByName, taskProjection.AssignedMemberName, nameLookup, cancellationToken);
        var changeAudit = await BuildChangeAuditAsync(taskEntity.Id, nameLookup, cancellationToken);
        var assigneeCapacity = await BuildAssigneeCapacityAsync(taskEntity.AssignedMemberId, cancellationToken);
        var assigneeCapacityPercentage = assigneeCapacity.Length == 0
            ? 0
            : Math.Round(assigneeCapacity.Average(point => point.CapacityPercentage), 1);

        return new TaskDetailsDto(
            taskEntity.Id,
            taskEntity.Title,
            taskEntity.Description,
            taskEntity.AssignedMemberId,
            taskProjection.AssignedMemberName,
            taskProjection.AssignedMemberEmail,
            taskEntity.CreatedById,
            taskProjection.CreatedByName,
            taskEntity.TeamId,
            taskProjection.TeamName,
            taskEntity.RequiredSpecialization,
            taskEntity.Priority,
            taskEntity.Complexity,
            taskEntity.EstimatedEffortHours,
            taskEntity.StartDate,
            taskEntity.DueDate,
            taskEntity.Status,
            Math.Round(taskEntity.CalculatedWeight, 1),
            taskEntity.IsAcknowledged,
            taskEntity.AcknowledgedAt,
            taskEntity.CreatedAt,
            taskEntity.UpdatedAt,
            ResolveComplexityMultiplier(taskEntity.Complexity),
            ResolvePriorityMultiplier(taskEntity.Priority),
            assigneeCapacityPercentage,
            reassignmentRequests,
            statusTimeline,
            changeAudit,
            assigneeCapacity);
    }

    private async Task<TaskReassignmentRequestDto[]> BuildReassignmentRequestsAsync(
        Guid taskId,
        IReadOnlyDictionary<string, string> nameLookup,
        CancellationToken cancellationToken)
    {
        var requests = await dbContext.TaskReassignmentRequests.AsNoTracking()
            .Where(request => request.TaskId == taskId)
            .OrderByDescending(request => request.CreatedAt)
            .ToArrayAsync(cancellationToken);

        if (requests.Length == 0)
        {
            return Array.Empty<TaskReassignmentRequestDto>();
        }

        var proposedAssigneeIds = requests
            .Select(request => request.ProposedAssigneeId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var proposedAssigneeLookup = await dbContext.Users.AsNoTracking()
            .Where(user => proposedAssigneeIds.Contains(user.Id))
            .Select(user => new
            {
                user.Id,
                Email = user.Email ?? string.Empty
            })
            .ToDictionaryAsync(
                user => user.Id,
                user => new
                {
                    user.Email,
                    JobTitle = SeedTeamDirectory.ResolveJobTitle(user.Email)
                },
                cancellationToken);

        return requests
            .Select(request =>
            {
                var proposedAssigneeProfile = proposedAssigneeLookup.TryGetValue(request.ProposedAssigneeId, out var profile)
                    ? profile
                    : null;

                return new TaskReassignmentRequestDto(
                    request.Id,
                    request.RequestedById,
                    ResolveUserDisplayName(request.RequestedById, nameLookup),
                    request.CurrentAssigneeId,
                    ResolveUserDisplayName(request.CurrentAssigneeId, nameLookup),
                    request.ProposedAssigneeId,
                    ResolveUserDisplayName(request.ProposedAssigneeId, nameLookup),
                    proposedAssigneeProfile?.Email ?? string.Empty,
                    proposedAssigneeProfile?.JobTitle ?? string.Empty,
                    request.Reason,
                    request.Status,
                    request.CurrentAssigneeDecision,
                    request.CurrentAssigneeRespondedAt,
                    request.ProposedAssigneeDecision,
                    request.ProposedAssigneeRespondedAt,
                    request.CreatedAt,
                    request.FinalizedAt);
            })
            .ToArray();
    }

    private async Task<TaskStatusTimelineItemDto[]> BuildStatusTimelineAsync(
        TaskItem task,
        string createdByName,
        string assignedMemberName,
        IReadOnlyDictionary<string, string> nameLookup,
        CancellationToken cancellationToken)
    {
        var events = new List<TaskStatusTimelineItemDto>
        {
            new(
                Guid.NewGuid(),
                "Created",
                $"{task.CreatedAt:MMM dd, hh:mm tt} by {createdByName}",
                task.CreatedAt,
                false),
            new(
                Guid.NewGuid(),
                $"Assigned to {assignedMemberName}",
                $"{task.CreatedAt.AddMinutes(15):MMM dd, hh:mm tt}",
                task.CreatedAt.AddMinutes(15),
                false)
        };

        if (task.IsAcknowledged && task.AcknowledgedAt.HasValue)
        {
            events.Add(new TaskStatusTimelineItemDto(
                Guid.NewGuid(),
                "Acknowledged",
                $"{task.AcknowledgedAt.Value:MMM dd, hh:mm tt}",
                task.AcknowledgedAt.Value,
                false));
        }

        var statusHistory = await dbContext.TaskStatusHistories.AsNoTracking()
            .Where(history => history.TaskId == task.Id)
            .OrderBy(history => history.ChangedAt)
            .ToArrayAsync(cancellationToken);

        events.AddRange(statusHistory.Select(history =>
        {
            var changedByName = nameLookup.TryGetValue(history.ChangedById, out var fullName) ? fullName : "System";
            return new TaskStatusTimelineItemDto(
                history.Id,
                ToStatusLabel(history.NewStatus),
                $"{history.ChangedAt:MMM dd, hh:mm tt} by {changedByName}",
                history.ChangedAt,
                false);
        }));

        return events
            .OrderBy(item => item.OccurredAt)
            .Select((item, index) => item with { IsCurrent = index == events.Count - 1 })
            .ToArray();
    }

    private async Task<TaskChangeAuditItemDto[]> BuildChangeAuditAsync(
        Guid taskId,
        IReadOnlyDictionary<string, string> nameLookup,
        CancellationToken cancellationToken)
    {
        var requests = await dbContext.TaskChangeRequests.AsNoTracking()
            .Where(request => request.TaskId == taskId)
            .OrderByDescending(request => request.ReviewedAt ?? request.CreatedAt)
            .ToArrayAsync(cancellationToken);

        return requests
            .Select(request =>
            {
                var updatedById = request.ReviewedById ?? request.RequesterId;
                var updatedByName = nameLookup.TryGetValue(updatedById, out var fullName) ? fullName : "System";
                var fromUserName = request.RequestType == ChangeRequestType.ChangeOwner
                    ? ResolveAuditValue(request.RequestType, request.OldValue, nameLookup)
                    : null;
                var toUserName = request.RequestType == ChangeRequestType.ChangeOwner
                    ? ResolveAuditValue(request.RequestType, request.NewValue, nameLookup)
                    : null;
                return new TaskChangeAuditItemDto(
                    request.Id,
                    ResolveAuditField(request.RequestType),
                    ResolveAuditValue(request.RequestType, request.OldValue, nameLookup),
                    ResolveAuditValue(request.RequestType, request.NewValue, nameLookup),
                    updatedByName,
                    request.ReviewedAt ?? request.CreatedAt,
                    request.Status.ToString(),
                    fromUserName,
                    toUserName,
                    updatedByName);
            })
            .ToArray();
    }

    private async Task<TaskCapacityPointDto[]> BuildAssigneeCapacityAsync(string assignedMemberId, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7));
        var weekEnd = weekStart.AddDays(6);

        var tasks = await dbContext.Tasks.AsNoTracking()
            .Where(task =>
                task.AssignedMemberId == assignedMemberId &&
                task.Status != DomainTaskStatus.Done &&
                task.StartDate <= weekEnd &&
                task.DueDate >= weekStart)
            .ToArrayAsync(cancellationToken);

        return Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var day = weekStart.AddDays(offset);
                var dailyWeight = tasks
                    .Where(task => task.StartDate <= day && task.DueDate >= day)
                    .Sum(task => task.CalculatedWeight);

                return new TaskCapacityPointDto(
                    day.DayOfWeek.ToString()[..3],
                    Math.Round((dailyWeight / MemberCapacityThreshold) * 100, 1),
                    day == today);
            })
            .ToArray();
    }

    private static string ResolveAuditField(ChangeRequestType requestType) => requestType switch
    {
        ChangeRequestType.ChangeOwner => "Owner",
        ChangeRequestType.ChangeDueDate => "Due Date",
        ChangeRequestType.IncreaseEstimatedEffort => "Effort Estimate",
        _ => "Task"
    };

    private static string ResolveAuditValue(
        ChangeRequestType requestType,
        string value,
        IReadOnlyDictionary<string, string> nameLookup) =>
        requestType == ChangeRequestType.ChangeOwner && nameLookup.TryGetValue(value, out var fullName)
            ? fullName
            : requestType == ChangeRequestType.ChangeOwner
                ? "another member"
                : value;

    private static string ResolveUserDisplayName(string userId, IReadOnlyDictionary<string, string> nameLookup) =>
        nameLookup.TryGetValue(userId, out var fullName) ? fullName : "another member";

    private static string ToStatusLabel(DomainTaskStatus status) => status switch
    {
        DomainTaskStatus.InProgress => "In Progress",
        _ => status.ToString()
    };

    private static double ResolveComplexityMultiplier(TaskComplexity complexity) => complexity switch
    {
        TaskComplexity.Simple => 1.0,
        TaskComplexity.Medium => 1.5,
        TaskComplexity.Complex => 2.0,
        _ => 1.0
    };

    private static double ResolvePriorityMultiplier(TaskPriority priority) => priority switch
    {
        TaskPriority.Low => 1.0,
        TaskPriority.Medium => 1.2,
        TaskPriority.High => 1.5,
        TaskPriority.Critical => 2.0,
        _ => 1.0
    };
}
