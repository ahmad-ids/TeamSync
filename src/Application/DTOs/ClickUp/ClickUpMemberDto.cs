namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpMemberDto(
    string Id,
    string FullName,
    string Email,
    bool IsActive,
    string? ProfilePictureUrl,
    string? Role = null);
