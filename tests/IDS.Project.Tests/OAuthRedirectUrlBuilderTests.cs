using IDS.Project.Infrastructure.DependencyInjection;

namespace IDS.Project.Tests;

public sealed class OAuthRedirectUrlBuilderTests
{
    [Fact]
    public void RewriteAuthorizationRedirectUri_ReplacesRedirectUriWithConfiguredBackendCallback()
    {
        var authorizationUrl =
            "https://github.com/login/oauth/authorize?client_id=test-client&scope=user%3Aemail&redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Fapi%2Fauth%2Fexternal%2Fgithub%2Fcallback";

        var rewrittenUrl = OAuthRedirectUrlBuilder.RewriteAuthorizationRedirectUri(
            authorizationUrl,
            "https://localhost:5202",
            "/api/auth/external/github/callback");

        var parsed = new Uri(rewrittenUrl);
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(parsed.Query);

        Assert.Equal(
            "https://localhost:5202/api/auth/external/github/callback",
            query["redirect_uri"].ToString());
        Assert.Equal("test-client", query["client_id"].ToString());
        Assert.Equal("user:email", query["scope"].ToString());
    }

    [Fact]
    public void BuildProviderRedirectUri_ReturnsNullWhenBackendBaseUrlIsInvalid()
    {
        var providerRedirectUri = OAuthRedirectUrlBuilder.BuildProviderRedirectUri(
            "not-a-url",
            "/api/auth/external/github/callback");

        Assert.Null(providerRedirectUri);
    }
}
