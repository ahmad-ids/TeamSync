using System.Text;
using AspNet.Security.OAuth.GitHub;
using IDS.Project.Application.Abstractions.Integrations.ClickUp;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.ChangeRequests;
using IDS.Project.Infrastructure.Integrations;
using IDS.Project.Infrastructure.Identity;
using IDS.Project.Infrastructure.Persistence;
using IDS.Project.Infrastructure.Tasks;
using IDS.Project.Infrastructure.Workload;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.WebUtilities;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;

namespace IDS.Project.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        services.AddDataProtection();

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequiredLength = 8;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        var resetTokenLifetimeMinutes = int.TryParse(configuration["PasswordReset:TokenLifespanMinutes"], out var parsedLifetimeMinutes)
            ? parsedLifetimeMinutes
            : 30;
        services.Configure<DataProtectionTokenProviderOptions>(options =>
        {
            options.TokenLifespan = TimeSpan.FromMinutes(resetTokenLifetimeMinutes);
        });

        var jwtConfigurationStatus = JwtConfigurationStatus.FromConfiguration(configuration);
        services.AddSingleton(jwtConfigurationStatus);

        var authenticationBuilder = services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddCookie(IdentityConstants.ExternalScheme, options =>
            {
                options.Cookie.Name = "ids.external.auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.None;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
            });

        if (jwtConfigurationStatus.IsConfigured)
        {
            var key = JwtConfigurationResolver.ResolveSigningKey(configuration);
            var issuer = JwtConfigurationResolver.ResolveIssuer(configuration);
            var audience = JwtConfigurationResolver.ResolveAudience(configuration);

            authenticationBuilder.AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    ValidAudience = audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
                };
            });
        }
        else
        {
            authenticationBuilder.AddScheme<AuthenticationSchemeOptions, UnconfiguredJwtBearerAuthenticationHandler>(
                JwtBearerDefaults.AuthenticationScheme,
                _ => { });
        }

        ConfigureGoogleOAuth(authenticationBuilder, configuration);
        ConfigureGitHubOAuth(authenticationBuilder, configuration);
        ConfigureClickUpOAuth(authenticationBuilder, configuration);
        services.AddHttpClient<IClickUpApiClient, ClickUpApiClient>(client =>
        {
            client.BaseAddress = new Uri("https://api.clickup.com/api/v2/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });
        services.AddScoped<JwtService>();
        services.AddScoped<IPasswordResetEmailService, PasswordResetEmailService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IClickUpTokenProtector, ClickUpTokenProtector>();
        services.AddScoped<IClickUpConnectionService, ClickUpConnectionService>();
        services.AddScoped<IClickUpTaskDiscoveryService, ClickUpTaskDiscoveryService>();
        services.AddScoped<IClickUpSynchronizationService, ClickUpSynchronizationService>();
        services.AddScoped<IWorkloadQueryService, WorkloadQueryService>();
        services.AddScoped<ITaskQueryService, TaskQueryService>();
        services.AddScoped<ITaskCommandService, TaskCommandService>();
        services.AddScoped<ITaskWorkflowService, TaskWorkflowService>();
        services.AddScoped<IChangeRequestService, ChangeRequestService>();
        services.AddScoped<ApplicationDbContextSeed>();

        return services;
    }

    private static void ConfigureGoogleOAuth(AuthenticationBuilder authenticationBuilder, IConfiguration configuration)
    {
        var clientId = ResolveConfiguredValue(configuration, "Authentication:Google:ClientId");
        var clientSecret = ResolveConfiguredValue(configuration, "Authentication:Google:ClientSecret");
        var callbackPath = ResolveConfiguredValue(configuration, "Authentication:Google:CallbackPath")
            ?? "/api/auth/external/google/callback";
        var backendBaseUrl = ResolveBackendBaseUrl(configuration["Backend:BaseUrl"]);

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return;
        }

        authenticationBuilder.AddGoogle(GoogleDefaults.AuthenticationScheme, options =>
        {
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CorrelationCookie.SameSite = SameSiteMode.None;
            options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
            options.CallbackPath = callbackPath;
            options.SaveTokens = false;
            options.Scope.Add("email");
            ConfigureAuthorizationRedirect(options, "Google", callbackPath, backendBaseUrl);
            ApplyCommonOAuthErrorHandling(options, "Google");
        });
    }

    private static void ConfigureGitHubOAuth(AuthenticationBuilder authenticationBuilder, IConfiguration configuration)
    {
        var clientId = ResolveConfiguredValue(configuration, "Authentication:GitHub:ClientId");
        var clientSecret = ResolveConfiguredValue(configuration, "Authentication:GitHub:ClientSecret");
        var callbackPath = ResolveConfiguredValue(configuration, "Authentication:GitHub:CallbackPath")
            ?? "/api/auth/external/github/callback";
        var backendBaseUrl = ResolveBackendBaseUrl(configuration["Backend:BaseUrl"]);

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return;
        }

        authenticationBuilder.AddGitHub("GitHub", options =>
        {
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CorrelationCookie.SameSite = SameSiteMode.None;
            options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
            options.CallbackPath = callbackPath;
            options.SaveTokens = false;
            options.Scope.Add("user:email");
            ConfigureAuthorizationRedirect(options, "GitHub", callbackPath, backendBaseUrl);
            ApplyCommonOAuthErrorHandling(options, "GitHub");
        });
    }

    private static void ConfigureClickUpOAuth(AuthenticationBuilder authenticationBuilder, IConfiguration configuration)
    {
        var clientId = ResolveConfiguredValue(configuration, "Authentication:ClickUp:ClientId");
        var clientSecret = ResolveConfiguredValue(configuration, "Authentication:ClickUp:ClientSecret");
        var callbackPath = ResolveConfiguredValue(configuration, "Authentication:ClickUp:CallbackPath")
            ?? "/api/auth/external/clickup/callback";
        var authorizationEndpoint = ResolveConfiguredValue(configuration, "Authentication:ClickUp:AuthorizationEndpoint")
            ?? "https://app.clickup.com/api";
        var tokenEndpoint = ResolveConfiguredValue(configuration, "Authentication:ClickUp:TokenEndpoint")
            ?? "https://api.clickup.com/api/v2/oauth/token";
        var userInformationEndpoint = ResolveConfiguredValue(configuration, "Authentication:ClickUp:UserInformationEndpoint")
            ?? "https://api.clickup.com/api/v2/user";
        var backendBaseUrl = ResolveBackendBaseUrl(configuration["Backend:BaseUrl"]);

        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return;
        }

        authenticationBuilder.AddOAuth("ClickUp", options =>
        {
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CallbackPath = callbackPath;
            options.AuthorizationEndpoint = authorizationEndpoint;
            options.TokenEndpoint = tokenEndpoint;
            options.UserInformationEndpoint = userInformationEndpoint;
            options.SaveTokens = true;

            options.ClaimActions.MapJsonKey(ClaimTypes.NameIdentifier, "id");
            options.ClaimActions.MapJsonKey(ClaimTypes.Name, "username");
            options.ClaimActions.MapJsonKey(ClaimTypes.Email, "email");

            options.Events.OnCreatingTicket = async context =>
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, context.Options.UserInformationEndpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", context.AccessToken);

                using var response = await context.Backchannel.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    context.HttpContext.RequestAborted);

                response.EnsureSuccessStatusCode();

                await using var responseStream = await response.Content.ReadAsStreamAsync(context.HttpContext.RequestAborted);
                using var payload = await JsonDocument.ParseAsync(responseStream, cancellationToken: context.HttpContext.RequestAborted);

                if (!payload.RootElement.TryGetProperty("user", out var userElement)
                    || userElement.ValueKind != JsonValueKind.Object)
                {
                    throw new InvalidOperationException(
                        "ClickUp user information response did not contain a valid user object.");
                }

                context.RunClaimActions(userElement);
            };

            ConfigureAuthorizationRedirect(options, "ClickUp", callbackPath, backendBaseUrl);
            ApplyCommonOAuthErrorHandling(options, "ClickUp");
        });
    }

    private static void ConfigureAuthorizationRedirect(
        OAuthOptions options,
        string providerLabel,
        string callbackPath,
        string backendBaseUrl)
    {
        options.Events.OnRedirectToAuthorizationEndpoint = context =>
        {
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("OAuth");
            var rewrittenAuthorizationUrl = OAuthRedirectUrlBuilder.RewriteAuthorizationRedirectUri(
                context.RedirectUri,
                backendBaseUrl,
                callbackPath);
            var redirectUri = TryExtractRedirectUri(rewrittenAuthorizationUrl) ?? "<unavailable>";

            logger.LogInformation(
                "{Provider} OAuth authorization redirect started. CallbackPath: {CallbackPath}. RedirectUriSentToProvider: {RedirectUri}. AuthorizationEndpoint: {AuthorizationEndpoint}. BackendBaseUrl: {BackendBaseUrl}",
                providerLabel,
                callbackPath,
                redirectUri,
                rewrittenAuthorizationUrl,
                backendBaseUrl);

            context.Response.Redirect(rewrittenAuthorizationUrl);
            return Task.CompletedTask;
        };
    }

    private static void ApplyCommonOAuthErrorHandling(OAuthOptions options, string providerLabel)
    {
        var existingOnAccessDenied = options.Events.OnAccessDenied;
        var existingOnRemoteFailure = options.Events.OnRemoteFailure;

        options.Events.OnAccessDenied = async context =>
        {
            await existingOnAccessDenied(context);
            if (context.Response.HasStarted)
            {
                return;
            }

            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("OAuth");
            logger.LogWarning(
                "{Provider} access was denied during external sign-in. RedirectUri: {RedirectUri}",
                providerLabel,
                context.Properties?.RedirectUri);

            context.Response.Redirect(BuildOAuthFailureRedirectUrl(
                context.Properties,
                "External sign-in was canceled or denied."));
            context.HandleResponse();
        };

        options.Events.OnRemoteFailure = async context =>
        {
            await existingOnRemoteFailure(context);
            if (context.Response.HasStarted)
            {
                return;
            }

            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("OAuth");
            logger.LogWarning(
                context.Failure,
                "{Provider} remote failure during external sign-in. RedirectUri: {RedirectUri}. RawMessage: {RawMessage}",
                providerLabel,
                context.Properties?.RedirectUri,
                context.Failure?.Message);

            context.Response.Redirect(BuildOAuthFailureRedirectUrl(
                context.Properties,
                ResolveOAuthFailureMessage(providerLabel, context.Failure?.Message)));
            context.HandleResponse();
        };
    }

    private static string? ResolveConfiguredValue(IConfiguration configuration, string key)
    {
        if (configuration is IConfigurationRoot root)
        {
            foreach (var provider in root.Providers.Reverse())
            {
                if (provider.TryGet(key, out var value) && !string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }
        }

        var fallback = configuration[key];
        return string.IsNullOrWhiteSpace(fallback) ? null : fallback.Trim();
    }

    private static string ResolveRequiredValue(IConfiguration configuration, string key, string errorMessage)
    {
        var value = ResolveConfiguredValue(configuration, key);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        throw new InvalidOperationException(errorMessage);
    }

    private static string ResolveBackendBaseUrl(string? configuredBaseUrl)
    {
        if (!string.IsNullOrWhiteSpace(configuredBaseUrl))
        {
            return configuredBaseUrl.Trim().TrimEnd('/');
        }

        return "https://localhost:5202";
    }

    private static string BuildOAuthFailureRedirectUrl(AuthenticationProperties? properties, string message)
    {
        var flow = ResolveFlow(properties);
        var completionPath = ResolveCompletionPath(properties);
        var redirectUrl = $"{completionPath}?flow={Uri.EscapeDataString(flow)}&remoteError={Uri.EscapeDataString(message)}";

        if (properties?.Items.TryGetValue("frontend_origin", out var frontendOrigin) == true
            && !string.IsNullOrWhiteSpace(frontendOrigin))
        {
            redirectUrl += $"&frontendOrigin={Uri.EscapeDataString(frontendOrigin)}";
        }

        return redirectUrl;
    }

    private static string? TryExtractRedirectUri(string authorizationUrl)
    {
        if (!Uri.TryCreate(authorizationUrl, UriKind.Absolute, out var uri))
        {
            return null;
        }

        var query = QueryHelpers.ParseQuery(uri.Query);
        return query.TryGetValue("redirect_uri", out var redirectUri)
            ? redirectUri.ToString()
            : null;
    }

    private static string ResolveFlow(AuthenticationProperties? properties)
    {
        if (properties?.Items.TryGetValue("flow", out var flow) == true
            && string.Equals(flow, "signup", StringComparison.OrdinalIgnoreCase))
        {
            return "signup";
        }

        return "login";
    }

    private static string ResolveCompletionPath(AuthenticationProperties? properties)
    {
        if (properties?.Items.TryGetValue("provider", out var provider) != true
            || string.IsNullOrWhiteSpace(provider))
        {
            return "/api/auth/external/complete";
        }

        if (string.Equals(provider, GoogleDefaults.AuthenticationScheme, StringComparison.OrdinalIgnoreCase))
        {
            return "/api/auth/external/google/complete";
        }

        if (string.Equals(provider, "GitHub", StringComparison.OrdinalIgnoreCase))
        {
            return "/api/auth/external/github/complete";
        }

        if (string.Equals(provider, "ClickUp", StringComparison.OrdinalIgnoreCase))
        {
            return "/api/auth/external/clickup/complete";
        }

        return "/api/auth/external/complete";
    }

    private static string ResolveOAuthFailureMessage(string providerLabel, string? rawMessage)
    {
        if (string.IsNullOrWhiteSpace(rawMessage))
        {
            return $"Unable to complete {providerLabel} sign-in. Please try again.";
        }

        var normalized = rawMessage.Trim().ToLowerInvariant();
        if (normalized.Contains("invalid_client"))
        {
            return $"{providerLabel} OAuth credentials are invalid. Check client ID and client secret.";
        }

        if (normalized.Contains("redirect_uri_mismatch") || normalized.Contains("redirect_uri"))
        {
            return $"{providerLabel} callback URL is invalid. Check provider redirect URI settings.";
        }

        if (normalized.Contains("access_denied"))
        {
            return "External sign-in was canceled or denied.";
        }

        if (normalized.Contains("correlation failed"))
        {
            return "External sign-in validation failed. Please try again.";
        }

        return $"Unable to complete {providerLabel} sign-in. Please try again.";
    }

}
