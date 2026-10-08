using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Infrastructure.Workload;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Persistence;

public sealed class ApplicationDbContextSeed(
    ApplicationDbContext dbContext,
    RoleManager<IdentityRole> roleManager,
    UserManager<ApplicationUser> userManager,
    IWorkloadCalculator workloadCalculator)
{
    private static readonly Guid TeamId = Guid.Parse("f53c4b13-9697-41cb-ae5d-6e92692ffb31");
    private const string LeaderEmail = "leader@ids.local";
    private static readonly SeedMemberProfile[] MemberProfiles = SeedMemberProfiles.All;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);
        await dbContext.EnsureTaskReassignmentRequestsSchemaAsync(cancellationToken);

        await SeedRolesAsync();
        await SeedTeamAsync(cancellationToken);
        await SeedUsersAsync(cancellationToken);
        await SeedMultiplierSettingsAsync(cancellationToken);
        await SeedTasksAsync(cancellationToken);
        await SeedTaskActivityAsync(cancellationToken);
    }

    private async Task SeedRolesAsync()
    {
        foreach (var roleName in RoleNames.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }
    }

    private async Task SeedTeamAsync(CancellationToken cancellationToken)
    {
        var team = await dbContext.Teams.SingleOrDefaultAsync(x => x.Id == TeamId, cancellationToken);
        if (team is null)
        {
            dbContext.Teams.Add(new Team
            {
                Id = TeamId,
                Name = "Platform Delivery Team",
                LeaderId = "pending-seed"
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var requiresUpdate = false;
        if (team.Name != "Platform Delivery Team")
        {
            team.Name = "Platform Delivery Team";
            requiresUpdate = true;
        }

        if (team.LeaderId != "pending-seed")
        {
            team.LeaderId = "pending-seed";
            requiresUpdate = true;
        }

        if (requiresUpdate)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task SeedUsersAsync(CancellationToken cancellationToken)
    {
        var leader = await EnsureUserAsync(LeaderEmail, "Team Leader", RoleNames.TeamLeader, TeamId);

        foreach (var profile in MemberProfiles)
        {
            await EnsureUserAsync(profile.Email, profile.FullName, RoleNames.Member, TeamId);
        }

        await DeactivateUnusedSeedMembersAsync(cancellationToken);

        var team = await dbContext.Teams.FirstAsync(x => x.Id == TeamId);
        if (team.LeaderId != leader.Id)
        {
            team.LeaderId = leader.Id;
            await dbContext.SaveChangesAsync();
        }

    }

    private async Task DeactivateUnusedSeedMembersAsync(CancellationToken cancellationToken)
    {
        var activeSeedEmails = MemberProfiles
            .Select(profile => profile.Email)
            .Append(LeaderEmail)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var usersToDeactivate = await dbContext.Users
            .Where(user =>
                user.IsActive &&
                user.TeamId == TeamId &&
                !activeSeedEmails.Contains(user.Email!))
            .ToListAsync(cancellationToken);

        foreach (var user in usersToDeactivate)
        {
            user.IsActive = false;
            user.UpdatedAt = DateTimeOffset.UtcNow;
        }

        if (usersToDeactivate.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<ApplicationUser> EnsureUserAsync(string email, string fullName, string role, Guid? teamId)
    {
        var user = await userManager.FindByEmailAsync(email);
        var requiresUpdate = false;

        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FullName = fullName,
                EmailConfirmed = true,
                TeamId = teamId,
                IsActive = true
            };

            var createResult = await userManager.CreateAsync(user, "Passw0rd!");
            if (!createResult.Succeeded)
            {
                var errors = string.Join("; ", createResult.Errors.Select(x => x.Description));
                throw new InvalidOperationException($"Failed to create seed user {email}: {errors}");
            }
        }
        else
        {
            if (user.FullName != fullName)
            {
                user.FullName = fullName;
                requiresUpdate = true;
            }

            if (user.TeamId != teamId)
            {
                user.TeamId = teamId;
                requiresUpdate = true;
            }

            if (!user.IsActive)
            {
                user.IsActive = true;
                requiresUpdate = true;
            }
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            await userManager.AddToRoleAsync(user, role);
        }

        if (requiresUpdate)
        {
            user.UpdatedAt = DateTimeOffset.UtcNow;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var errors = string.Join("; ", updateResult.Errors.Select(x => x.Description));
                throw new InvalidOperationException($"Failed to update seed user {email}: {errors}");
            }
        }

        return user;
    }

    private async Task SeedMultiplierSettingsAsync(CancellationToken cancellationToken)
    {
        if (await dbContext.WeightMultiplierSettings.AnyAsync(cancellationToken))
        {
            return;
        }

        dbContext.WeightMultiplierSettings.AddRange(
            new WeightMultiplierSetting { Category = "Complexity", Key = "Simple", Value = 1.0m },
            new WeightMultiplierSetting { Category = "Complexity", Key = "Medium", Value = 1.5m },
            new WeightMultiplierSetting { Category = "Complexity", Key = "Complex", Value = 2.0m },
            new WeightMultiplierSetting { Category = "Priority", Key = "Low", Value = 1.0m },
            new WeightMultiplierSetting { Category = "Priority", Key = "Medium", Value = 1.2m },
            new WeightMultiplierSetting { Category = "Priority", Key = "High", Value = 1.5m },
            new WeightMultiplierSetting { Category = "Priority", Key = "Critical", Value = 2.0m });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedTasksAsync(CancellationToken cancellationToken)
    {
        var leader = await userManager.FindByEmailAsync(LeaderEmail)
            ?? throw new InvalidOperationException("Seed leader user was not found.");
        var seedMemberEmails = MemberProfiles
            .Select(profile => profile.Email)
            .ToArray();
        var seedMemberIds = await dbContext.Users.AsNoTracking()
            .Where(user =>
                user.IsActive &&
                user.TeamId == TeamId &&
                seedMemberEmails.Contains(user.Email!))
            .Select(user => user.Id)
            .ToArrayAsync(cancellationToken);

        var existingSeedTaskIds = await dbContext.Tasks
            .Where(task =>
                task.TeamId == TeamId &&
                seedMemberIds.Contains(task.AssignedMemberId))
            .Select(task => task.Id)
            .ToArrayAsync(cancellationToken);

        if (existingSeedTaskIds.Length > 0)
        {
            var existingSeedTasks = await dbContext.Tasks
                .Where(task => existingSeedTaskIds.Contains(task.Id))
                .ToListAsync(cancellationToken);

            dbContext.Tasks.RemoveRange(existingSeedTasks);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var thisWeekStart = ResolveWeekStart(DateOnly.FromDateTime(DateTime.UtcNow));
        var nextWeekStart = thisWeekStart.AddDays(7);
        var createdTasks = new List<TaskItem>();

        foreach (var profile in MemberProfiles)
        {
            var member = await userManager.FindByEmailAsync(profile.Email)
                ?? throw new InvalidOperationException($"Seed member user was not found for {profile.Email}.");

            createdTasks.AddRange(profile.Email == "marcus.chen@ids.local"
                ? MarcusChenTaskSeed.Create(member.Id, leader.Id, TeamId, thisWeekStart, workloadCalculator)
                : CreateTasksForWeek(
                    member.Id,
                    leader.Id,
                    thisWeekStart,
                    profile));

            if (profile.Email == "marcus.chen@ids.local")
            {
                continue;
            }

            if (profile.ThisWeekTaskCount <= 0 || profile.ThisWeekTotalHours <= 0)
            {
                continue;
            }

            var nextWeekCount = Math.Max(1, profile.ThisWeekTaskCount / 2);
            var nextWeekHours = Math.Max(3m, Math.Round(profile.ThisWeekTotalHours * 0.55m, 1));
            createdTasks.AddRange(CreateTasksForWeek(
                member.Id,
                leader.Id,
                nextWeekStart,
                profile with
                {
                    ThisWeekTaskCount = nextWeekCount,
                    ThisWeekTotalHours = nextWeekHours,
                    Priority = profile.Priority is TaskPriority.High or TaskPriority.Critical ? TaskPriority.Medium : profile.Priority,
                    Complexity = profile.Complexity is TaskComplexity.Complex ? TaskComplexity.Medium : profile.Complexity
                }));
        }

        dbContext.Tasks.AddRange(createdTasks);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedTaskActivityAsync(CancellationToken cancellationToken)
    {
        if (!await dbContext.Tasks.AnyAsync(cancellationToken))
        {
            return;
        }

        var leader = await userManager.FindByEmailAsync(LeaderEmail)
            ?? throw new InvalidOperationException("Seed leader user was not found.");
        var seedTaskIds = await dbContext.Tasks.AsNoTracking()
            .Where(task =>
                task.TeamId == TeamId &&
                task.CreatedById == leader.Id)
            .Select(task => task.Id)
            .ToArrayAsync(cancellationToken);

        if (seedTaskIds.Length == 0)
        {
            return;
        }

        var existingHistoryTaskIds = await dbContext.TaskStatusHistories.AsNoTracking()
            .Where(history => seedTaskIds.Contains(history.TaskId))
            .Select(history => history.TaskId)
            .Distinct()
            .ToArrayAsync(cancellationToken);

        var missingHistoryTasks = await dbContext.Tasks.AsNoTracking()
            .Where(task => seedTaskIds.Contains(task.Id) && !existingHistoryTaskIds.Contains(task.Id))
            .OrderBy(task => task.Title)
            .ToArrayAsync(cancellationToken);

        if (missingHistoryTasks.Length > 0)
        {
            var statusHistory = missingHistoryTasks
                .Select(task => new TaskStatusHistory
                {
                    Id = Guid.NewGuid(),
                    TaskId = task.Id,
                    OldStatus = DomainTaskStatus.New,
                    NewStatus = task.Status,
                    ChangedById = leader.Id,
                    ChangedAt = task.UpdatedAt.AddHours(-6),
                    CreatedAt = task.UpdatedAt.AddHours(-6),
                    UpdatedAt = task.UpdatedAt.AddHours(-6),
                })
                .ToArray();

            dbContext.TaskStatusHistories.AddRange(statusHistory);
        }

        var existingChangeRequestTaskIds = await dbContext.TaskChangeRequests.AsNoTracking()
            .Where(request => seedTaskIds.Contains(request.TaskId))
            .Select(request => request.TaskId)
            .Distinct()
            .ToArrayAsync(cancellationToken);

        if (existingChangeRequestTaskIds.Length == 0)
        {
            var sampleTasks = await dbContext.Tasks.AsNoTracking()
                .Where(task => seedTaskIds.Contains(task.Id))
                .OrderByDescending(task => task.CalculatedWeight)
                .Take(6)
                .ToArrayAsync(cancellationToken);

            var requests = sampleTasks.Select((task, index) => new TaskChangeRequest
            {
                Id = Guid.NewGuid(),
                TaskId = task.Id,
                RequesterId = task.AssignedMemberId,
                RequestType = index % 2 == 0 ? ChangeRequestType.IncreaseEstimatedEffort : ChangeRequestType.ChangeDueDate,
                OldValue = index % 2 == 0 ? $"{task.EstimatedEffortHours}" : task.DueDate.ToString("yyyy-MM-dd"),
                NewValue = index % 2 == 0 ? $"{task.EstimatedEffortHours + 2}" : task.DueDate.AddDays(2).ToString("yyyy-MM-dd"),
                Reason = index % 2 == 0
                    ? "Additional implementation work was identified during delivery."
                    : "Dependency completion moved the planned handoff.",
                Status = index % 3 == 0 ? ChangeRequestStatus.Pending : ChangeRequestStatus.Approved,
                ReviewedById = index % 3 == 0 ? null : task.CreatedById,
                ReviewedAt = index % 3 == 0 ? null : task.UpdatedAt.AddHours(-2),
                CreatedAt = task.UpdatedAt.AddHours(-4),
                UpdatedAt = task.UpdatedAt.AddHours(-2),
            });

            dbContext.TaskChangeRequests.AddRange(requests);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private IEnumerable<TaskItem> CreateTasksForWeek(
        string assignedMemberId,
        string leaderId,
        DateOnly weekStart,
        SeedMemberProfile profile)
    {
        if (profile.ThisWeekTaskCount <= 0 || profile.ThisWeekTotalHours <= 0)
        {
            return Array.Empty<TaskItem>();
        }

        var tasks = new List<TaskItem>();
        var baseHours = decimal.Round(profile.ThisWeekTotalHours / profile.ThisWeekTaskCount, 2, MidpointRounding.AwayFromZero);
        var remainingHours = profile.ThisWeekTotalHours;
        var jobTitle = SeedTeamDirectory.ResolveJobTitle(profile.Email);
        var specialization = SeedTeamDirectory.ResolveSpecialization(profile.Email);

        for (var index = 0; index < profile.ThisWeekTaskCount; index++)
        {
            var effortHours = index == profile.ThisWeekTaskCount - 1
                ? remainingHours
                : Math.Max(1m, baseHours + GetHourAdjustment(index));

            remainingHours -= effortHours;
            var startDate = weekStart.AddDays(index % 4);
            var dueDate = startDate.AddDays(1 + (index % 3));

            tasks.Add(new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = ResolveTaskTitle(profile, index),
                Description = $"{ResolveTaskDescription(profile, index)} Assigned to {jobTitle.ToLowerInvariant()} {profile.FullName}.",
                AssignedMemberId = assignedMemberId,
                CreatedById = leaderId,
                TeamId = TeamId,
                Priority = ResolvePriority(profile.Priority, index),
                Complexity = ResolveComplexity(profile.Complexity, index),
                RequiredSpecialization = specialization,
                EstimatedEffortHours = effortHours,
                StartDate = startDate,
                DueDate = dueDate,
                Status = ResolveStatus(index),
                CalculatedWeight = Math.Round(workloadCalculator.CalculateWeight(
                    effortHours,
                    ResolveComplexity(profile.Complexity, index),
                    ResolvePriority(profile.Priority, index)), 1),
                IsAcknowledged = index % 2 == 0,
                AcknowledgedAt = index % 2 == 0 ? DateTimeOffset.UtcNow.AddDays(-index) : null,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            });
        }

        return tasks;
    }

    private static DateOnly ResolveWeekStart(DateOnly today) =>
        today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7));

    private static decimal GetHourAdjustment(int index) => index switch
    {
        0 => 1.0m,
        1 => 0.5m,
        2 => -0.5m,
        3 => -1.0m,
        _ => 0
    };

    private static DomainTaskStatus ResolveStatus(int index) => (index % 5) switch
    {
        0 => DomainTaskStatus.New,
        1 => DomainTaskStatus.InProgress,
        2 => DomainTaskStatus.Blocked,
        3 => DomainTaskStatus.Done,
        _ => DomainTaskStatus.New
    };

    private static TaskPriority ResolvePriority(TaskPriority basePriority, int index) => (index % 4) switch
    {
        1 => LowerPriority(basePriority),
        2 => RaisePriority(basePriority),
        _ => basePriority
    };

    private static TaskComplexity ResolveComplexity(TaskComplexity baseComplexity, int index) => (index % 3) switch
    {
        1 => LowerComplexity(baseComplexity),
        2 => RaiseComplexity(baseComplexity),
        _ => baseComplexity
    };

    private static TaskPriority LowerPriority(TaskPriority priority) => priority switch
    {
        TaskPriority.Critical => TaskPriority.High,
        TaskPriority.High => TaskPriority.Medium,
        TaskPriority.Medium => TaskPriority.Low,
        _ => TaskPriority.Low
    };

    private static TaskPriority RaisePriority(TaskPriority priority) => priority switch
    {
        TaskPriority.Low => TaskPriority.Medium,
        TaskPriority.Medium => TaskPriority.High,
        TaskPriority.High => TaskPriority.Critical,
        _ => TaskPriority.Critical
    };

    private static TaskComplexity LowerComplexity(TaskComplexity complexity) => complexity switch
    {
        TaskComplexity.Complex => TaskComplexity.Medium,
        TaskComplexity.Medium => TaskComplexity.Simple,
        _ => TaskComplexity.Simple
    };

    private static TaskComplexity RaiseComplexity(TaskComplexity complexity) => complexity switch
    {
        TaskComplexity.Simple => TaskComplexity.Medium,
        TaskComplexity.Medium => TaskComplexity.Complex,
        _ => TaskComplexity.Complex
    };

    private static string ResolveTaskTitle(SeedMemberProfile profile, int index) =>
        index < profile.TaskTitles.Length
            ? profile.TaskTitles[index]
            : $"{profile.TaskTitles[^1]} - Part {index + 1}";

    private static string ResolveTaskDescription(SeedMemberProfile profile, int index) =>
        index < profile.TaskDescriptions.Length
            ? profile.TaskDescriptions[index]
            : profile.TaskDescriptions[^1];
}
