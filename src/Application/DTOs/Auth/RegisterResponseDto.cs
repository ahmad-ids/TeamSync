namespace IDS.Project.Application.DTOs.Auth;

public sealed record RegisterResponseDto(string UserId, string FullName, string Email, string Role);
