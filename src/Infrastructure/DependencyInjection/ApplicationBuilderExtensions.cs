using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IDS.Project.Infrastructure.DependencyInjection;

public static class ApplicationBuilderExtensions
{
    public static async Task InitializeInfrastructureAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var initializer = scope.ServiceProvider.GetRequiredService<ApplicationDbContextSeed>();
        await initializer.InitializeAsync();
    }

    public static async Task ValidateOAuthConfigurationAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var serviceProvider = scope.ServiceProvider;
        var configuration = serviceProvider.GetRequiredService<IConfiguration>();
        var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("OAuthStartup");
        var authenticationSchemeProvider = serviceProvider.GetRequiredService<IAuthenticationSchemeProvider>();
        var jwtConfigurationStatus = serviceProvider.GetRequiredService<JwtConfigurationStatus>();

        var schemes = await authenticationSchemeProvider.GetAllSchemesAsync();
        var configuredSchemes = schemes
            .Select(scheme => scheme.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (jwtConfigurationStatus.IsConfigured)
        {
            logger.LogInformation("JWT authentication is configured.");
        }
        else
        {
            logger.LogWarning(
                "JWT authentication is not fully configured. Missing settings: {MissingSettings}",
                jwtConfigurationStatus.MissingSettings.Count == 0
                    ? "<unknown>"
                    : string.Join(", ", jwtConfigurationStatus.MissingSettings));
        }

        LogProviderState(
            logger,
            "Google",
            configuration["Authentication:Google:ClientId"],
            configuration["Authentication:Google:ClientSecret"],
            configuration["Authentication:Google:CallbackPath"] ?? "/api/auth/external/google/callback",
            configuration["Backend:BaseUrl"],
            configuredSchemes.Contains(GoogleDefaults.AuthenticationScheme));

        LogProviderState(
            logger,
            "GitHub",
            configuration["Authentication:GitHub:ClientId"],
            configuration["Authentication:GitHub:ClientSecret"],
            configuration["Authentication:GitHub:CallbackPath"] ?? "/api/auth/external/github/callback",
            configuration["Backend:BaseUrl"],
            configuredSchemes.Contains("GitHub"));
    }

    private static void LogProviderState(
        ILogger logger,
        string providerLabel,
        string? clientId,
        string? clientSecret,
        string callbackPath,
        string? backendBaseUrl,
        bool schemeConfigured)
    {
        var hasClientId = !string.IsNullOrWhiteSpace(clientId);
        var hasClientSecret = !string.IsNullOrWhiteSpace(clientSecret);
        var resolvedBackendBaseUrl = ResolveBackendBaseUrl(backendBaseUrl);
        var redirectUri = Uri.TryCreate(resolvedBackendBaseUrl, UriKind.Absolute, out var backendUri)
            ? $"{backendUri.Scheme}://{backendUri.Authority}{callbackPath}"
            : callbackPath;

        if (hasClientId && hasClientSecret && schemeConfigured)
        {
            logger.LogInformation(
                "{Provider} OAuth is configured. CallbackPath: {CallbackPath}. RedirectUri: {RedirectUri}. BackendBaseUrl: {BackendBaseUrl}",
                providerLabel,
                callbackPath,
                redirectUri,
                resolvedBackendBaseUrl);
            return;
        }

        logger.LogWarning(
            "{Provider} OAuth is not fully configured. SchemeConfigured: {SchemeConfigured}. HasClientId: {HasClientId}. HasClientSecret: {HasClientSecret}. CallbackPath: {CallbackPath}. RedirectUri: {RedirectUri}. BackendBaseUrl: {BackendBaseUrl}",
            providerLabel,
            schemeConfigured,
            hasClientId,
            hasClientSecret,
            callbackPath,
            redirectUri,
            resolvedBackendBaseUrl);
    }

    private static string ResolveBackendBaseUrl(string? configuredBaseUrl)
    {
        if (!string.IsNullOrWhiteSpace(configuredBaseUrl))
        {
            return configuredBaseUrl.Trim().TrimEnd('/');
        }

        return "https://localhost:5202";
    }
}
