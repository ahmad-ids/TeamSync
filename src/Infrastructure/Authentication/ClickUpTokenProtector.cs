using IDS.Project.Application.Abstractions.Services;
using Microsoft.AspNetCore.DataProtection;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class ClickUpTokenProtector : IClickUpTokenProtector
{
    private const string Purpose = "ClickUp.AccessToken";

    private readonly IDataProtector protector;

    public ClickUpTokenProtector(IDataProtectionProvider provider)
    {
        protector = provider.CreateProtector(Purpose);
    }

    public string Protect(string accessToken)
    {
        return protector.Protect(accessToken);
    }

    public string Unprotect(string protectedAccessToken)
    {
        return protector.Unprotect(protectedAccessToken);
    }
}
