namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record ChangeRequestMetricsDto(
    int PendingCount,
    int ApprovedCount,
    int RejectedCount,
    double AverageResponseHours,
    double TotalImpactPercentage,
    string QueueHealth,
    string QueueHealthDetail);
