namespace IDS.Project.Application.DTOs.Auth;

public sealed record LoginResponseDto(string Token, DateTimeOffset ExpiresAt, string Role, string Email);
