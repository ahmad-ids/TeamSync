namespace IDS.Project.Application.DTOs.Auth;

public sealed record CurrentUserResponseDto(string UserId, string FullName, string Email, string Role);
