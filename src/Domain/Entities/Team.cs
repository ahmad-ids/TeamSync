using IDS.Project.Domain.Common;

namespace IDS.Project.Domain.Entities;

public sealed class Team : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string LeaderId { get; set; } = string.Empty;

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}
