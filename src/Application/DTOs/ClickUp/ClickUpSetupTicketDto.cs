namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpSetupTicketDto(
    string ApplicationUserId,
    string ClickUpUserId,
    string AccessToken,
    IReadOnlyList<ClickUpWorkspaceDto> Workspaces);
