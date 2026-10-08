using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ChangeRequests;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Persistence;
using IDS.Project.Infrastructure.Workload;
using Microsoft.EntityFrameworkCore;

namespace IDS.Project.Infrastructure.ChangeRequests;

public sealed class ChangeRequestService(ApplicationDbContext dbContext) : IChangeRequestService
{
    private const double MemberCapacityThreshold = 25d;

    public async Task<ChangeRequestListResponseDto?> GetChangeRequestsAsync(
        ChangeRequestStatus? status,
        ChangeRequestType? type,
        string? search,
        string? sort,
        string currentUserId,
        bool isMember,
        Guid? taskId = null,
        CancellationToken cancellationToken = default)
    {
        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope.Count == 0)
        {
            return null;
        }

        var normalizedSearch = search?.Trim();
        var items = await QueryChangeRequestsAsync(scope, cancellationToken);
        var scopedItems = items
            .Where(item => !isMember || item.RequesterId == currentUserId)
            .Where(item => !type.HasValue || item.RequestType == type.Value)
            .Where(item => !taskId.HasValue || item.TaskId == taskId.Value)
            .Where(item =>
                string.IsNullOrWhiteSpace(normalizedSearch) ||
                item.TaskTitle.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                item.RequesterName.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var filtered = scopedItems
            .Where(item => !status.HasValue || item.Status == status.Value)
            .ToArray();

        filtered = (sort ?? "newest").Trim().ToLowerInvariant() switch
        {
            "oldest" => filtered.OrderBy(item => item.SubmittedAt).ToArray(),
            "impact" => filtered.OrderByDescending(item => item.ImpactPercentage).ThenByDescending(item => item.SubmittedAt).ToArray(),
            _ => filtered.OrderByDescending(item => item.SubmittedAt).ToArray()
        };

        var metrics = BuildMetrics(scopedItems, scope.MemberCount);
        return new ChangeRequestListResponseDto(metrics, filtered);
    }

    public async Task<ChangeRequestOptionsDto?> GetChangeRequestOptionsAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var task = await dbContext.Tasks.AsNoTracking()
            .Where(item => item.Id == taskId && item.AssignedMemberId == currentUserId)
            .Select(item => new
            {
                item.Id,
                item.TeamId,
                item.AssignedMemberId,
                item.RequiredSpecialization
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (task is null)
        {
            return null;
        }

        var ownerCandidates = await QueryOwnerCandidatesAsync(
            task.TeamId,
            task.RequiredSpecialization,
            task.AssignedMemberId,
            cancellationToken);

        return new ChangeRequestOptionsDto(task.Id, ownerCandidates);
    }

    public async Task<ChangeRequestDto?> CreateChangeRequestAsync(
        CreateChangeRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        ValidateCreateRequest(request.NewValue, request.Reason);

        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.Id, user.TeamId, user.FullName })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser?.TeamId is not Guid teamId)
        {
            return null;
        }

        var isMember = await (
            from userRole in dbContext.UserRoles.AsNoTracking()
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where userRole.UserId == currentUserId && role.Name == RoleNames.Member
            select role.Id)
            .AnyAsync(cancellationToken);

        if (!isMember)
        {
            throw new ArgumentException("Only members can submit change requests.");
        }

        var task = await dbContext.Tasks
            .SingleOrDefaultAsync(item => item.Id == request.TaskId && item.TeamId == teamId && item.AssignedMemberId == currentUserId, cancellationToken);
        if (task is null)
        {
            return null;
        }

        var hasPendingRequest = await dbContext.TaskChangeRequests.AsNoTracking()
            .AnyAsync(item =>
                item.TaskId == request.TaskId &&
                item.RequestType == request.RequestType &&
                item.Status == ChangeRequestStatus.Pending,
                cancellationToken);

        if (hasPendingRequest)
        {
            throw new ArgumentException("A pending request of this type already exists for the task.");
        }

        var normalizedNewValue = await NormalizeNewValueAsync(request.RequestType, request.NewValue, task, teamId, cancellationToken);
        var entity = new TaskChangeRequest
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            RequesterId = currentUserId,
            RequestType = request.RequestType,
            OldValue = ResolveCurrentValue(task, request.RequestType),
            NewValue = normalizedNewValue,
            Reason = request.Reason.Trim(),
            Status = ChangeRequestStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.TaskChangeRequests.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return await GetChangeRequestByIdAsync(entity.Id, scopeTeamIds: [teamId], cancellationToken);
    }

    public async Task<ChangeRequestDto?> ApproveAsync(
        Guid id,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope.Count == 0)
        {
            return null;
        }

        var request = await dbContext.TaskChangeRequests
            .Include(item => item.Task)
            .SingleOrDefaultAsync(item => item.Id == id && item.Task != null && scope.TeamIds.Contains(item.Task.TeamId), cancellationToken);
        if (request?.Task is null)
        {
            return null;
        }

        if (request.Status != ChangeRequestStatus.Pending)
        {
            throw new ArgumentException("Only pending change requests can be approved.");
        }

        await ApplyApprovedChangeAsync(request, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        request.Status = ChangeRequestStatus.Approved;
        request.ReviewedById = currentUserId;
        request.ReviewedAt = now;
        request.UpdatedAt = now;
        request.Task.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetChangeRequestByIdAsync(request.Id, scope.TeamIds, cancellationToken);
    }

    public async Task<ChangeRequestDto?> RejectAsync(
        Guid id,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        var scope = await ResolveScopeAsync(currentUserId, cancellationToken);
        if (scope.Count == 0)
        {
            return null;
        }

        var request = await dbContext.TaskChangeRequests
            .Include(item => item.Task)
            .SingleOrDefaultAsync(item => item.Id == id && item.Task != null && scope.TeamIds.Contains(item.Task.TeamId), cancellationToken);
        if (request is null)
        {
            return null;
        }

        if (request.Status != ChangeRequestStatus.Pending)
        {
            throw new ArgumentException("Only pending change requests can be rejected.");
        }

        var now = DateTimeOffset.UtcNow;
        request.Status = ChangeRequestStatus.Rejected;
        request.ReviewedById = currentUserId;
        request.ReviewedAt = now;
        request.UpdatedAt = now;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetChangeRequestByIdAsync(request.Id, scope.TeamIds, cancellationToken);
    }

    private async Task ApplyApprovedChangeAsync(TaskChangeRequest request, CancellationToken cancellationToken)
    {
        var task = request.Task ?? throw new InvalidOperationException("Task is required to approve a change request.");

        switch (request.RequestType)
        {
            case ChangeRequestType.ChangeOwner:
            {
                var member = await QueryAssignableMemberAsync(request.NewValue, task.TeamId, cancellationToken);
                if (member is null)
                {
                    throw new ArgumentException("The requested assignee is not available in this team.");
                }

                EnsureRoleMatch(member, task.RequiredSpecialization);

                task.AssignedMemberId = member.Id;
                task.IsAcknowledged = false;
                task.AcknowledgedAt = null;
                break;
            }

            case ChangeRequestType.ChangeDueDate:
            {
                if (!DateOnly.TryParse(request.NewValue, out var dueDate))
                {
                    throw new ArgumentException("The requested due date is invalid.");
                }

                if (dueDate < task.StartDate)
                {
                    throw new ArgumentException("Due date must be on or after the start date.");
                }

                task.DueDate = dueDate;
                break;
            }

            case ChangeRequestType.IncreaseEstimatedEffort:
            {
                if (!decimal.TryParse(request.NewValue, out var effortHours) || effortHours <= 0)
                {
                    throw new ArgumentException("The requested effort estimate is invalid.");
                }

                task.EstimatedEffortHours = decimal.Round(effortHours, 2, MidpointRounding.AwayFromZero);
                task.CalculatedWeight = Math.Round(CalculateWeight(task.EstimatedEffortHours, task.Complexity, task.Priority), 1);
                break;
            }
        }
    }

    private async Task<ChangeRequestDto?> GetChangeRequestByIdAsync(
        Guid id,
        IReadOnlyCollection<Guid> scopeTeamIds,
        CancellationToken cancellationToken)
    {
        var items = await QueryChangeRequestsAsync(new ScopeData(scopeTeamIds, 0), cancellationToken, id);
        return items.SingleOrDefault();
    }

    private async Task<ChangeRequestDto[]> QueryChangeRequestsAsync(
        ScopeData scope,
        CancellationToken cancellationToken,
        Guid? requestId = null)
    {
        var requests = await (
            from request in dbContext.TaskChangeRequests.AsNoTracking()
            join task in dbContext.Tasks.AsNoTracking() on request.TaskId equals task.Id
            join requester in dbContext.Users.AsNoTracking() on request.RequesterId equals requester.Id
            join assigned in dbContext.Users.AsNoTracking() on task.AssignedMemberId equals assigned.Id
            join reviewer in dbContext.Users.AsNoTracking() on request.ReviewedById equals reviewer.Id into reviewerJoin
            from reviewer in reviewerJoin.DefaultIfEmpty()
            where scope.TeamIds.Contains(task.TeamId)
                && (!requestId.HasValue || request.Id == requestId.Value)
            select new
            {
                request.Id,
                request.TaskId,
                TaskTitle = task.Title,
                request.RequesterId,
                RequesterName = requester.FullName,
                AssignedMemberName = assigned.FullName,
                request.RequestType,
                request.OldValue,
                request.NewValue,
                request.Reason,
                request.Status,
                SubmittedAt = request.CreatedAt,
                request.ReviewedAt,
                ReviewedByName = reviewer != null ? reviewer.FullName : null,
                task.TeamId,
                task.AssignedMemberId,
                task.CalculatedWeight
            })
            .ToArrayAsync(cancellationToken);

        var allUserIds = requests
            .SelectMany(item => new[] { item.OldValue, item.NewValue })
            .Distinct()
            .ToArray();

        var memberNames = await dbContext.Users.AsNoTracking()
            .Where(user => allUserIds.Contains(user.Id))
            .Select(user => new { user.Id, user.FullName })
            .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        return requests
            .Select(item =>
            {
                var oldValue = ResolveDisplayValue(item.RequestType, item.OldValue, memberNames);
                var newValue = ResolveDisplayValue(item.RequestType, item.NewValue, memberNames);
                return new ChangeRequestDto(
                    item.Id,
                    item.TaskId,
                    item.TaskTitle,
                    item.RequesterId,
                    item.RequesterName,
                    item.AssignedMemberName,
                    item.RequestType,
                    ResolveTypeLabel(item.RequestType),
                    oldValue,
                    newValue,
                    item.Reason,
                    item.SubmittedAt,
                    item.Status,
                    item.ReviewedAt,
                    item.ReviewedByName,
                    Math.Round(CalculateImpactPercentage(item.RequestType, item.OldValue, item.NewValue, item.CalculatedWeight), 1));
            })
            .ToArray();
    }

    private static ChangeRequestMetricsDto BuildMetrics(IReadOnlyCollection<ChangeRequestDto> items, int memberCount)
    {
        var reviewed = items.Where(item => item.ReviewedAt.HasValue).ToArray();
        var pending = items.Where(item => item.Status == ChangeRequestStatus.Pending).ToArray();
        var averageResponseHours = reviewed.Length == 0
            ? 0
            : Math.Round(reviewed.Average(item => (item.ReviewedAt!.Value - item.SubmittedAt).TotalHours), 1);
        var totalImpact = pending.Length == 0
            ? 0
            : Math.Round(pending.Sum(item => item.ImpactPercentage), 1);
        var requestsPerHead = memberCount <= 0 ? 0 : Math.Round((double)pending.Length / memberCount, 1);
        var queueHealth = pending.Length switch
        {
            >= 6 => "Critical",
            >= 3 => "Busy",
            _ => "Balanced"
        };

        return new ChangeRequestMetricsDto(
            items.Count(item => item.Status == ChangeRequestStatus.Pending),
            items.Count(item => item.Status == ChangeRequestStatus.Approved),
            items.Count(item => item.Status == ChangeRequestStatus.Rejected),
            averageResponseHours,
            totalImpact,
            queueHealth,
            $"{requestsPerHead:0.0} requests per member");
    }

    private async Task<string> NormalizeNewValueAsync(
        ChangeRequestType requestType,
        string newValue,
        TaskItem task,
        Guid teamId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(newValue))
        {
            throw new ArgumentException("A requested new value is required.");
        }

        var trimmed = newValue.Trim();

        switch (requestType)
        {
            case ChangeRequestType.ChangeOwner:
            {
                if (trimmed == task.AssignedMemberId)
                {
                    throw new ArgumentException("The requested owner must be different from the current assignee.");
                }

                var member = await QueryAssignableMemberAsync(trimmed, teamId, cancellationToken);
                if (member is null)
                {
                    throw new ArgumentException("The requested assignee is not available in this team.");
                }

                EnsureRoleMatch(member, task.RequiredSpecialization);

                return member.Id;
            }

            case ChangeRequestType.ChangeDueDate:
            {
                if (!DateOnly.TryParse(trimmed, out var dueDate))
                {
                    throw new ArgumentException("The requested due date is invalid.");
                }

                if (dueDate < task.StartDate)
                {
                    throw new ArgumentException("Due date must be on or after the start date.");
                }

                return dueDate.ToString("yyyy-MM-dd");
            }

            case ChangeRequestType.IncreaseEstimatedEffort:
            {
                if (!decimal.TryParse(trimmed, out var effortHours) || effortHours <= 0)
                {
                    throw new ArgumentException("The requested effort estimate is invalid.");
                }

                if (effortHours <= task.EstimatedEffortHours)
                {
                    throw new ArgumentException("Estimated effort must increase for this request type.");
                }

                return decimal.Round(effortHours, 2, MidpointRounding.AwayFromZero).ToString("0.##");
            }

            default:
                throw new ArgumentException("Unsupported change request type.");
        }
    }

    private static string ResolveCurrentValue(TaskItem task, ChangeRequestType requestType) => requestType switch
    {
        ChangeRequestType.ChangeOwner => task.AssignedMemberId,
        ChangeRequestType.ChangeDueDate => task.DueDate.ToString("yyyy-MM-dd"),
        ChangeRequestType.IncreaseEstimatedEffort => task.EstimatedEffortHours.ToString("0.##"),
        _ => string.Empty
    };

    private async Task<ChangeRequestOwnerOptionDto[]> QueryOwnerCandidatesAsync(
        Guid teamId,
        TaskSpecialization requiredSpecialization,
        string currentAssigneeId,
        CancellationToken cancellationToken)
    {
        var members = await (
            from user in dbContext.Users.AsNoTracking()
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId == teamId
                && user.Id != currentAssigneeId
            select new MemberProjection(
                user.Id,
                user.FullName,
                user.Email!,
                SeedTeamDirectory.ResolveJobTitle(user.Email!),
                SeedTeamDirectory.ResolveSpecialization(user.Email!)))
            .ToArrayAsync(cancellationToken);

        var eligibleMembers = members
            .Where(member => member.Specialization == requiredSpecialization)
            .ToArray();

        var memberIds = eligibleMembers.Select(member => member.Id).ToArray();
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var endDate = startDate.AddDays(6);
        var activeTasks = memberIds.Length == 0
            ? Array.Empty<TaskItem>()
            : await dbContext.Tasks.AsNoTracking()
                .Where(task =>
                    memberIds.Contains(task.AssignedMemberId) &&
                    task.Status != IDS.Project.Domain.Enums.TaskStatus.Done &&
                    task.StartDate <= endDate &&
                    task.DueDate >= startDate)
                .ToArrayAsync(cancellationToken);

        return eligibleMembers
            .Select(member =>
            {
                var totalWeight = activeTasks
                    .Where(task => task.AssignedMemberId == member.Id)
                    .Sum(task => task.CalculatedWeight);

                return new ChangeRequestOwnerOptionDto(
                    member.Id,
                    member.FullName,
                    member.JobTitle,
                    WorkloadThresholds.Resolve(totalWeight).ToString());
            })
            .OrderBy(option => option.FullName)
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

    private async Task<ScopeData> ResolveScopeAsync(string currentUserId, CancellationToken cancellationToken)
    {
        var currentUser = await dbContext.Users.AsNoTracking()
            .Where(user => user.Id == currentUserId && user.IsActive)
            .Select(user => new { user.TeamId })
            .SingleOrDefaultAsync(cancellationToken);

        if (currentUser?.TeamId is Guid teamId)
        {
            var memberCount = await CountMembersAsync([teamId], cancellationToken);
            return new ScopeData([teamId], memberCount);
        }

        return new ScopeData([], 0);
    }

    private async Task<int> CountMembersAsync(IReadOnlyCollection<Guid> teamIds, CancellationToken cancellationToken)
    {
        if (teamIds.Count == 0)
        {
            return 0;
        }

        return await (
            from user in dbContext.Users.AsNoTracking()
            join userRole in dbContext.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
            join role in dbContext.Roles.AsNoTracking() on userRole.RoleId equals role.Id
            where role.Name == RoleNames.Member
                && user.IsActive
                && user.TeamId.HasValue
                && teamIds.Contains(user.TeamId.Value)
            select user.Id)
            .CountAsync(cancellationToken);
    }

    private static void ValidateCreateRequest(string? newValue, string? reason)
    {
        if (string.IsNullOrWhiteSpace(newValue))
        {
            throw new ArgumentException("A requested new value is required.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("A reason for the change is required.");
        }

        if (reason.Trim().Length > 1000)
        {
            throw new ArgumentException("Reason must be 1000 characters or fewer.");
        }
    }

    private static string ResolveDisplayValue(ChangeRequestType requestType, string value, IReadOnlyDictionary<string, string> memberNames) => requestType switch
    {
        ChangeRequestType.ChangeOwner when memberNames.TryGetValue(value, out var fullName) => fullName,
        ChangeRequestType.ChangeDueDate when DateOnly.TryParse(value, out var date) => date.ToString("MMM dd, yyyy"),
        ChangeRequestType.IncreaseEstimatedEffort when decimal.TryParse(value, out var hours) => $"{hours:0.##}h",
        _ => value
    };

    private static string ResolveTypeLabel(ChangeRequestType requestType) => requestType switch
    {
        ChangeRequestType.ChangeOwner => "Change Owner",
        ChangeRequestType.ChangeDueDate => "Change Due Date",
        ChangeRequestType.IncreaseEstimatedEffort => "Increase Effort",
        _ => "Task Change"
    };

    private static double CalculateImpactPercentage(ChangeRequestType requestType, string oldValue, string newValue, double taskWeight) => requestType switch
    {
        ChangeRequestType.ChangeOwner => Math.Round((taskWeight / MemberCapacityThreshold) * 100, 1),
        ChangeRequestType.ChangeDueDate when DateOnly.TryParse(oldValue, out var oldDate) && DateOnly.TryParse(newValue, out var newDate)
            => Math.Round((Math.Abs(newDate.DayNumber - oldDate.DayNumber) / 14d) * 100, 1),
        ChangeRequestType.IncreaseEstimatedEffort when decimal.TryParse(oldValue, out var oldHours) && decimal.TryParse(newValue, out var newHours)
            => Math.Round((double)Math.Max(0, newHours - oldHours) * 1.8d, 1),
        _ => 0
    };

    private static double CalculateWeight(decimal effortHours, TaskComplexity complexity, TaskPriority priority)
    {
        var complexityMultiplier = complexity switch
        {
            TaskComplexity.Simple => 1m,
            TaskComplexity.Medium => 1.5m,
            TaskComplexity.Complex => 2m,
            _ => 1m
        };

        var priorityMultiplier = priority switch
        {
            TaskPriority.Low => 1m,
            TaskPriority.Medium => 1.2m,
            TaskPriority.High => 1.5m,
            TaskPriority.Critical => 2m,
            _ => 1m
        };

        return (double)(effortHours * complexityMultiplier * priorityMultiplier);
    }

    private static void EnsureRoleMatch(MemberProjection member, TaskSpecialization requiredSpecialization)
    {
        if (member.Specialization != requiredSpecialization)
        {
            throw new ArgumentException(
                $"{member.FullName} is a {member.JobTitle} and does not match the required {SeedTeamDirectory.ResolveSpecializationLabel(requiredSpecialization)} specialization.");
        }
    }

    private sealed record MemberProjection(string Id, string FullName, string Email, string JobTitle, TaskSpecialization Specialization);

    private sealed record ScopeData(IReadOnlyCollection<Guid> TeamIds, int MemberCount)
    {
        public int Count => TeamIds.Count;
    }
}
