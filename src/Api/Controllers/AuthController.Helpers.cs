using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using IDS.Project.Application.DTOs.Auth;
using IDS.Project.Application.DTOs.ClickUp;
using IDS.Project.Domain.Constants;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace IDS.Project.Api.Controllers;

public sealed partial class AuthController
{
    private const string ClickUpSetupTicketCachePrefix = "auth.clickup.setup:";
    private static readonly TimeSpan ClickUpSetupTicketLifetime = TimeSpan.FromMinutes(5);

    private async Task EnsureStandardUserRolesAsync(ApplicationUser user)
    {
        foreach (var role in new[] { RoleNames.Member })
        {
            if (!await userManager.IsInRoleAsync(user, role))
            {
                await userManager.AddToRoleAsync(user, role);
            }
        }
    }

    private async Task SafeSignOutExternalAsync()
    {
        try
        {
            await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to clear external auth cookie after OAuth callback.");
        }
    }

    private int GetJwtExpiryMinutes()
    {
        return int.TryParse(configuration["Jwt:ExpiresInMinutes"], out var parsed) ? parsed : 60;
    }

    private async Task<IActionResult> CompleteExternalSignInCore(
        string? expectedProvider,
        string normalizedFlow,
        string? frontendOrigin,
        string? remoteError,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(remoteError))
        {
            var resolvedMessage = ResolveRemoteErrorMessage(remoteError);
            logger.LogWarning(
                "External sign-in returned remote error for provider {Provider} and flow {Flow}: {Message}",
                expectedProvider ?? "Any",
                normalizedFlow,
                resolvedMessage);

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: resolvedMessage,
                frontendOrigin: frontendOrigin));
        }

        if (!jwtConfigurationStatus.IsConfigured)
        {
            logger.LogWarning(
                "External sign-in completion blocked because JWT configuration is incomplete. Provider: {Provider}. Flow: {Flow}. Missing: {MissingSettings}",
                expectedProvider ?? "Any",
                normalizedFlow,
                string.Join(", ", jwtConfigurationStatus.MissingSettings));

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "External sign-in is temporarily unavailable. Contact your administrator.",
                frontendOrigin: frontendOrigin));
        }

        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
        if (!result.Succeeded || result.Principal is null)
        {
            var failureMessage = result.Failure?.Message ?? "No authentication principal was returned.";
            var propertyKeys = result.Properties?.Items.Keys.ToArray() ?? Array.Empty<string>();
            var claimTypes = result.Principal?.Claims.Select(claim => claim.Type).Distinct().ToArray() ?? Array.Empty<string>();
            logger.LogWarning(
                "External sign-in cookie authentication failed for provider {Provider} and flow {Flow}. Succeeded: {Succeeded}. Failure: {Failure}. RedirectUri: {RedirectUri}. RequestPath: {RequestPath}. Query: {Query}. PropertyKeys: {PropertyKeys}. ClaimTypes: {ClaimTypes}",
                expectedProvider ?? "Any",
                normalizedFlow,
                result.Succeeded,
                failureMessage,
                result.Properties?.RedirectUri,
                Request.Path.Value,
                Request.QueryString.Value,
                propertyKeys.Length == 0 ? "<none>" : string.Join(", ", propertyKeys),
                claimTypes.Length == 0 ? "<none>" : string.Join(", ", claimTypes));

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to read external login response. Please try again.",
                frontendOrigin: frontendOrigin));
        }

        var externalInfo = await signInManager.GetExternalLoginInfoAsync();
        if (externalInfo is null)
        {
            var claimTypes = result.Principal.Claims.Select(claim => claim.Type).Distinct().ToArray();
            var propertyKeys = result.Properties?.Items.Keys.ToArray() ?? Array.Empty<string>();
            logger.LogWarning(
                "External login info was null for provider {Provider} and flow {Flow}. AuthenticationType: {AuthenticationType}. IsAuthenticated: {IsAuthenticated}. Available claims: {Claims}. PropertyKeys: {PropertyKeys}. RedirectUri: {RedirectUri}",
                expectedProvider ?? "Any",
                normalizedFlow,
                result.Principal.Identity?.AuthenticationType ?? "<none>",
                result.Principal.Identity?.IsAuthenticated ?? false,
                claimTypes.Length == 0 ? "<none>" : string.Join(", ", claimTypes),
                propertyKeys.Length == 0 ? "<none>" : string.Join(", ", propertyKeys),
                result.Properties?.RedirectUri);

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to read external login response. Please try again.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        if (!string.IsNullOrWhiteSpace(expectedProvider)
            && !string.Equals(externalInfo.LoginProvider, expectedProvider, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning(
                "Unexpected external login provider. Expected {ExpectedProvider}, got {ActualProvider} for flow {Flow}.",
                expectedProvider,
                externalInfo.LoginProvider,
                normalizedFlow);
        }

        var email = externalInfo.Principal.FindFirstValue(ClaimTypes.Email)
            ?? externalInfo.Principal.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? externalInfo.Principal.FindFirstValue("email");
        var fullName = externalInfo.Principal.FindFirstValue(ClaimTypes.Name)
            ?? externalInfo.Principal.FindFirstValue("name");

        logger.LogInformation(
            "External principal resolved for provider {Provider} and flow {Flow}. HasEmail: {HasEmail}, HasName: {HasName}, ProviderKeyLength: {ProviderKeyLength}",
            externalInfo.LoginProvider,
            normalizedFlow,
            !string.IsNullOrWhiteSpace(email),
            !string.IsNullOrWhiteSpace(fullName),
            externalInfo.ProviderKey?.Length ?? 0);

        if (string.IsNullOrWhiteSpace(externalInfo.ProviderKey))
        {
            var claimTypes = externalInfo.Principal.Claims.Select(claim => claim.Type).Distinct().ToArray();
            logger.LogWarning(
                "External login provider key was missing for provider {Provider} and flow {Flow}. AuthenticationType: {AuthenticationType}. Available claims: {Claims}",
                externalInfo.LoginProvider,
                normalizedFlow,
                externalInfo.Principal.Identity?.AuthenticationType ?? "<none>",
                claimTypes.Length == 0 ? "<none>" : string.Join(", ", claimTypes));

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to read external login response. Please try again.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var loginResult = await authService.LoginWithExternalProviderAsync(
            new ExternalLoginRequestDto(
                externalInfo.LoginProvider,
                externalInfo.ProviderKey,
                email,
                fullName),
            cancellationToken);

        if (!loginResult.Succeeded || loginResult.Session is null)
        {
            logger.LogWarning(
                "External sign-in service failed for provider {Provider} and flow {Flow}. Error: {Error}. EmailPresent: {EmailPresent}. FullNamePresent: {FullNamePresent}. ProviderKeyLength: {ProviderKeyLength}",
                externalInfo.LoginProvider,
                normalizedFlow,
                loginResult.Error ?? "Unknown error",
                !string.IsNullOrWhiteSpace(externalInfo.Principal.FindFirstValue(ClaimTypes.Email)
                    ?? externalInfo.Principal.FindFirstValue(JwtRegisteredClaimNames.Email)
                    ?? externalInfo.Principal.FindFirstValue("email")),
                !string.IsNullOrWhiteSpace(externalInfo.Principal.FindFirstValue(ClaimTypes.Name)
                    ?? externalInfo.Principal.FindFirstValue("name")),
                externalInfo.ProviderKey?.Length ?? 0);

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: loginResult.Error ?? "Unable to complete external sign-in right now.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var ticket = Guid.NewGuid().ToString("N");
        cache.Set(GetOAuthTicketCacheKey(ticket), loginResult.Session.Token, OAuthTicketLifetime);

        logger.LogInformation(
            "External sign-in ticket created for provider {Provider}, flow {Flow}, role {Role}. TicketId: {TicketId}",
            externalInfo.LoginProvider,
            normalizedFlow,
            loginResult.Session.Role,
            ticket[..8]);

        return Redirect(BuildFrontendOAuthCallbackUrl(
            normalizedFlow,
            ticket,
            error: null,
            frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
    }

    private async Task<IActionResult> CompleteClickUpExternalSignInCore(
        string normalizedFlow,
        string? frontendOrigin,
        string? remoteError,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(remoteError))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: ResolveRemoteErrorMessage(remoteError),
                frontendOrigin: frontendOrigin));
        }

        if (!jwtConfigurationStatus.IsConfigured)
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "External sign-in is temporarily unavailable. Contact your administrator.",
                frontendOrigin: frontendOrigin));
        }

        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
        if (!result.Succeeded || result.Principal is null)
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Unable to read ClickUp sign-in response. Please try again.",
                frontendOrigin: frontendOrigin));
        }

        var accessToken = result.Properties?.GetTokenValue("access_token");
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "ClickUp access token was not returned by the OAuth provider.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var clickUpUser = await clickUpApiClient.GetCurrentUserAsync(accessToken, cancellationToken);
        if (string.IsNullOrWhiteSpace(clickUpUser.Email))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "ClickUp did not return a verified email address.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var applicationUser = await userManager.FindByEmailAsync(clickUpUser.Email);
        if (applicationUser is null || !applicationUser.IsActive)
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Only existing Team Leader accounts can sign in with ClickUp.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var roles = await userManager.GetRolesAsync(applicationUser);
        if (!roles.Contains(RoleNames.TeamLeader, StringComparer.OrdinalIgnoreCase))
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "Only existing Team Leader accounts can sign in with ClickUp.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var loginResult = await authService.LoginWithClickUpAsync(clickUpUser.Email, cancellationToken);
        if (!loginResult.Succeeded || loginResult.Session is null)
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: loginResult.Error ?? "Only existing Team Leader accounts can sign in with ClickUp.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var workspaces = await clickUpApiClient.GetAuthorizedWorkspacesAsync(accessToken, cancellationToken);
        if (workspaces.Count == 0)
        {
            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "No ClickUp workspace is available for this account.",
                frontendOrigin: ResolveFrontendOrigin(result.Properties, frontendOrigin)));
        }

        var resolvedFrontendOrigin = ResolveFrontendOrigin(result.Properties, frontendOrigin);
        if (workspaces.Count == 1)
        {
            await clickUpConnectionService.SaveConnectionAsync(
                applicationUser.Id,
                clickUpUser.UserId,
                accessToken,
                workspaces[0],
                cancellationToken);

            var ticket = Guid.NewGuid().ToString("N");
            cache.Set(GetOAuthTicketCacheKey(ticket), loginResult.Session.Token, OAuthTicketLifetime);

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket,
                error: null,
                frontendOrigin: resolvedFrontendOrigin));
        }

        var setupTicket = CreateClickUpSetupTicket();
        cache.Set(
            GetClickUpSetupTicketCacheKey(setupTicket),
            new ClickUpSetupTicketDto(applicationUser.Id, clickUpUser.UserId, accessToken, workspaces.ToArray()),
            ClickUpSetupTicketLifetime);

        var oauthTicket = Guid.NewGuid().ToString("N");
        cache.Set(GetOAuthTicketCacheKey(oauthTicket), loginResult.Session.Token, OAuthTicketLifetime);

        return Redirect(BuildFrontendOAuthCallbackUrl(
            normalizedFlow,
            oauthTicket,
            error: null,
            frontendOrigin: resolvedFrontendOrigin,
            clickUpSetupTicket: setupTicket));
    }

    private LoginResponseDto BuildLoginResponseFromJwt(string token, JwtSecurityToken parsedToken)
    {
        var role = ResolvePrimaryRole(parsedToken.Claims
            .Where(claim => claim.Type == ClaimTypes.Role)
            .Select(claim => claim.Value));
        var email = parsedToken.Claims.FirstOrDefault(claim =>
                claim.Type == JwtRegisteredClaimNames.Email || claim.Type == ClaimTypes.Email)
            ?.Value
            ?? string.Empty;
        var expiresAt = parsedToken.ValidTo == DateTime.MinValue
            ? DateTimeOffset.UtcNow.AddMinutes(GetJwtExpiryMinutes())
            : new DateTimeOffset(DateTime.SpecifyKind(parsedToken.ValidTo, DateTimeKind.Utc));

        return new LoginResponseDto(token, expiresAt, role, email);
    }

    private string BuildFrontendOAuthCallbackUrl(string flow, string? ticket, string? error, string? frontendOrigin, string? clickUpSetupTicket = null)
    {
        var callbackUrl = $"{ResolveFrontendBaseUrl(frontendOrigin)}/oauth/callback";
        callbackUrl = QueryHelpers.AddQueryString(callbackUrl, "flow", flow);

        if (!string.IsNullOrWhiteSpace(ticket))
        {
            callbackUrl = QueryHelpers.AddQueryString(callbackUrl, "ticket", ticket);
        }

        if (!string.IsNullOrWhiteSpace(error))
        {
            callbackUrl = QueryHelpers.AddQueryString(callbackUrl, "error", error);
        }

        if (!string.IsNullOrWhiteSpace(clickUpSetupTicket))
        {
            callbackUrl = QueryHelpers.AddQueryString(callbackUrl, "clickupSetupTicket", clickUpSetupTicket);
        }

        return callbackUrl;
    }

    private string ResolveFrontendBaseUrl(string? requestedFrontendOrigin = null)
    {
        if (TryResolveFrontendOrigin(requestedFrontendOrigin, out var requestedOrigin))
        {
            return requestedOrigin;
        }

        var configuredBaseUrl = configuration["Frontend:BaseUrl"]?.Trim();
        if (TryResolveFrontendOrigin(configuredBaseUrl, out var configuredOrigin))
        {
            return configuredOrigin;
        }

        return "http://localhost:5173";
    }

    private string ResolveBackendBaseUrl()
    {
        var configuredBaseUrl = configuration["Backend:BaseUrl"]?.Trim();
        return !string.IsNullOrWhiteSpace(configuredBaseUrl)
               && Uri.TryCreate(configuredBaseUrl, UriKind.Absolute, out var configuredUri)
               && string.Equals(configuredUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            ? configuredBaseUrl.TrimEnd('/')
            : $"{Request.Scheme}://{Request.Host.Value}".TrimEnd('/');
    }

    private string? ResolveFrontendOrigin(AuthenticationProperties? properties, string? fallbackFrontendOrigin)
    {
        if (properties?.Items.TryGetValue("frontend_origin", out var storedOrigin) == true
            && TryResolveFrontendOrigin(storedOrigin, out var resolvedStoredOrigin))
        {
            return resolvedStoredOrigin;
        }

        return TryResolveFrontendOrigin(fallbackFrontendOrigin, out var resolvedFallbackOrigin)
            ? resolvedFallbackOrigin
            : null;
    }

    private static bool TryResolveFrontendOrigin(string? candidateOrigin, out string normalizedOrigin)
    {
        normalizedOrigin = string.Empty;

        if (string.IsNullOrWhiteSpace(candidateOrigin)
            || !Uri.TryCreate(candidateOrigin.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return false;
        }

        normalizedOrigin = $"{uri.Scheme}://{uri.Authority}".TrimEnd('/');
        return true;
    }

    private string BuildPasswordResetEntryUrl(string email, string encodedToken)
    {
        return QueryHelpers.AddQueryString(
            QueryHelpers.AddQueryString($"{ResolveBackendBaseUrl()}/api/auth/password-reset", "email", email),
            "token",
            encodedToken);
    }

    private static string NormalizeFlow(string? flow)
    {
        return string.Equals(flow, "signup", StringComparison.OrdinalIgnoreCase)
            ? "signup"
            : "login";
    }

    private static bool TryResolveProviderScheme(
        string provider,
        out string scheme,
        out string providerLabel)
    {
        if (string.Equals(provider, "google", StringComparison.OrdinalIgnoreCase))
        {
            scheme = GoogleScheme;
            providerLabel = "Google";
            return true;
        }

        if (string.Equals(provider, "github", StringComparison.OrdinalIgnoreCase))
        {
            scheme = GitHubScheme;
            providerLabel = "GitHub";
            return true;
        }

        if (string.Equals(provider, "clickup", StringComparison.OrdinalIgnoreCase))
        {
            scheme = ClickUpScheme;
            providerLabel = "ClickUp";
            return true;
        }

        scheme = string.Empty;
        providerLabel = string.Empty;
        return false;
    }

    private static string ResolveRemoteErrorMessage(string remoteError)
    {
        var trimmed = remoteError.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return "External sign-in was canceled or denied.";
        }

        return trimmed.Length > 300
            ? "Unable to complete external sign-in right now."
            : trimmed;
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

    private static string CreateClickUpSetupTicket()
    {
        return Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }

    private static string GetClickUpSetupTicketCacheKey(string ticket) => $"{ClickUpSetupTicketCachePrefix}{ticket.Trim()}";

    private static string GetOAuthTicketCacheKey(string ticket) => $"{OAuthTicketCachePrefix}{ticket.Trim()}";

    private ObjectResult JwtConfigurationProblem()
    {
        var detail = string.IsNullOrWhiteSpace(jwtConfigurationStatus.ErrorMessage)
            ? "JWT authentication is not configured."
            : jwtConfigurationStatus.ErrorMessage;

        return Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Authentication unavailable",
            detail: detail);
    }

    private bool IsExternalProviderAvailable(ISet<string> configuredSchemes, string scheme)
    {
        if (!jwtConfigurationStatus.IsConfigured)
        {
            return false;
        }

        return configuredSchemes.Contains(scheme);
    }

    private bool IsExternalProviderConfigured(string scheme)
    {
        return authenticationSchemeProvider.GetSchemeAsync(scheme).GetAwaiter().GetResult() is not null;
    }

    private IActionResult StartConfiguredExternalOAuth(
        string scheme,
        string providerLabel,
        string normalizedFlow,
        string completionActionName,
        string? frontendOrigin)
    {
        if (!jwtConfigurationStatus.IsConfigured)
        {
            logger.LogWarning(
                "{Provider} sign-in requested for flow {Flow}, but JWT configuration is incomplete. Missing: {MissingSettings}",
                providerLabel,
                normalizedFlow,
                string.Join(", ", jwtConfigurationStatus.MissingSettings));

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: "External sign-in is temporarily unavailable. Contact your administrator.",
                frontendOrigin: frontendOrigin));
        }

        if (!IsExternalProviderConfigured(scheme))
        {
            logger.LogWarning(
                "{Provider} sign-in requested for flow {Flow}, but the authentication scheme is not configured.",
                providerLabel,
                normalizedFlow);

            return Redirect(BuildFrontendOAuthCallbackUrl(
                normalizedFlow,
                ticket: null,
                error: $"{providerLabel} sign-in is not configured. Contact your administrator.",
                frontendOrigin: frontendOrigin));
        }

        var resolvedFrontendOrigin = TryResolveFrontendOrigin(frontendOrigin, out var normalizedFrontendOrigin)
            ? normalizedFrontendOrigin
            : null;

        var backendBaseUrl = ResolveBackendBaseUrl();
        var backendRedirectUri = BuildBackendRedirectUri(backendBaseUrl, completionActionName, normalizedFlow)
            ?? $"{ResolveFrontendBaseUrl()}/login?error=oauth_configuration_failed";

        var properties = signInManager.ConfigureExternalAuthenticationProperties(scheme, backendRedirectUri);
        properties.Items["flow"] = normalizedFlow;
        properties.Items["provider"] = scheme;
        if (!string.IsNullOrWhiteSpace(resolvedFrontendOrigin))
        {
            properties.Items["frontend_origin"] = resolvedFrontendOrigin;
        }

        logger.LogInformation(
            "Starting {Provider} sign-in for flow {Flow}. RedirectUri: {RedirectUri}. FrontendOrigin: {FrontendOrigin}",
            providerLabel,
            normalizedFlow,
            backendRedirectUri,
            resolvedFrontendOrigin ?? ResolveFrontendBaseUrl());

        return Challenge(properties, scheme);
    }

    private string? BuildBackendRedirectUri(
        string backendBaseUrl,
        string completionActionName,
        string normalizedFlow)
    {
        if (!Uri.TryCreate(backendBaseUrl, UriKind.Absolute, out var backendUri))
        {
            logger.LogWarning(
                "Unable to resolve backend base URL for OAuth redirect generation. BackendBaseUrl: {BackendBaseUrl}",
                backendBaseUrl);
            return null;
        }

        var completionPath = Url.Action(
            completionActionName,
            "Auth",
            new { flow = normalizedFlow });

        return string.IsNullOrWhiteSpace(completionPath)
            ? null
            : $"{backendUri.Scheme}://{backendUri.Authority}{completionPath}";
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

}
