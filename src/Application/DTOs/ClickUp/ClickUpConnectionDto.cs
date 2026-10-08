namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpConnectionDto(
    string WorkspaceId,
    string WorkspaceName,
    bool IsActive);
