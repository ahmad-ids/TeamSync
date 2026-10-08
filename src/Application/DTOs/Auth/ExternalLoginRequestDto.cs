namespace IDS.Project.Application.DTOs.Auth;

public sealed record ExternalLoginRequestDto(
    string Provider,
    string ProviderUserId,
    string? Email,
    string? FullName);
