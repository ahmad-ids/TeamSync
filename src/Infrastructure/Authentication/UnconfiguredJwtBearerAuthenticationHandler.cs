using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class UnconfiguredJwtBearerAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    JwtConfigurationStatus jwtConfigurationStatus)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.ContainsKey("Authorization"))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        return Task.FromResult(AuthenticateResult.Fail(jwtConfigurationStatus.ErrorMessage));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        Response.ContentType = "application/problem+json";

        var detail = string.IsNullOrWhiteSpace(jwtConfigurationStatus.ErrorMessage)
            ? "JWT authentication is not configured."
            : jwtConfigurationStatus.ErrorMessage;

        return Response.WriteAsJsonAsync(new
        {
            title = "Authentication unavailable",
            status = StatusCodes.Status503ServiceUnavailable,
            detail
        });
    }
}
