namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpListDto(
    string Id,
    string Name,
    string SpaceId,
    string? FolderId);
