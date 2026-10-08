using IDS.Project.Domain.Common;
using IDS.Project.Domain.Enums;

namespace IDS.Project.Domain.Entities;

public sealed class TaskChangeRequest : BaseEntity
{
    public Guid TaskId { get; set; }

    public string RequesterId { get; set; } = string.Empty;

    public ChangeRequestType RequestType { get; set; }

    public string OldValue { get; set; } = string.Empty;

    public string NewValue { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public ChangeRequestStatus Status { get; set; } = ChangeRequestStatus.Pending;

    public string? ReviewedById { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public TaskItem? Task { get; set; }
}
