namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record ChangeRequestOwnerOptionDto(
    string MemberId,
    string FullName,
    string JobTitle,
    string WorkloadStatus);
