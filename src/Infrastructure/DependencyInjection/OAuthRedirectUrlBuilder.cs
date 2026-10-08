using Microsoft.AspNetCore.WebUtilities;

namespace IDS.Project.Infrastructure.DependencyInjection;

internal static class OAuthRedirectUrlBuilder
{
    internal static string RewriteAuthorizationRedirectUri(
        string authorizationUrl,
        string backendBaseUrl,
        string callbackPath)
    {
        if (!Uri.TryCreate(authorizationUrl, UriKind.Absolute, out var authorizationUri))
        {
            return authorizationUrl;
        }

        var providerRedirectUri = BuildProviderRedirectUri(backendBaseUrl, callbackPath);
        if (string.IsNullOrWhiteSpace(providerRedirectUri))
        {
            return authorizationUrl;
        }

        var query = QueryHelpers.ParseQuery(authorizationUri.Query)
            .ToDictionary(
                pair => pair.Key,
                pair => (string?)pair.Value.ToString(),
                StringComparer.OrdinalIgnoreCase);

        query["redirect_uri"] = providerRedirectUri;

        var rewrittenUrl = QueryHelpers.AddQueryString(
            $"{authorizationUri.Scheme}://{authorizationUri.Authority}{authorizationUri.AbsolutePath}",
            query);

        return string.IsNullOrWhiteSpace(authorizationUri.Fragment)
            ? rewrittenUrl
            : $"{rewrittenUrl}{authorizationUri.Fragment}";
    }

    internal static string? BuildProviderRedirectUri(string backendBaseUrl, string callbackPath)
    {
        if (!Uri.TryCreate(backendBaseUrl, UriKind.Absolute, out var backendUri))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(callbackPath))
        {
            return null;
        }

        var normalizedPath = callbackPath.StartsWith("/", StringComparison.Ordinal)
            ? callbackPath
            : $"/{callbackPath}";

        if (string.Equals(normalizedPath, "/", StringComparison.Ordinal))
        {
            return $"{backendUri.Scheme}://{backendUri.Authority}";
        }

        return $"{backendUri.Scheme}://{backendUri.Authority}{normalizedPath}";
    }
}
