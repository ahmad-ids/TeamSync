using IDS.Project.Application.DTOs.Auth;

namespace IDS.Project.Application.Abstractions.Services;

public interface IAuthService
{
    Task<LoginResultDto> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);
    Task<LoginResultDto> LoginWithExternalProviderAsync(ExternalLoginRequestDto request, CancellationToken cancellationToken = default);
    Task<LoginResultDto> LoginWithClickUpAsync(string email, CancellationToken cancellationToken = default);
    Task<RegisterResultDto> RegisterAsync(RegisterRequestDto request, CancellationToken cancellationToken = default);
    Task<CurrentUserResponseDto?> GetCurrentUserAsync(string userId, CancellationToken cancellationToken = default);
}
