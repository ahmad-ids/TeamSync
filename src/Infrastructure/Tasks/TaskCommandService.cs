using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using IDS.Project.Infrastructure.Workload;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Tasks;

public sealed class TaskCommandService(
    ApplicationDbContext dbContext,
    ITaskQueryService taskQueryService,
    IWorkloadCalculator workloadCalculator) : ITaskCommandService
{
    private const double MemberCapacityThreshold = 25d;

    public async Task<TaskFormOptionsDto?> GetFormOptionsAsync(
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return null;
        }

        var activeScope = scope.Value;
        var week = ResolveWeekRange(DateOnly.FromDateTime(DateTime.UtcNow));
        var members = await QueryMemberOptionsAsync(activeScope.TeamId, week.StartDate, week.EndDate, null, cancellationToken);
        return new TaskFormOptionsDto(activeScope.TeamId, activeScope.TeamName, members);
    }

    public async Task<TaskPreviewDto?> GetTaskPreviewAsync(
        TaskPreviewRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(
            request.AssignedMemberId,
            request.RequiredSpecialization,
            request.EstimatedEffortHours,
            request.StartDate,
            request.DueDate,
            titleRequired: false);

        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return null;
        }

        var activeScope = scope.Value;
        var member = await QueryAssignableMemberAsync(request.AssignedMemberId, activeScope.TeamId, cancellationToken);
        if (member is null)
        {
            return null;
        }

        EnsureRoleMatch(member, request.RequiredSpecialization);

        var proposedWeight = Math.Round(workloadCalculator.CalculateWeight(
            request.EstimatedEffortHours,
            request.Complexity,
            request.Priority), 1);

        var overlappingTasks = await QueryOverlappingTeamTasksAsync(activeScope.TeamId, request.StartDate, request.DueDate, request.TaskId, cancellationToken);
        var memberWeightBefore = overlappingTasks
            .Where(task => task.AssignedMemberId == request.AssignedMemberId)
            .Sum(task => task.CalculatedWeight);
        var memberWeightAfter = memberWeightBefore + proposedWeight;
        var memberCapacityBefore = ToCapacityPercentage(memberWeightBefore);
        var memberCapacityAfter = ToCapacityPercentage(memberWeightAfter);
        var teamWeightBefore = overlappingTasks.Sum(task => task.CalculatedWeight);
        var teamMembersCount = await CountAssignableMembersAsync(activeScope.TeamId, cancellationToken);
        var currentTeamLoad = teamMembersCount == 0
            ? 0
            : Math.Round(((teamWeightBefore + proposedWeight) / (teamMembersCount * MemberCapacityThreshold)) * 100, 1);
        var projectedIncrease = Math.Round(memberCapacityAfter - memberCapacityBefore, 1);
        var availability = Math.Max(0, Math.Round(100 - memberCapacityBefore, 1));

        return new TaskPreviewDto(
            proposedWeight,
            ResolveComplexityMultiplier(request.Complexity),
            ResolvePriorityMultiplier(request.Priority),
            currentTeamLoad,
            memberCapacityAfter,
            availability,
            projectedIncrease,
            ResolveCapacityStatus(memberCapacityAfter),
            BuildImpactMessage(member.FullName, request.RequiredSpecialization, projectedIncrease, memberCapacityAfter, request.Status));
    }

    public async Task<TaskDetailsDto?> CreateTaskAsync(
        UpsertTaskDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(
            request.AssignedMemberId,
            request.RequiredSpecialization,
            request.EstimatedEffortHours,
            request.StartDate,
            request.DueDate,
            titleRequired: true,
            request.Title,
            request.Description);

        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return null;
        }

        var activeScope = scope.Value;
        var member = await QueryAssignableMemberAsync(request.AssignedMemberId, activeScope.TeamId, cancellationToken);
        if (member is null)
        {
            return null;
        }

        EnsureRoleMatch(member, request.RequiredSpecialization);

        var now = DateTimeOffset.UtcNow;
        var task = new TaskItem
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            AssignedMemberId = member.Id,
            CreatedById = currentUserId,
            TeamId = activeScope.TeamId,
            Priority = request.Priority,
            Complexity = request.Complexity,
            RequiredSpecialization = request.RequiredSpecialization,
            EstimatedEffortHours = decimal.Round(request.EstimatedEffortHours, 2, MidpointRounding.AwayFromZero),
            StartDate = request.StartDate,
            DueDate = request.DueDate,
            Status = request.Status,
            CalculatedWeight = Math.Round(workloadCalculator.CalculateWeight(request.EstimatedEffortHours, request.Complexity, request.Priority), 1),
            IsAcknowledged = false,
            AcknowledgedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Tasks.Add(task);

        if (request.Status != DomainTaskStatus.New)
        {
            dbContext.TaskStatusHistories.Add(new TaskStatusHistory
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                OldStatus = DomainTaskStatus.New,
                NewStatus = request.Status,
                ChangedById = currentUserId,
                ChangedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return await taskQueryService.GetTaskDetailsAsync(task.Id, currentUserId, true, cancellationToken);
    }

    public async Task<TaskDetailsDto?> UpdateTaskAsync(
        Guid taskId,
        UpsertTaskDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(
            request.AssignedMemberId,
            request.RequiredSpecialization,
            request.EstimatedEffortHours,
            request.StartDate,
            request.DueDate,
            titleRequired: true,
            request.Title,
            request.Description);

        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope is null)
        {
            return null;
        }

        var activeScope = scope.Value;
        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == taskId && item.TeamId == activeScope.TeamId, cancellationToken);
        if (task is null)
        {
            return null;
        }

        var member = await QueryAssignableMemberAsync(request.AssignedMemberId, activeScope.TeamId, cancellationToken);
        if (member is null)
        {
            return null;
        }

        EnsureRoleMatch(member, request.RequiredSpecialization);

        var now = DateTimeOffset.UtcNow;
        var originalAssignedMemberId = task.AssignedMemberId;
        var originalDueDate = task.DueDate;
        var originalEffortHours = task.EstimatedEffortHours;
        var originalStatus = task.Status;

        task.Title = request.Title.Trim();
        task.Description = request.Description.Trim();
        task.AssignedMemberId = member.Id;
        task.Priority = request.Priority;
        task.Complexity = request.Complexity;
        task.RequiredSpecialization = request.RequiredSpecialization;
        task.EstimatedEffortHours = decimal.Round(request.EstimatedEffortHours, 2, MidpointRounding.AwayFromZero);
        task.StartDate = request.StartDate;
        task.DueDate = request.DueDate;
        task.Status = request.Status;
        task.CalculatedWeight = Math.Round(workloadCalculator.CalculateWeight(request.EstimatedEffortHours, request.Complexity, request.Priority), 1);
        task.UpdatedAt = now;

        if (originalAssignedMemberId != task.AssignedMemberId)
        {
            throw new ArgumentException("Assigned member changes now require a reassignment approval flow from the task details page.");
        }

        if (originalDueDate != task.DueDate)
        {
            AddApprovedChangeRequest(task.Id, currentUserId, ChangeRequestType.ChangeDueDate, originalDueDate.ToString("yyyy-MM-dd"), task.DueDate.ToString("yyyy-MM-dd"), now, "Target date updated from task edit.");
        }

        if (originalEffortHours != task.EstimatedEffortHours)
        {
            AddApprovedChangeRequest(task.Id, currentUserId, ChangeRequestType.IncreaseEstimatedEffort, $"{originalEffortHours:0.##}", $"{task.EstimatedEffortHours:0.##}", now, "Effort estimate updated from task edit.");
        }

        if (originalStatus != task.Status)
        {
            dbContext.TaskStatusHistories.Add(new TaskStatusHistory
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                OldStatus = originalStatus,
                NewStatus = task.Status,
                ChangedById = currentUserId,
                ChangedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return await taskQueryService.GetTaskDetailsAsync(task.Id, currentUserId, true, cancellationToken);
    }


    private void AddApprovedChangeRequest(
        Guid taskId,
        string currentUserId,
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
            RequesterId = currentUserId,
            RequestType = requestType,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason,
            Status = ChangeRequestStatus.Approved,
            ReviewedById = currentUserId,
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

    private async Task<TaskFormMemberOptionDto[]> QueryMemberOptionsAsync(
        Guid teamId,
        DateOnly startDate,
        DateOnly endDate,
        Guid? excludedTaskId,
        CancellationToken cancellationToken)
    {
        var members = await (
            from user in dbContext.Users.AsNoTracking()
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId == teamId
            orderby user.FullName
            select new MemberProjection(
                user.Id,
                user.FullName,
                user.Email!,
                SeedTeamDirectory.ResolveJobTitle(user.Email!),
                SeedTeamDirectory.ResolveSpecialization(user.Email!)))
            .ToArrayAsync(cancellationToken);

        var memberIds = members.Select(member => member.Id).ToArray();
        var tasks = memberIds.Length == 0
            ? Array.Empty<TaskItem>()
            : await dbContext.Tasks.AsNoTracking()
                .Where(task =>
                    memberIds.Contains(task.AssignedMemberId) &&
                    task.Status != DomainTaskStatus.Done &&
                    task.StartDate <= endDate &&
                    task.DueDate >= startDate &&
                    (!excludedTaskId.HasValue || task.Id != excludedTaskId.Value))
                .ToArrayAsync(cancellationToken);

        return members
            .Select(member =>
            {
                var memberTasks = tasks.Where(task => task.AssignedMemberId == member.Id).ToArray();
                var totalWeight = memberTasks.Sum(task => task.CalculatedWeight);
                var capacity = ToCapacityPercentage(totalWeight);
                var workloadStatus = workloadCalculator.ResolveStatus(totalWeight);
                return new TaskFormMemberOptionDto(
                    member.Id,
                    member.FullName,
                    member.Email,
                    member.JobTitle,
                    member.Specialization,
                    capacity,
                    Math.Max(0, Math.Round(100 - capacity, 1)),
                    memberTasks.Length,
                    workloadStatus);
            })
            .OrderBy(member => GetWorkloadPriority(member.WorkloadStatus))
            .ThenByDescending(member => member.AvailabilityPercentage)
            .ThenBy(member => member.FullName)
            .ToArray();
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

    private async Task<int> CountAssignableMembersAsync(Guid teamId, CancellationToken cancellationToken)
    {
        return await (
            from user in dbContext.Users.AsNoTracking()
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId == teamId
            select user.Id)
            .CountAsync(cancellationToken);
    }

    private async Task<TaskItem[]> QueryOverlappingTeamTasksAsync(
        Guid teamId,
        DateOnly startDate,
        DateOnly endDate,
        Guid? excludedTaskId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Tasks.AsNoTracking()
            .Where(task =>
                task.TeamId == teamId &&
                task.Status != DomainTaskStatus.Done &&
                task.StartDate <= endDate &&
                task.DueDate >= startDate &&
                (!excludedTaskId.HasValue || task.Id != excludedTaskId.Value))
            .ToArrayAsync(cancellationToken);
    }

    private static (DateOnly StartDate, DateOnly EndDate) ResolveWeekRange(DateOnly today)
    {
        var weekStart = today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7));
        return (weekStart, weekStart.AddDays(6));
    }

    private static void ValidateRequest(
        string assignedMemberId,
        TaskSpecialization requiredSpecialization,
        decimal estimatedEffortHours,
        DateOnly startDate,
        DateOnly dueDate,
        bool titleRequired,
        string? title = null,
        string? description = null)
    {
        if (titleRequired)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new ArgumentException("Task title is required.");
            }

            if (title.Trim().Length > 200)
            {
                throw new ArgumentException("Task title must be 200 characters or fewer.");
            }

            if (string.IsNullOrWhiteSpace(description))
            {
                throw new ArgumentException("Task description is required.");
            }
        }

        if (string.IsNullOrWhiteSpace(assignedMemberId))
        {
            throw new ArgumentException("An assigned member is required.");
        }

        if (requiredSpecialization == TaskSpecialization.Unknown)
        {
            throw new ArgumentException("A required role specialization is required.");
        }

        if (estimatedEffortHours <= 0)
        {
            throw new ArgumentException("Estimated effort hours must be greater than zero.");
        }

        if (dueDate < startDate)
        {
            throw new ArgumentException("Due date must be on or after the start date.");
        }
    }

    private static double ToCapacityPercentage(double totalWeight) =>
        totalWeight <= 0 ? 0 : Math.Round((totalWeight / MemberCapacityThreshold) * 100, 1);

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

    private static string ResolveCapacityStatus(double capacityPercentage) => capacityPercentage switch
    {
        < 70 => "Balanced",
        < 100 => "Near Limit",
        _ => "Over Capacity"
    };

    private static void EnsureRoleMatch(MemberProjection member, TaskSpecialization requiredSpecialization)
    {
        if (member.Specialization != requiredSpecialization)
        {
            throw new ArgumentException(
                $"{member.FullName} is a {member.JobTitle} and does not match the required {SeedTeamDirectory.ResolveSpecializationLabel(requiredSpecialization)} specialization.");
        }
    }

    private static int GetWorkloadPriority(WorkloadStatus status) => status switch
    {
        WorkloadStatus.Available => 0,
        WorkloadStatus.Moderate => 1,
        WorkloadStatus.Overloaded => 2,
        _ => 3
    };

    private static string BuildImpactMessage(
        string memberName,
        TaskSpecialization requiredSpecialization,
        double projectedIncrease,
        double capacityAfter,
        DomainTaskStatus status)
    {
        var normalizedStatus = status switch
        {
            DomainTaskStatus.InProgress => "started immediately",
            DomainTaskStatus.Blocked => "tracked as blocked",
            DomainTaskStatus.Done => "closed immediately",
            _ => "queued as new work"
        };

        return $"{memberName} remains the best {SeedTeamDirectory.ResolveSpecializationLabel(requiredSpecialization)} match here. Workload shifts by {projectedIncrease:0.#}% and will be {capacityAfter:0.#}% after this task is {normalizedStatus}.";
    }

    private sealed record MemberProjection(string Id, string FullName, string Email, string JobTitle, TaskSpecialization Specialization);
}
