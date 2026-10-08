namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskPreviewDto(
    double CalculatedWeight,
    double ComplexityMultiplier,
    double PriorityMultiplier,
    double CurrentTeamLoadPercentage,
    double CapacityUtilizationPercentage,
    double AvailabilityPercentage,
    double ProjectedIncreasePercentage,
    string CapacityStatus,
    string ImpactMessage);
