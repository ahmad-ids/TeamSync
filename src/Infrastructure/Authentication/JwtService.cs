using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IDS.Project.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class JwtService(IConfiguration configuration)
{
    public string GenerateToken(ApplicationUser user, IList<string> roles)
    {
        return GenerateToken(user, roles, null);
    }

    public string GenerateToken(ApplicationUser user, IList<string> roles, DateTime? expiresAtUtc)
    {
        var email = user.Email ?? throw new InvalidOperationException("JWT email is missing.");
        var key = JwtConfigurationResolver.ResolveSigningKey(configuration);
        var issuer = JwtConfigurationResolver.ResolveIssuer(configuration);
        var audience = JwtConfigurationResolver.ResolveAudience(configuration);
        var expiresInMinutes = int.TryParse(configuration["Jwt:ExpiresInMinutes"], out var parsedMinutes)
            ? parsedMinutes
            : 60;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrWhiteSpace(user.FullName))
        {
            claims.Add(new Claim(ClaimTypes.Name, user.FullName));
        }

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: expiresAtUtc ?? DateTime.UtcNow.AddMinutes(expiresInMinutes),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
