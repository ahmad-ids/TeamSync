using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Members;
using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Application.DTOs.Workload;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Workload;

public sealed class WorkloadQueryService(
    ApplicationDbContext dbContext,
    IWorkloadCalculator workloadCalculator) : IWorkloadQueryService
{
    private const double MemberCapacityThreshold = 25d;

    public async Task<WorkloadSummaryDto> GetSummaryAsync(
        string currentUserId,
        string period,
        DateOnly? startDate,
        DateOnly? endDate,
        Guid? teamId,
        string? search,
        string? sortBy,
        CancellationToken cancellationToken = default)
    {
        var (rangeStart, rangeEnd) = ResolveRange(period, startDate, endDate);
        var scope = await BuildScopeAsync(currentUserId, cancellationToken);
        if (scope.AllowedTeamIds.Count == 0)
        {
            return new WorkloadSummaryDto(rangeStart, rangeEnd, 0, 0, 0, 0, 0, 0, Array.Empty<WorkloadTeamDto>(), Array.Empty<WorkloadMemberDto>());
        }

        var allowedTeamIds = scope.AllowedTeamIds;
        if (teamId.HasValue)
        {
            allowedTeamIds = allowedTeamIds.Where(id => id == teamId.Value).ToArray();
        }

        if (allowedTeamIds.Count == 0)
        {
            return new WorkloadSummaryDto(rangeStart, rangeEnd, 0, 0, 0, 0, 0, 0, scope.AvailableTeams, Array.Empty<WorkloadMemberDto>());
        }

        var members = await QueryMembersAsync(allowedTeamIds, search, cancellationToken);
        var memberIds = members.Select(member => member.Id).ToArray();

        var tasks = await QueryTasksAsync(memberIds, rangeStart, rangeEnd, true, cancellationToken);
        var tasksByMemberId = tasks.GroupBy(task => task.AssignedMemberId).ToDictionary(group => group.Key, group => group.ToArray());

        var memberDtos = members
            .Select(member => ToMemberDto(member, tasksByMemberId.TryGetValue(member.Id, out var memberTasks) ? memberTasks : Array.Empty<TaskItem>()))
            .ToArray();

        memberDtos = ApplySort(memberDtos, sortBy);

        var totalTasks = memberDtos.Sum(member => member.TotalTasks);
        var totalEffortHours = memberDtos.Sum(member => member.TotalEffortHours);
        var totalWeight = memberDtos.Sum(member => member.TotalWeight);
        var overloadedMembers = memberDtos.Count(member => member.Status == WorkloadStatus.Overloaded);
        var capacityPercentage = memberDtos.Length == 0
            ? 0
            : Math.Round((totalWeight / (memberDtos.Length * MemberCapacityThreshold)) * 100, 1);

        return new WorkloadSummaryDto(
            rangeStart,
            rangeEnd,
            memberDtos.Length,
            totalTasks,
            totalEffortHours,
            Math.Round(totalWeight, 1),
            capacityPercentage,
            overloadedMembers,
            scope.AvailableTeams,
            memberDtos);
    }

    public async Task<MemberWorkloadDetailsDto?> GetMemberDetailsAsync(
        string memberId,
        string currentUserId,
        string period,
        DateOnly? startDate,
        DateOnly? endDate,
        bool includeCompletedTasks = false,
        CancellationToken cancellationToken = default)
    {
        var (rangeStart, rangeEnd) = ResolveRange(period, startDate, endDate);
        var scope = await BuildScopeAsync(currentUserId, cancellationToken);
        if (scope.AllowedTeamIds.Count == 0)
        {
            return null;
        }

        var member = await (
            from user in dbContext.Users.AsNoTracking()
            join team in dbContext.Teams.AsNoTracking() on user.TeamId equals team.Id
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.Id == memberId
                && user.TeamId.HasValue
                && scope.AllowedTeamIds.Contains(user.TeamId.Value)
            select new MemberProjection(
                user.Id,
                user.FullName,
                user.Email!,
                SeedTeamDirectory.ResolveJobTitle(user.Email!),
                SeedTeamDirectory.ResolveSpecialization(user.Email!),
                team.Name))
            .SingleOrDefaultAsync(cancellationToken);

        if (member is null)
        {
            return null;
        }

        var tasks = await QueryTasksAsync(new[] { member.Id }, rangeStart, rangeEnd, includeCompletedTasks, cancellationToken);
        var totalEffortHours = tasks.Sum(task => task.EstimatedEffortHours);
        var totalWeight = tasks.Sum(task => task.CalculatedWeight);
        var capacityPercentage = totalWeight <= 0
            ? 0
            : Math.Round((totalWeight / MemberCapacityThreshold) * 100, 1);
        var previousRange = ResolvePreviousRange(rangeStart, rangeEnd);
        var previousTasks = await QueryTasksAsync(new[] { member.Id }, previousRange.StartDate, previousRange.EndDate, includeCompletedTasks, cancellationToken);
        var taskDeltaFromPreviousPeriod = tasks.Length - previousTasks.Length;

        var taskDtos = tasks
            .OrderBy(task => task.DueDate)
            .ThenBy(task => task.Title)
            .Select(task => new TaskListItemDto(
                task.Id,
                task.Title,
                member.FullName,
                task.Priority,
                task.Complexity,
                task.EstimatedEffortHours,
                task.CalculatedWeight,
                task.DueDate,
                task.Status,
                task.IsAcknowledged,
                task.AcknowledgedAt))
            .ToArray();
        var prioritySplit = tasks
            .GroupBy(task => task.Priority)
            .OrderByDescending(group => group.Key)
            .Select(group => new MemberPrioritySplitDto(
                group.Key.ToString(),
                group.Count(),
                Math.Round(group.Sum(task => task.CalculatedWeight), 1)))
            .ToArray();
        var dailyEffortHours = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var day = rangeStart.AddDays(offset);
                return Math.Round(tasks
                    .Where(task => task.StartDate <= day && task.DueDate >= day)
                    .Sum(task => task.EstimatedEffortHours), 1);
            })
            .ToArray();
        var history = await QueryHistoryAsync(member.Id, scope.AllowedTeamIds, rangeStart, rangeEnd, cancellationToken);
        var blockedTasks = tasks.Count(task => task.Status == DomainTaskStatus.Blocked);
        var criticalTasks = tasks.Count(task => task.Priority == TaskPriority.Critical);
        var impactScore = ResolveImpactScore(totalWeight, blockedTasks, criticalTasks);
        var insight = BuildInsight(member.FullName, totalWeight, blockedTasks, criticalTasks, tasks.Length);

        return new MemberWorkloadDetailsDto(
            member.Id,
            member.FullName,
            member.JobTitle,
            member.Email,
            member.TeamName,
            rangeStart,
            rangeEnd,
            taskDtos.Length,
            taskDeltaFromPreviousPeriod,
            totalEffortHours,
            Math.Round(totalWeight, 1),
            capacityPercentage,
            impactScore,
            blockedTasks,
            criticalTasks,
            insight,
            workloadCalculator.ResolveStatus(totalWeight),
            prioritySplit,
            dailyEffortHours,
            history,
            taskDtos);
    }

    private async Task<ScopeResult> BuildScopeAsync(string currentUserId, CancellationToken cancellationToken)
    {
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.TeamId })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser?.TeamId is null)
        {
            return new ScopeResult(Array.Empty<Guid>(), Array.Empty<WorkloadTeamDto>());
        }

        var team = await dbContext.Teams.AsNoTracking()
            .Where(item => item.Id == currentUser.TeamId.Value)
            .Select(item => new WorkloadTeamDto(item.Id, item.Name))
            .SingleAsync(cancellationToken);

        return new ScopeResult(new[] { currentUser.TeamId.Value }, new[] { team });
    }

    private async Task<MemberProjection[]> QueryMembersAsync(
        IReadOnlyCollection<Guid> allowedTeamIds,
        string? search,
        CancellationToken cancellationToken)
    {
        var normalizedSearch = search?.Trim();

        var query =
            from user in dbContext.Users.AsNoTracking()
            join team in dbContext.Teams.AsNoTracking() on user.TeamId equals team.Id
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId.HasValue
                && allowedTeamIds.Contains(user.TeamId.Value)
            select new
            {
                user.Id,
                user.FullName,
                Email = user.Email!,
                TeamName = team.Name
            };

        var members = await query
            .OrderBy(member => member.FullName)
            .ToArrayAsync(cancellationToken);

        return members
            .Select(member => new MemberProjection(
                member.Id,
                member.FullName,
                member.Email,
                SeedTeamDirectory.ResolveJobTitle(member.Email),
                SeedTeamDirectory.ResolveSpecialization(member.Email),
                member.TeamName))
            .Where(member =>
                string.IsNullOrWhiteSpace(normalizedSearch) ||
                member.FullName.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                member.Email.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                member.TeamName.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                member.JobTitle.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase))
            .ToArray();
    }

    private async Task<TaskItem[]> QueryTasksAsync(
        IReadOnlyCollection<string> memberIds,
        DateOnly startDate,
        DateOnly endDate,
        bool includeCompletedTasks,
        CancellationToken cancellationToken)
    {
        if (memberIds.Count == 0)
        {
            return Array.Empty<TaskItem>();
        }

        return await dbContext.Tasks.AsNoTracking()
            .Where(task =>
                memberIds.Contains(task.AssignedMemberId) &&
                (includeCompletedTasks || task.Status != DomainTaskStatus.Done) &&
                task.StartDate <= endDate &&
                task.DueDate >= startDate)
            .OrderBy(task => task.DueDate)
            .ThenBy(task => task.Title)
            .ToArrayAsync(cancellationToken);
    }

    private WorkloadMemberDto ToMemberDto(MemberProjection member, IReadOnlyCollection<TaskItem> tasks)
    {
        var activeTasks = tasks.Where(task => task.Status != DomainTaskStatus.Done).ToArray();
        var totalEffortHours = activeTasks.Sum(task => task.EstimatedEffortHours);
        var totalWeight = activeTasks.Sum(task => task.CalculatedWeight);
        DateOnly? lastTaskDueDate = tasks.Count == 0 ? null : tasks.Max(task => task.DueDate);
        var capacityPercentage = totalWeight <= 0
            ? 0
            : Math.Round((totalWeight / MemberCapacityThreshold) * 100, 1);

        return new WorkloadMemberDto(
            member.Id,
            member.FullName,
            member.Email,
            member.JobTitle,
            member.Specialization,
            member.TeamName,
            activeTasks.Length,
            totalEffortHours,
            Math.Round(totalWeight, 1),
            capacityPercentage,
            workloadCalculator.ResolveStatus(totalWeight),
            lastTaskDueDate);
    }

    private static WorkloadMemberDto[] ApplySort(WorkloadMemberDto[] members, string? sortBy)
    {
        return (sortBy ?? "workload").Trim().ToLowerInvariant() switch
        {
            "name" => members.OrderBy(member => member.FullName).ToArray(),
            "tasks" => members.OrderByDescending(member => member.TotalTasks).ThenBy(member => member.FullName).ToArray(),
            "effort" => members.OrderByDescending(member => member.TotalEffortHours).ThenBy(member => member.FullName).ToArray(),
            "workloadasc" => members.OrderBy(member => member.TotalWeight).ThenBy(member => member.FullName).ToArray(),
            _ => members.OrderByDescending(member => member.TotalWeight).ThenBy(member => member.FullName).ToArray()
        };
    }

    private static (DateOnly StartDate, DateOnly EndDate) ResolveRange(string period, DateOnly? startDate, DateOnly? endDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7));

        return (period ?? "thisWeek").Trim().ToLowerInvariant() switch
        {
            "nextweek" => (weekStart.AddDays(7), weekStart.AddDays(13)),
            "custom" when startDate.HasValue && endDate.HasValue && startDate <= endDate => (startDate.Value, endDate.Value),
            "custom" => throw new InvalidOperationException("Custom range requires valid start and end dates."),
            _ => (weekStart, weekStart.AddDays(6))
        };
    }

    private static (DateOnly StartDate, DateOnly EndDate) ResolvePreviousRange(DateOnly startDate, DateOnly endDate)
    {
        var span = endDate.DayNumber - startDate.DayNumber + 1;
        var previousEnd = startDate.AddDays(-1);
        var previousStart = previousEnd.AddDays(-(span - 1));
        return (previousStart, previousEnd);
    }

    private async Task<MemberActivityHistoryItemDto[]> QueryHistoryAsync(
        string memberId,
        IReadOnlyCollection<Guid> allowedTeamIds,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var relevantTasks = await dbContext.Tasks.AsNoTracking()
            .Where(task =>
                task.AssignedMemberId == memberId &&
                allowedTeamIds.Contains(task.TeamId) &&
                task.StartDate <= endDate &&
                task.DueDate >= startDate)
            .Select(task => new
            {
                task.Id,
                task.Title,
                task.CreatedAt,
                task.CreatedById,
                task.Priority,
                task.Complexity,
                task.DueDate,
                task.IsAcknowledged,
                task.AcknowledgedAt
            })
            .ToListAsync(cancellationToken);

        if (relevantTasks.Count == 0)
        {
            return Array.Empty<MemberActivityHistoryItemDto>();
        }

        var relevantTaskIds = relevantTasks.Select(task => task.Id).ToArray();

        var statusHistoryRows = await (
            from history in dbContext.TaskStatusHistories.AsNoTracking()
            join task in dbContext.Tasks.AsNoTracking() on history.TaskId equals task.Id
            where task.AssignedMemberId == memberId
                && allowedTeamIds.Contains(task.TeamId)
                && task.StartDate <= endDate
                && task.DueDate >= startDate
                && history.OldStatus != history.NewStatus
            select new
            {
                EventId = history.Id,
                TaskId = task.Id,
                task.Title,
                history.OldStatus,
                history.NewStatus,
                history.ChangedById,
                history.ChangedAt
            })
            .ToListAsync(cancellationToken);

        var changeRequestRows = await (
            from request in dbContext.TaskChangeRequests.AsNoTracking()
            join task in dbContext.Tasks.AsNoTracking() on request.TaskId equals task.Id
            where task.AssignedMemberId == memberId
                && allowedTeamIds.Contains(task.TeamId)
                && task.StartDate <= endDate
                && task.DueDate >= startDate
            select new
            {
                EventId = request.Id,
                TaskId = task.Id,
                task.Title,
                request.RequestType,
                request.OldValue,
                request.NewValue,
                request.Reason,
                request.Status,
                request.RequesterId,
                request.ReviewedById,
                request.ReviewedAt,
                request.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var relatedUserIds = relevantTasks.Select(task => task.CreatedById)
            .Concat(statusHistoryRows.Select(row => row.ChangedById))
            .Concat(changeRequestRows.Select(row => row.RequesterId))
            .Concat(changeRequestRows.Where(row => row.ReviewedById is not null).Select(row => row.ReviewedById!))
            .Concat(changeRequestRows.Where(row => row.RequestType == ChangeRequestType.ChangeOwner).Select(row => row.OldValue))
            .Concat(changeRequestRows.Where(row => row.RequestType == ChangeRequestType.ChangeOwner).Select(row => row.NewValue))
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var nameLookup = await dbContext.Users.AsNoTracking()
            .Where(user => relatedUserIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FullName })
            .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        var assignmentEvents = relevantTasks
            .Select(task => new MemberActivityHistoryItemDto(
                Guid.NewGuid(),
                task.Id,
                task.Title,
                "Assignment",
                "Task assigned",
                BuildAssignmentDetails(
                    ResolveActorName(task.CreatedById, nameLookup),
                    task.Priority,
                    task.Complexity,
                    task.DueDate),
                task.CreatedAt,
                null,
                null,
                ResolveActorName(task.CreatedById, nameLookup)))
            .ToList();

        var statusEvents = statusHistoryRows
            .Select(row => new MemberActivityHistoryItemDto(
                row.EventId,
                row.TaskId,
                row.Title,
                "Status",
                BuildStatusSummary(row.OldStatus, row.NewStatus),
                BuildStatusDetails(row.ChangedById, row.ChangedAt, nameLookup),
                row.ChangedAt,
                null,
                null,
                ResolveActorName(row.ChangedById, nameLookup)))
            .ToList();

        var changeRequestEvents = changeRequestRows
            .Select(row => new MemberActivityHistoryItemDto(
                row.EventId,
                row.TaskId,
                row.Title,
                "ChangeRequest",
                BuildChangeRequestSummary(row.RequestType, row.Status),
                BuildChangeRequestDetails(
                    row.RequestType,
                    row.Status,
                    ResolveChangeRequestDisplayValue(row.RequestType, row.OldValue, nameLookup),
                    ResolveChangeRequestDisplayValue(row.RequestType, row.NewValue, nameLookup),
                    row.Reason,
                    ResolveActorName(row.RequesterId, nameLookup),
                    row.ReviewedById is null ? null : ResolveActorName(row.ReviewedById, nameLookup)),
                row.ReviewedAt ?? row.CreatedAt,
                ResolveChangeRequestDisplayValue(row.RequestType, row.OldValue, nameLookup),
                ResolveChangeRequestDisplayValue(row.RequestType, row.NewValue, nameLookup),
                row.ReviewedById is null ? ResolveActorName(row.RequesterId, nameLookup) : ResolveActorName(row.ReviewedById, nameLookup)))
            .ToList();

        var acknowledgementEvents = relevantTasks
            .Where(task => task.IsAcknowledged && task.AcknowledgedAt.HasValue)
            .Select(task => new MemberActivityHistoryItemDto(
                Guid.NewGuid(),
                task.Id,
                task.Title,
                "Acknowledgement",
                "Task acknowledged",
                "The assignee confirmed the task scope and planned delivery window.",
                task.AcknowledgedAt!.Value,
                null,
                null,
                ResolveActorName(task.CreatedById, nameLookup)))
            .ToList();

        return assignmentEvents
            .Concat(statusEvents)
            .Concat(changeRequestEvents)
            .Concat(acknowledgementEvents)
            .OrderByDescending(item => item.OccurredAt)
            .Take(12)
            .ToArray();
    }

    private static string ResolveActorName(string? userId, IReadOnlyDictionary<string, string> nameLookup)
    {
        if (!string.IsNullOrWhiteSpace(userId) && nameLookup.TryGetValue(userId, out var fullName))
        {
            return fullName;
        }

        return "a team lead";
    }

    private static string BuildAssignmentDetails(string assignedByName, TaskPriority priority, TaskComplexity complexity, DateOnly dueDate)
    {
        return $"Assigned by {assignedByName} as {priority.ToString().ToLowerInvariant()} priority {complexity.ToString().ToLowerInvariant()} work due {dueDate:MMM d}.";
    }

    private static string BuildStatusSummary(DomainTaskStatus oldStatus, DomainTaskStatus newStatus)
    {
        return $"Task status changed from {ToStatusLabel(oldStatus)} to {ToStatusLabel(newStatus)}";
    }

    private static string BuildStatusDetails(string changedById, DateTimeOffset changedAt, IReadOnlyDictionary<string, string> nameLookup)
    {
        return $"Updated by {ResolveActorName(changedById, nameLookup)} on {changedAt:MMM dd, yyyy 'at' h:mm tt}.";
    }

    private static string BuildChangeRequestSummary(ChangeRequestType requestType, ChangeRequestStatus status)
    {
        var requestLabel = requestType switch
        {
            ChangeRequestType.ChangeDueDate => "Change due date request",
            ChangeRequestType.ChangeOwner => "Change owner request",
            ChangeRequestType.IncreaseEstimatedEffort => "Increase effort request",
            _ => "Task change request"
        };

        return status switch
        {
            ChangeRequestStatus.Approved => $"{requestLabel} approved",
            ChangeRequestStatus.Rejected => $"{requestLabel} rejected",
            _ => $"{requestLabel} submitted"
        };
    }

    private static string BuildChangeRequestDetails(
        ChangeRequestType requestType,
        ChangeRequestStatus status,
        string fromUserName,
        string toUserName,
        string reason,
        string requesterName,
        string? reviewerName)
    {
        var changeDetails = requestType switch
        {
            ChangeRequestType.ChangeDueDate => status switch
            {
                ChangeRequestStatus.Approved when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} approved the due date change from {fromUserName} to {toUserName}.",
                ChangeRequestStatus.Rejected when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} rejected the due date change from {fromUserName} to {toUserName}.",
                _ => $"{requesterName} requested a due date change from {fromUserName} to {toUserName}."
            },
            ChangeRequestType.ChangeOwner => status switch
            {
                ChangeRequestStatus.Approved when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} reassigned the task from {fromUserName} to {toUserName}.",
                ChangeRequestStatus.Rejected when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} rejected the reassignment from {fromUserName} to {toUserName}.",
                _ => $"{requesterName} requested reassignment from {fromUserName} to {toUserName}."
            },
            ChangeRequestType.IncreaseEstimatedEffort => status switch
            {
                ChangeRequestStatus.Approved when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} approved the effort change from {fromUserName}h to {toUserName}h.",
                ChangeRequestStatus.Rejected when !string.IsNullOrWhiteSpace(reviewerName) => $"{reviewerName} rejected the effort change from {fromUserName}h to {toUserName}h.",
                _ => $"{requesterName} requested an effort change from {fromUserName}h to {toUserName}h."
            },
            _ => "Requested a task update."
        };

        var normalizedReason = reason?.Trim();
        var shouldAppendReason = !string.IsNullOrWhiteSpace(normalizedReason)
            && !normalizedReason.Equals("Task reassigned by Team Leader.", StringComparison.OrdinalIgnoreCase);

        return shouldAppendReason
            ? $"{changeDetails} {normalizedReason}".Trim()
            : changeDetails;
    }

    private static string ResolveChangeRequestDisplayValue(
        ChangeRequestType requestType,
        string value,
        IReadOnlyDictionary<string, string> nameLookup) => requestType switch
    {
        ChangeRequestType.ChangeOwner when nameLookup.TryGetValue(value, out var fullName) => fullName,
        ChangeRequestType.ChangeOwner => "another member",
        ChangeRequestType.ChangeDueDate when DateOnly.TryParse(value, out var date) => date.ToString("MMM dd, yyyy"),
        ChangeRequestType.IncreaseEstimatedEffort when decimal.TryParse(value, out var hours) => $"{hours:0.##}",
        _ => value
    };

    private static string ToStatusLabel(DomainTaskStatus status) => status switch
    {
        DomainTaskStatus.New => "New",
        DomainTaskStatus.InProgress => "In Progress",
        DomainTaskStatus.Blocked => "Blocked",
        DomainTaskStatus.Done => "Done",
        _ => status.ToString()
    };

    private static double ResolveImpactScore(double totalWeight, int blockedTasks, int criticalTasks)
    {
        var normalized = (totalWeight / MemberCapacityThreshold) * 6.5d;
        var score = normalized + (blockedTasks * 0.7d) + (criticalTasks * 0.45d);
        return Math.Round(Math.Clamp(score, 0d, 10d), 1);
    }

    private static string BuildInsight(string fullName, double totalWeight, int blockedTasks, int criticalTasks, int taskCount)
    {
        if (totalWeight >= 26d)
        {
            return $"{fullName} is above the overload threshold. Reassigning one high-weight task would reduce delivery risk this week.";
        }

        if (blockedTasks > 0)
        {
            return $"{fullName} has blocked work in the current range. Clearing blockers is likely to improve capacity faster than adding new tasks.";
        }

        if (criticalTasks >= 2)
        {
            return $"{fullName} is carrying multiple critical items. Review priority balance before assigning additional work.";
        }

        return taskCount == 0
            ? $"{fullName} has no active tasks in the selected range."
            : $"{fullName} remains within a manageable workload range for the selected period.";
    }

    private sealed record MemberProjection(string Id, string FullName, string Email, string JobTitle, TaskSpecialization Specialization, string TeamName);

    private sealed record ScopeResult(IReadOnlyCollection<Guid> AllowedTeamIds, IReadOnlyCollection<WorkloadTeamDto> AvailableTeams);
}
