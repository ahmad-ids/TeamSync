using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.Abstractions.Services;

public interface IWorkloadCalculator
{
    double CalculateWeight(decimal effortHours, TaskComplexity complexity, TaskPriority priority);

    WorkloadStatus ResolveStatus(double totalWeight);
}
