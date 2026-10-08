using IDS.Project.Domain.Entities;
using IDS.Project.Domain.Enums;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Infrastructure.Workload;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Infrastructure.Persistence;

internal static class MarcusChenTaskSeed
{
    public static IEnumerable<TaskItem> Create(string assignedMemberId, string leaderId, Guid teamId, DateOnly weekStart, IWorkloadCalculator workloadCalculator)
    {
        var titles = new[]
        {
            "Harden Google OAuth callback recovery",
            "Add auth sign-in retry and error states",
            "Wire role-aware redirects after sign-in",
            "Polish social login loading interactions"
        };

        var descriptions = new[]
        {
            "Finish the React callback flow for Google sign-in, including token exchange recovery and protected route fallback handling.",
            "Add resilient retry and recovery states for frontend auth failures so users can safely return to the sign-in flow.",
            "Update the router and auth provider so role-based destinations resolve cleanly after successful external sign-in.",
            "Polish the login and signup social sign-in interactions so loading and failure states stay clear during auth hardening work."
        };

        var statuses = new[]
        {
            DomainTaskStatus.New,
            DomainTaskStatus.InProgress,
            DomainTaskStatus.Blocked,
            DomainTaskStatus.Done
        };

        var priorities = new[]
        {
            TaskPriority.High,
            TaskPriority.Medium,
            TaskPriority.Critical,
            TaskPriority.High
        };

        var complexities = new[]
        {
            TaskComplexity.Complex,
            TaskComplexity.Medium,
            TaskComplexity.Complex,
            TaskComplexity.Simple
        };

        var effortHours = new[] { 5.5m, 4.5m, 4.0m, 4.0m };

        return Enumerable.Range(0, 4).Select(index =>
        {
            var startDate = weekStart.AddDays(index);
            var dueDate = startDate.AddDays(index == 3 ? 2 : 1);
            var priority = priorities[index];
            var complexity = complexities[index];
            var hours = effortHours[index];

            return new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = titles[index],
                Description = $"{descriptions[index]} Assigned to senior frontend engineer Marcus Chen.",
                AssignedMemberId = assignedMemberId,
                CreatedById = leaderId,
                TeamId = teamId,
                Priority = priority,
                Complexity = complexity,
                RequiredSpecialization = TaskSpecialization.Frontend,
                EstimatedEffortHours = hours,
                StartDate = startDate,
                DueDate = dueDate,
                Status = statuses[index],
                CalculatedWeight = Math.Round(workloadCalculator.CalculateWeight(hours, complexity, priority), 1),
                IsAcknowledged = index != 1,
                AcknowledgedAt = index == 1 ? null : DateTimeOffset.UtcNow.AddDays(-(index + 1)),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            };
        });
    }
}
