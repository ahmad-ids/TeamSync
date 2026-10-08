namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpAssigneeSyncModel(
    string ClickUpUserId,
    string Name,
    string Email);
