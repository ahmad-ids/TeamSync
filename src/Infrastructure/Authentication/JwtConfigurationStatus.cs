using Microsoft.Extensions.Configuration;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class JwtConfigurationStatus
{
    private JwtConfigurationStatus(bool isConfigured, IReadOnlyList<string> missingSettings)
    {
        IsConfigured = isConfigured;
        MissingSettings = missingSettings;
    }

    public bool IsConfigured { get; }

    public IReadOnlyList<string> MissingSettings { get; }

    public string ErrorMessage => MissingSettings.Count == 0
        ? string.Empty
        : $"JWT configuration is incomplete. Missing: {string.Join(", ", MissingSettings)}.";

    public static JwtConfigurationStatus FromConfiguration(IConfiguration configuration)
    {
        var missingSettings = new List<string>();

        if (string.IsNullOrWhiteSpace(configuration["Jwt:Key"]))
        {
            missingSettings.Add("Jwt:Key");
        }

        return new JwtConfigurationStatus(missingSettings.Count == 0, missingSettings);
    }
}
