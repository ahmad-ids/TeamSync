using IDS.Project.Domain.Enums;

namespace IDS.Project.Domain.Constants;

public static class WorkloadThresholds
{
    public static WorkloadStatus Resolve(double totalWeight) =>
        totalWeight switch
        {
            <= 15 => WorkloadStatus.Available,
            <= 25 => WorkloadStatus.Moderate,
            _ => WorkloadStatus.Overloaded
        };
}
