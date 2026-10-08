namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record ChangeRequestOptionsDto(
    Guid TaskId,
    IReadOnlyCollection<ChangeRequestOwnerOptionDto> OwnerCandidates);
