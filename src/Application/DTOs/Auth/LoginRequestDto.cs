namespace IDS.Project.Application.DTOs.Auth;

public sealed record LoginRequestDto(string Email, string Password, bool RememberMe);
