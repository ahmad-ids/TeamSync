using System.Net;

namespace IDS.Project.Infrastructure.Authentication;

public sealed class ClickUpApiException : Exception
{
    public ClickUpApiException(string endpoint, HttpStatusCode statusCode, string? details)
        : base(BuildMessage(endpoint, statusCode, details))
    {
        Endpoint = endpoint;
        StatusCode = statusCode;
        Details = details ?? string.Empty;
    }

    public string Endpoint { get; }

    public HttpStatusCode StatusCode { get; }

    public string Details { get; }

    private static string BuildMessage(string endpoint, HttpStatusCode statusCode, string? details)
    {
        return string.IsNullOrWhiteSpace(details)
            ? $"ClickUp request to '{endpoint}' failed with status code {(int)statusCode}."
            : $"ClickUp request to '{endpoint}' failed with status code {(int)statusCode}: {details.Trim()}";
    }
}
