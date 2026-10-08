using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskReassignmentRequestDto(
    Guid Id,
    string RequestedById,
    string RequestedByName,
    string CurrentAssigneeId,
    string CurrentAssigneeName,
    string ProposedAssigneeId,
    string ProposedAssigneeName,
    string ProposedAssigneeEmail,
    string ProposedAssigneeJobTitle,
    string Reason,
    ChangeRequestStatus Status,
    ChangeRequestStatus CurrentAssigneeDecision,
    DateTimeOffset? CurrentAssigneeRespondedAt,
    ChangeRequestStatus ProposedAssigneeDecision,
    DateTimeOffset? ProposedAssigneeRespondedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? FinalizedAt);
