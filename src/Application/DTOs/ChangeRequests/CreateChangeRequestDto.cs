using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.ChangeRequests;

public sealed record CreateChangeRequestDto(
    Guid TaskId,
    ChangeRequestType RequestType,
    string NewValue,
    string Reason);
