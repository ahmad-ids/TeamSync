using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Auth;
using IDS.Project.Domain.Constants;
using IDS.Project.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Identity;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class AuthService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IConfiguration configuration,
    JwtService jwtService) : IAuthService
{
    private const int RememberMeLifetimeDays = 30;

    public async Task<LoginResultDto> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByEmailAsync(request.Email);

        if (user is null)
        {
            return LoginResultDto.AccountNotFound("This account does not exist. Please sign up.");
        }

        if (!user.IsActive)
        {
            return LoginResultDto.InvalidCredentials("This account is inactive. Contact an administrator.");
        }

        var passwordResult = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!passwordResult.Succeeded)
        {
            return LoginResultDto.InvalidCredentials("Incorrect email or password.");
        }

        return await CreateSessionAsync(user, request.Email, request.RememberMe);
    }

    public async Task<LoginResultDto> LoginWithExternalProviderAsync(ExternalLoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var provider = request.Provider.Trim();
        var providerUserId = request.ProviderUserId.Trim();
        var normalizedEmail = request.Email?.Trim();
        var normalizedFullName = request.FullName?.Trim();
        var userWasCreated = false;

        if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(providerUserId))
        {
            return LoginResultDto.ExternalAuthFailed("External authentication data is invalid.");
        }

        var loginInfo = new UserLoginInfo(provider, providerUserId, provider);
        var user = await userManager.FindByLoginAsync(provider, providerUserId);

        if (user is null && !string.IsNullOrWhiteSpace(normalizedEmail))
        {
            user = await userManager.FindByEmailAsync(normalizedEmail);
            if (user is not null)
            {
                var addLoginResult = await userManager.AddLoginAsync(user, loginInfo);
                if (!addLoginResult.Succeeded)
                {
                    if (HasExternalLoginAlreadyAssociatedError(addLoginResult))
                    {
                        user = await userManager.FindByLoginAsync(provider, providerUserId);
                        if (user is null)
                        {
                            return LoginResultDto.ExternalAuthFailed("External sign-in is already associated with a different account.");
                        }
                    }
                    else
                    {
                        return LoginResultDto.ExternalAuthFailed(FormatIdentityErrors(addLoginResult));
                    }
                }
            }
        }

        if (user is null)
        {
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                return LoginResultDto.ExternalAuthFailed("Your external account did not provide an email address. Use email sign up or update your provider profile.");
            }

            var displayName = ResolveExternalFullName(normalizedFullName, normalizedEmail);
            user = new ApplicationUser
            {
                UserName = normalizedEmail,
                Email = normalizedEmail,
                FullName = displayName,
                EmailConfirmed = true,
                TeamId = null,
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                if (HasDuplicateIdentityError(createResult))
                {
                    user = await userManager.FindByEmailAsync(normalizedEmail);
                }
                else
                {
                    return LoginResultDto.ExternalAuthFailed(FormatIdentityErrors(createResult));
                }
            }
            else
            {
                userWasCreated = true;
            }

            if (user is null)
            {
                return LoginResultDto.ExternalAuthFailed("Unable to create your account right now.");
            }

            var roles = await userManager.GetRolesAsync(user);
            if (!roles.Contains(RoleNames.Member, StringComparer.OrdinalIgnoreCase))
            {
                var roleResult = await userManager.AddToRoleAsync(user, RoleNames.Member);
                if (!roleResult.Succeeded)
                {
                    if (userWasCreated)
                    {
                        await userManager.DeleteAsync(user);
                    }
                    return LoginResultDto.ExternalAuthFailed(FormatIdentityErrors(roleResult));
                }
            }

            var addLoginResult = await userManager.AddLoginAsync(user, loginInfo);
            if (!addLoginResult.Succeeded)
            {
                if (HasExternalLoginAlreadyAssociatedError(addLoginResult))
                {
                    var associatedUser = await userManager.FindByLoginAsync(provider, providerUserId);
                    if (associatedUser is null)
                    {
                        if (userWasCreated)
                        {
                            await userManager.DeleteAsync(user);
                        }

                        return LoginResultDto.ExternalAuthFailed("External sign-in is already associated with a different account.");
                    }

                    if (userWasCreated && !string.Equals(associatedUser.Id, user.Id, StringComparison.Ordinal))
                    {
                        await userManager.DeleteAsync(user);
                    }

                    user = associatedUser;
                }
                else
                {
                    if (userWasCreated)
                    {
                        await userManager.DeleteAsync(user);
                    }

                    return LoginResultDto.ExternalAuthFailed(FormatIdentityErrors(addLoginResult));
                }
            }
        }

        if (user is null)
        {
            return LoginResultDto.ExternalAuthFailed("Unable to complete external sign-in right now.");
        }

        if (!user.IsActive)
        {
            return LoginResultDto.ExternalAuthFailed("This account is inactive. Contact an administrator.");
        }

        var fallbackEmail = normalizedEmail
            ?? user.Email
            ?? user.UserName
            ?? string.Empty;

        return await CreateSessionAsync(user, fallbackEmail, rememberMe: true);
    }

    public async Task<LoginResultDto> LoginWithClickUpAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return LoginResultDto.ExternalAuthFailed("Only existing Team Leader accounts can sign in with ClickUp.");
        }

        var user = await userManager.FindByEmailAsync(normalizedEmail);
        if (user is null)
        {
            return LoginResultDto.ExternalAuthFailed("Only existing Team Leader accounts can sign in with ClickUp.");
        }

        if (!user.IsActive)
        {
            return LoginResultDto.ExternalAuthFailed("Only existing Team Leader accounts can sign in with ClickUp.");
        }

        var roles = await userManager.GetRolesAsync(user);
        if (!roles.Contains(RoleNames.TeamLeader, StringComparer.OrdinalIgnoreCase))
        {
            return LoginResultDto.ExternalAuthFailed("Only existing Team Leader accounts can sign in with ClickUp.");
        }

        return await CreateSessionAsync(user, normalizedEmail, rememberMe: true);
    }

    private async Task<LoginResultDto> CreateSessionAsync(ApplicationUser user, string fallbackEmail, bool rememberMe)
    {
        var roles = await userManager.GetRolesAsync(user);
        var primaryRole = ResolvePrimaryRole(roles);
        var defaultExpiryMinutes = int.TryParse(configuration["Jwt:ExpiresInMinutes"], out var parsed) ? parsed : 60;
        var expiresAt = rememberMe
            ? DateTimeOffset.UtcNow.AddDays(RememberMeLifetimeDays)
            : DateTimeOffset.UtcNow.AddMinutes(defaultExpiryMinutes);
        var resolvedEmail = user.Email ?? fallbackEmail;
        if (string.IsNullOrWhiteSpace(user.Email))
        {
            user.Email = resolvedEmail;
        }

        var token = jwtService.GenerateToken(user, roles, expiresAt.UtcDateTime);

        return LoginResultDto.Success(
            new LoginResponseDto(
                token,
                expiresAt,
                primaryRole,
                resolvedEmail));
    }

    public async Task<RegisterResultDto> RegisterAsync(RegisterRequestDto request, CancellationToken cancellationToken = default)
    {
        var fullName = request.FullName.Trim();
        var email = request.Email.Trim();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            return RegisterResultDto.Validation("Full name is required.");
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            return RegisterResultDto.Validation("Email address is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return RegisterResultDto.Validation("Password is required.");
        }

        var existingUser = await userManager.FindByEmailAsync(email);
        if (existingUser is not null)
        {
            return RegisterResultDto.DuplicateEmail("An account with this email already exists.");
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            EmailConfirmed = true,
            TeamId = null,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var errorMessage = FormatIdentityErrors(createResult);
            return HasDuplicateIdentityError(createResult)
                ? RegisterResultDto.DuplicateEmail("An account with this email already exists.")
                : RegisterResultDto.Validation(errorMessage);
        }

        var roleResult = await userManager.AddToRoleAsync(user, RoleNames.Member);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            return RegisterResultDto.Validation(FormatIdentityErrors(roleResult));
        }

        return RegisterResultDto.Success(
            new RegisterResponseDto(
                user.Id,
                user.FullName,
                user.Email ?? email,
                RoleNames.Member));
    }

    public async Task<CurrentUserResponseDto?> GetCurrentUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null || !user.IsActive)
        {
            return null;
        }

        var roles = await userManager.GetRolesAsync(user);
        var primaryRole = ResolvePrimaryRole(roles);

        return new CurrentUserResponseDto(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            primaryRole);
    }

    private static string FormatIdentityErrors(IdentityResult result)
    {
        var descriptions = result.Errors
            .Select(error => error.Description)
            .Where(description => !string.IsNullOrWhiteSpace(description))
            .Distinct()
            .ToArray();

        if (descriptions.Length == 0)
        {
            return "Unable to complete this request.";
        }

        return string.Join(" ", descriptions);
    }

    private static bool HasDuplicateIdentityError(IdentityResult result)
    {
        return result.Errors.Any(error =>
            string.Equals(error.Code, "DuplicateEmail", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(error.Code, "DuplicateUserName", StringComparison.OrdinalIgnoreCase));
    }

    private static bool HasExternalLoginAlreadyAssociatedError(IdentityResult result)
    {
        return result.Errors.Any(error =>
            string.Equals(error.Code, "LoginAlreadyAssociated", StringComparison.OrdinalIgnoreCase));
    }

    private static string ResolveExternalFullName(string? fullName, string email)
    {
        if (!string.IsNullOrWhiteSpace(fullName))
        {
            return fullName;
        }

        var localPart = email.Split('@')[0];
        if (string.IsNullOrWhiteSpace(localPart))
        {
            return "New Member";
        }

        var withSpaces = localPart
            .Replace('.', ' ')
            .Replace('_', ' ')
            .Replace('-', ' ');

        return System.Globalization.CultureInfo.InvariantCulture.TextInfo.ToTitleCase(withSpaces);
    }

    private static string ResolvePrimaryRole(IEnumerable<string> roles)
    {
        var roleSet = roles.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (roleSet.Contains(RoleNames.TeamLeader))
        {
            return RoleNames.TeamLeader;
        }

        return RoleNames.Member;
    }
}
