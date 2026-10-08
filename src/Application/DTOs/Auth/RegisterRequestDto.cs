namespace IDS.Project.Application.DTOs.Auth;

public sealed record RegisterRequestDto(string FullName, string Email, string Password);
