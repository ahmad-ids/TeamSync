namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record ChangeRequestListResponseDto(
    ChangeRequestMetricsDto Metrics,
    ChangeRequestDto[] Requests);
