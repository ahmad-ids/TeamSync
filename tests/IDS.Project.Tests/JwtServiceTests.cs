using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using IDS.Project.Infrastructure.Authentication;
using IDS.Project.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;

namespace IDS.Project.Tests;

public sealed class JwtServiceTests
{
    [Fact]
    public void GenerateToken_IncludesSubEmailAndRoleClaims()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "0123456789abcdef0123456789abcdef",
                ["Jwt:Issuer"] = "https://localhost:5202",
                ["Jwt:Audience"] = "http://localhost:5173",
                ["Jwt:ExpiresInMinutes"] = "60"
            })
            .Build();

        var service = new JwtService(configuration);
        var user = new ApplicationUser
        {
            Id = "user-123",
            Email = "user@example.com",
            FullName = "Example User"
        };

        var token = service.GenerateToken(user, ["Admin", "User"]);
        var parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("user-123", parsedToken.Claims.First(claim => claim.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal("user@example.com", parsedToken.Claims.First(claim => claim.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.Equal("user-123", parsedToken.Claims.First(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
        Assert.Contains(parsedToken.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == "Admin");
        Assert.Contains(parsedToken.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == "User");
    }

    [Fact]
    public void GenerateToken_UsesBackendAndFrontendBaseUrls_WhenIssuerAndAudienceAreNotExplicitlyConfigured()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "0123456789abcdef0123456789abcdef",
                ["Backend:BaseUrl"] = "https://localhost:5202",
                ["Frontend:BaseUrl"] = "http://localhost:5173"
            })
            .Build();

        var service = new JwtService(configuration);
        var user = new ApplicationUser
        {
            Id = "user-456",
            Email = "fallback@example.com",
            FullName = "Fallback User"
        };

        var token = service.GenerateToken(user, ["Member"]);
        var parsedToken = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("https://localhost:5202", parsedToken.Issuer);
        Assert.Contains(parsedToken.Audiences, audience => audience == "http://localhost:5173");
    }
}
