namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskCapacityPointDto(
    string DayLabel,
    double CapacityPercentage,
    bool IsCurrentDay);
