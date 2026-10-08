using IDS.Project.Domain.Common;
using IDS.Project.Domain.Enums;

namespace IDS.Project.Domain.Entities;

public sealed class TaskReassignmentRequest : BaseEntity
{
    public Guid TaskId { get; set; }

    public string RequestedById { get; set; } = string.Empty;

    public string CurrentAssigneeId { get; set; } = string.Empty;

    public string ProposedAssigneeId { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public ChangeRequestStatus Status { get; set; } = ChangeRequestStatus.Pending;

    public ChangeRequestStatus CurrentAssigneeDecision { get; set; } = ChangeRequestStatus.Pending;

    public DateTimeOffset? CurrentAssigneeRespondedAt { get; set; }

    public ChangeRequestStatus ProposedAssigneeDecision { get; set; } = ChangeRequestStatus.Pending;

    public DateTimeOffset? ProposedAssigneeRespondedAt { get; set; }

    public string? FinalizedById { get; set; }

    public DateTimeOffset? FinalizedAt { get; set; }

    public TaskItem? Task { get; set; }
}
