using Microsoft.Extensions.Configuration;

namespace IDS.Project.Infrastructure.Authentication;

internal static class JwtConfigurationResolver
{
    internal static string ResolveSigningKey(IConfiguration configuration)
    {
        var key = configuration["Jwt:Key"]?.Trim();
        if (!string.IsNullOrWhiteSpace(key))
        {
            return key;
        }

        throw new InvalidOperationException("JWT signing key is missing.");
    }

    internal static string ResolveIssuer(IConfiguration configuration)
    {
        return ResolveAbsoluteUrl(
                   configuration["Jwt:Issuer"],
                   configuration["Backend:BaseUrl"])
               ?? "https://localhost:5202";
    }

    internal static string ResolveAudience(IConfiguration configuration)
    {
        return ResolveAbsoluteUrl(
                   configuration["Jwt:Audience"],
                   configuration["Frontend:BaseUrl"])
               ?? "http://localhost:5173";
    }

    private static string? ResolveAbsoluteUrl(string? primaryValue, string? fallbackValue)
    {
        if (TryNormalizeAbsoluteUrl(primaryValue, out var normalizedPrimary))
        {
            return normalizedPrimary;
        }

        return TryNormalizeAbsoluteUrl(fallbackValue, out var normalizedFallback)
            ? normalizedFallback
            : null;
    }

    private static bool TryNormalizeAbsoluteUrl(string? candidate, out string normalized)
    {
        normalized = string.Empty;

        if (string.IsNullOrWhiteSpace(candidate)
            || !Uri.TryCreate(candidate.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return false;
        }

        normalized = uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        return true;
    }
}
