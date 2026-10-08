using IDS.Project.Domain.Common;

namespace IDS.Project.Domain.Entities;

public sealed class ClickUpConnection : BaseEntity
{
    public string ApplicationUserId { get; set; } = string.Empty;

    public Guid? TeamId { get; set; }

    public string ClickUpUserId { get; set; } = string.Empty;

    public string WorkspaceId { get; set; } = string.Empty;

    public string WorkspaceName { get; set; } = string.Empty;

    public string ProtectedAccessToken { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
