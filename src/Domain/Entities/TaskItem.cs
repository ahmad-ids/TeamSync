using IDS.Project.Domain.Common;
using IDS.Project.Domain.Enums;
using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Domain.Entities;

public sealed class TaskItem : BaseEntity
{
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? ExternalId { get; set; }

    public string? ExternalSource { get; set; }

    public string AssignedMemberId { get; set; } = string.Empty;

    public string CreatedById { get; set; } = string.Empty;

    public Guid TeamId { get; set; }

    public TaskPriority Priority { get; set; }

    public TaskComplexity Complexity { get; set; }

    public TaskSpecialization RequiredSpecialization { get; set; }

    public decimal EstimatedEffortHours { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly DueDate { get; set; }

    public DomainTaskStatus Status { get; set; }

    public double CalculatedWeight { get; set; }

    public bool IsAcknowledged { get; set; }

    public DateTimeOffset? AcknowledgedAt { get; set; }

    public Team? Team { get; set; }

    public ICollection<TaskStatusHistory> StatusHistory { get; set; } = new List<TaskStatusHistory>();

    public ICollection<TaskChangeRequest> ChangeRequests { get; set; } = new List<TaskChangeRequest>();

    public ICollection<TaskReassignmentRequest> ReassignmentRequests { get; set; } = new List<TaskReassignmentRequest>();
}
