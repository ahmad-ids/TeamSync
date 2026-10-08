using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.Services;

public sealed class WorkloadCalculator : IWorkloadCalculator
{
    private static readonly IReadOnlyDictionary<TaskComplexity, double> ComplexityMultipliers = new Dictionary<TaskComplexity, double>
    {
        [TaskComplexity.Simple] = 1.0,
        [TaskComplexity.Medium] = 1.5,
        [TaskComplexity.Complex] = 2.0
    };

    private static readonly IReadOnlyDictionary<TaskPriority, double> PriorityMultipliers = new Dictionary<TaskPriority, double>
    {
        [TaskPriority.Low] = 1.0,
        [TaskPriority.Medium] = 1.2,
        [TaskPriority.High] = 1.5,
        [TaskPriority.Critical] = 2.0
    };

    public double CalculateWeight(decimal effortHours, TaskComplexity complexity, TaskPriority priority) =>
        Convert.ToDouble(effortHours) * ComplexityMultipliers[complexity] * PriorityMultipliers[priority];

    public WorkloadStatus ResolveStatus(double totalWeight) => WorkloadThresholds.Resolve(totalWeight);
}
