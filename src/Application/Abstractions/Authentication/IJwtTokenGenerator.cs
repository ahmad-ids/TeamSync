namespace IDS.Project.Application.Abstractions.Authentication;

public interface IJwtTokenGenerator
{
    string GenerateToken(string userId, string email, string fullName, IEnumerable<string> roles, DateTime expiresAtUtc);
}
