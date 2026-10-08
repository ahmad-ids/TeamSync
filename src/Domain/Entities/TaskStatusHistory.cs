using IDS.Project.Domain.Common;
using IDS.Project.Domain.Enums;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Domain.Entities;

public sealed class TaskStatusHistory : BaseEntity
{
    public Guid TaskId { get; set; }

    public DomainTaskStatus OldStatus { get; set; }

    public DomainTaskStatus NewStatus { get; set; }

    public string ChangedById { get; set; } = string.Empty;

    public DateTimeOffset ChangedAt { get; set; }

    public TaskItem? Task { get; set; }
}
