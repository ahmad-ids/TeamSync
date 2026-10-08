using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Auth;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Constants;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace IDS.Project.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed partial class AuthController(
    IAuthService authService,
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IAuthenticationSchemeProvider authenticationSchemeProvider,
    IClickUpApiClient clickUpApiClient,
    IClickUpConnectionService clickUpConnectionService,
    JwtService jwtService,
    JwtConfigurationStatus jwtConfigurationStatus,
    IPasswordResetEmailService passwordResetEmailService,
    IMemoryCache cache,
    IConfiguration configuration,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string OAuthTicketCachePrefix = "auth.oauth.ticket:";
    private static readonly TimeSpan OAuthTicketLifetime = TimeSpan.FromMinutes(5);
    private const string GoogleScheme = "Google";
    private const string GitHubScheme = "GitHub";
    private const string ClickUpScheme = "ClickUp";
    private const string PasswordResetRequestAcknowledgement = "If an account matches that email, a password reset link will be sent shortly.";
    public sealed record ExternalProvidersResponseDto(
        bool ClickUp);

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Register(
        [FromBody] RegisterRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!jwtConfigurationStatus.IsConfigured)
        {
            logger.LogWarning("Registration requested while JWT configuration is incomplete. Missing: {MissingSettings}", string.Join(", ", jwtConfigurationStatus.MissingSettings));
            return JwtConfigurationProblem();
        }

        var result = await authService.RegisterAsync(request, cancellationToken);
        if (!result.Succeeded || result.Account is null)
        {
            if (result.FailureReason == RegisterFailureReason.DuplicateEmail)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "Account already exists",
                    detail: result.Error ?? "An account with this email already exists.");
            }

            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Registration failed",
                detail: result.Error ?? "Unable to create account.");
        }

        var user = await userManager.FindByIdAsync(result.Account.UserId);
        if (user is null)
        {
            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Registration failed",
                detail: "Account was created but could not be loaded for token generation.");
        }

        await EnsureStandardUserRolesAsync(user);
        var roles = await userManager.GetRolesAsync(user);
        var token = jwtService.GenerateToken(user, roles);

        return Ok(new LoginResponseDto(
            token,
            DateTimeOffset.UtcNow.AddMinutes(GetJwtExpiryMinutes()),
            ResolvePrimaryRole(roles),
            user.Email ?? request.Email.Trim()));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login(
        [FromBody] LoginRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!jwtConfigurationStatus.IsConfigured)
        {
            logger.LogWarning("Login requested while JWT configuration is incomplete. Missing: {MissingSettings}", string.Join(", ", jwtConfigurationStatus.MissingSettings));
            return JwtConfigurationProblem();
        }

        var result = await authService.LoginAsync(request, cancellationToken);
        if (!result.Succeeded || result.Session is null)
        {
            if (result.FailureReason == LoginFailureReason.AccountNotFound)
            {
                return Problem(
                    statusCode: StatusCodes.Status404NotFound,
                    title: "Account not found",
                    detail: result.Error ?? "This account does not exist. Please sign up.");
            }

            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Login failed",
                detail: result.Error ?? "Incorrect email or password.");
        }

        return Ok(result.Session);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserResponseDto>> Me(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var currentUser = await authService.GetCurrentUserAsync(userId, cancellationToken);
        if (currentUser is null)
        {
            return Unauthorized();
        }

        return Ok(currentUser);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Ok(new { message = PasswordResetRequestAcknowledgement });
        }

        try
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null || !user.IsActive || string.IsNullOrWhiteSpace(user.Email))
            {
                logger.LogInformation("Password reset requested for unknown or inactive email {Email}.", email);
                return Ok(new { message = PasswordResetRequestAcknowledgement });
            }

            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var resetLink = BuildPasswordResetEntryUrl(user.Email, encodedToken);

            await passwordResetEmailService.SendPasswordResetEmailAsync(
                user.Email,
                user.FullName,
                resetLink,
                cancellationToken);

            logger.LogInformation("Password reset email queued for user {UserId}.", user.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Password reset request processing failed for email {Email}.", email);
        }

        return Ok(new { message = PasswordResetRequestAcknowledgement });
    }

    [HttpGet("password-reset")]
    [AllowAnonymous]
    public IActionResult PasswordResetEntry([FromQuery] string? email, [FromQuery] string? token)
    {
        var frontendUrl = $"{ResolveFrontendBaseUrl()}/reset-password";

        if (!string.IsNullOrWhiteSpace(email))
        {
            frontendUrl = QueryHelpers.AddQueryString(frontendUrl, "email", email);
        }

        if (!string.IsNullOrWhiteSpace(token))
        {
            frontendUrl = QueryHelpers.AddQueryString(frontendUrl, "token", token);
        }

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
        {
            frontendUrl = QueryHelpers.AddQueryString(frontendUrl, "error", "The password reset link is invalid.");
        }

        return Redirect(frontendUrl);
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(email)
            || string.IsNullOrWhiteSpace(request.Token)
            || string.IsNullOrWhiteSpace(request.Password)
            || string.IsNullOrWhiteSpace(request.ConfirmPassword))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Reset failed",
                detail: "Email, reset token, and password are required.");
        }

        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Reset failed",
                detail: "Password confirmation does not match.");
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user is null || !user.IsActive)
        {
            logger.LogInformation("Password reset denied for unknown or inactive email {Email}.", email);
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Reset failed",
                detail: "This password reset link is invalid or has expired.");
        }

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Password reset token decoding failed for user {UserId}.", user.Id);
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Reset failed",
                detail: "This password reset link is invalid or has expired.");
        }

        var resetResult = await userManager.ResetPasswordAsync(user, decodedToken, request.Password);
        if (!resetResult.Succeeded)
        {
            var errorCodes = resetResult.Errors.Select(error => error.Code).ToArray();
            logger.LogWarning(
                "Password reset failed for user {UserId}. Codes: {Codes}",
                user.Id,
                string.Join(", ", errorCodes));

            var invalidToken = errorCodes.Any(code => string.Equals(code, "InvalidToken", StringComparison.OrdinalIgnoreCase));
            var detail = invalidToken
                ? "This password reset link is invalid or has expired."
                : FormatIdentityErrors(resetResult);

            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Reset failed",
                detail: detail);
        }

        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.SetLockoutEndDateAsync(user, null);
        logger.LogInformation("Password reset completed for user {UserId}.", user.Id);
        return Ok(new { message = "Your password has been reset successfully." });
    }
    [HttpGet("external/providers")]
    [AllowAnonymous]
    public async Task<ActionResult<ExternalProvidersResponseDto>> GetExternalProviders()
    {
        var schemes = await authenticationSchemeProvider.GetAllSchemesAsync();

        var configuredSchemes = schemes
            .Select(scheme => scheme.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return Ok(new ExternalProvidersResponseDto(
            IsExternalProviderAvailable(configuredSchemes, ClickUpScheme)));
    }

    [HttpGet("external/google/start")]
    [AllowAnonymous]
    public IActionResult GoogleStart([FromQuery] string? flow, [FromQuery] string? frontendOrigin)
    {
        var normalizedFlow = NormalizeFlow(flow);
        return StartConfiguredExternalOAuth(
            GoogleScheme,
            "Google",
            normalizedFlow,
            nameof(CompleteGoogleExternalOAuth),
            frontendOrigin);
    }

    [HttpGet("external/github/start")]
    [AllowAnonymous]
    public IActionResult GitHubStart([FromQuery] string? flow, [FromQuery] string? frontendOrigin)
    {
        var normalizedFlow = NormalizeFlow(flow);
        return StartConfiguredExternalOAuth(
            GitHubScheme,
            "GitHub",
            normalizedFlow,
            nameof(CompleteGitHubExternalOAuth),
            frontendOrigin);
    }

    [HttpGet("external/clickup/start")]
    [AllowAnonymous]
    public IActionResult ClickUpStart(
        [FromQuery] string? flow,
        [FromQuery] string? frontendOrigin)
    {
        var normalizedFlow = NormalizeFlow(flow);

        return StartConfiguredExternalOAuth(
            ClickUpScheme,
            "ClickUp",
            normalizedFlow,
            nameof(CompleteClickUpExternalOAuth),
            frontendOrigin);
    }

    [HttpGet("external/{provider}/start")]
    [HttpGet("oauth/{provider}")]
    [AllowAnonymous]
    public IActionResult StartExternalOAuth(string provider, [FromQuery] string? flow, [FromQuery] string? frontendOrigin)
    {
        if (string.Equals(provider, "google", StringComparison.OrdinalIgnoreCase))
        {
            return GoogleStart(flow, frontendOrigin);
        }

        if (string.Equals(provider, "github", StringComparison.OrdinalIgnoreCase))
        {
            return GitHubStart(flow, frontendOrigin);
        }

        if (string.Equals(provider, "clickup", StringComparison.OrdinalIgnoreCase))
        {
            return ClickUpStart(flow, frontendOrigin);
        }

        if (!TryResolveProviderScheme(provider, out var scheme, out var providerLabel))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                NormalizeFlow(flow),
                ticket: null,
                error: "Unsupported OAuth provider.",
                frontendOrigin: frontendOrigin));
        }

        if (!IsExternalProviderConfigured(scheme))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                NormalizeFlow(flow),
                ticket: null,
                error: $"{providerLabel} sign-in is not configured. Contact your administrator.",
                frontendOrigin: frontendOrigin));
        }

        return StartConfiguredExternalOAuth(
            scheme,
            providerLabel,
            NormalizeFlow(flow),
            nameof(CompleteExternalOAuth),
            frontendOrigin);
    }

    [HttpGet("external/google/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteGoogleExternalOAuth(
        [FromQuery] string? flow,
        [FromQuery] string? frontendOrigin,
        [FromQuery] string? remoteError,
        CancellationToken cancellationToken)
    {
        var normalizedFlow = NormalizeFlow(flow);

        try
        {
            logger.LogInformation("Completing Google external sign-in for flow {Flow}.", normalizedFlow);
            return await CompleteExternalSignInCore(GoogleScheme, normalizedFlow, frontendOrigin, remoteError, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google external sign-in completion failed for flow {Flow}.", normalizedFlow);
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to complete Google sign-in right now. Please try again.",
                frontendOrigin: frontendOrigin));
        }
        finally
        {
            await SafeSignOutExternalAsync();
        }
    }

    [HttpGet("external/github/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteGitHubExternalOAuth(
        [FromQuery] string? flow,
        [FromQuery] string? frontendOrigin,
        [FromQuery] string? remoteError,
        CancellationToken cancellationToken)
    {
        var normalizedFlow = NormalizeFlow(flow);

        try
        {
            logger.LogInformation("Completing GitHub external sign-in for flow {Flow}.", normalizedFlow);
            return await CompleteExternalSignInCore(GitHubScheme, normalizedFlow, frontendOrigin, remoteError, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GitHub external sign-in completion failed for flow {Flow}.", normalizedFlow);
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to complete GitHub sign-in right now. Please try again.",
                frontendOrigin: frontendOrigin));
        }
        finally
        {
            await SafeSignOutExternalAsync();
        }
    }

    [HttpGet("external/clickup/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteClickUpExternalOAuth(
        [FromQuery] string? flow,
        [FromQuery] string? frontendOrigin,
        [FromQuery] string? remoteError,
        CancellationToken cancellationToken)
    {
        var normalizedFlow = NormalizeFlow(flow);

        try
        {
            logger.LogInformation("Completing ClickUp external sign-in for flow {Flow}.", normalizedFlow);
            return await CompleteClickUpExternalSignInCore(normalizedFlow, frontendOrigin, remoteError, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ClickUp external sign-in completion failed for flow {Flow}.", normalizedFlow);
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to complete ClickUp sign-in right now. Please try again.",
                frontendOrigin: frontendOrigin));
        }
        finally
        {
            await SafeSignOutExternalAsync();
        }
    }

    [HttpGet("external/complete")]
    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteExternalOAuth(
        [FromQuery] string? flow,
        [FromQuery] string? frontendOrigin,
        [FromQuery] string? remoteError,
        CancellationToken cancellationToken)
    {
        var normalizedFlow = NormalizeFlow(flow);

        try
        {
            logger.LogInformation("Completing external sign-in for flow {Flow}.", normalizedFlow);
            return await CompleteExternalSignInCore(
                expectedProvider: null,
                normalizedFlow,
                frontendOrigin,
                remoteError,
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "OAuth callback failed for flow {Flow}.", normalizedFlow);
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to complete external sign-in right now. Please try again.",
                frontendOrigin: frontendOrigin));
        }
        finally
        {
            await SafeSignOutExternalAsync();
        }
    }

    [HttpPost("external/exchange")]
    [HttpPost("oauth/exchange")]
    [AllowAnonymous]
    public ActionResult<LoginResponseDto> Exchange([FromBody] OAuthTicketExchangeRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Ticket))
        {
            return BadRequest(new { error = "invalid_or_expired_ticket" });
        }

        if (!cache.TryGetValue(GetOAuthTicketCacheKey(request.Ticket), out string? jwt) || string.IsNullOrWhiteSpace(jwt))
        {
            return BadRequest(new { error = "invalid_or_expired_ticket" });
        }

        cache.Remove(GetOAuthTicketCacheKey(request.Ticket));

        var parsed = new JwtSecurityTokenHandler().ReadJwtToken(jwt);
        return Ok(BuildLoginResponseFromJwt(jwt, parsed));
    }

}
