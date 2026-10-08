namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpConnectionDetailsDto(
    string WorkspaceId,
    string WorkspaceName,
    string ProtectedAccessToken,
    string ClickUpUserId,
    bool IsActive);
