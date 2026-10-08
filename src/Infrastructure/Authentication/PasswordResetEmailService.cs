using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IDS.Project.Infrastructure.Authentication;

public interface IPasswordResetEmailService
{
    Task SendPasswordResetEmailAsync(
        string recipientEmail,
        string recipientName,
        string resetUrl,
        CancellationToken cancellationToken = default);
}

public sealed class PasswordResetEmailService(
    IConfiguration configuration,
    IHostEnvironment hostEnvironment,
    ILogger<PasswordResetEmailService> logger) : IPasswordResetEmailService
{
    private string? pickupDirectoryPath;

    public async Task SendPasswordResetEmailAsync(
        string recipientEmail,
        string recipientName,
        string resetUrl,
        CancellationToken cancellationToken = default)
    {
        using var message = new MailMessage
        {
            From = BuildFromAddress(),
            Subject = "Reset your IDS account password",
        };

        message.To.Add(new MailAddress(recipientEmail));
        message.Body = BuildPlainTextBody(recipientName, resetUrl);
        message.IsBodyHtml = false;
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
            BuildPlainTextBody(recipientName, resetUrl),
            null,
            "text/plain"));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
            BuildHtmlBody(recipientName, resetUrl),
            null,
            "text/html"));

        using var client = BuildClient();
        await client.SendMailAsync(message, cancellationToken);

        if (!string.IsNullOrWhiteSpace(pickupDirectoryPath))
        {
            logger.LogInformation(
                "Password reset email for {RecipientEmail} was written to {PickupDirectory}. Open the newest .eml file there to test the reset link locally.",
                recipientEmail,
                pickupDirectoryPath);
        }
    }

    private SmtpClient BuildClient()
    {
        var host = configuration["Email:Smtp:Host"]?.Trim();
        if (!string.IsNullOrWhiteSpace(host))
        {
            var port = int.TryParse(configuration["Email:Smtp:Port"], out var parsedPort) ? parsedPort : 587;
            var enableSsl = !string.Equals(configuration["Email:Smtp:EnableSsl"], "false", StringComparison.OrdinalIgnoreCase);
            var useDefaultCredentials = string.Equals(
                configuration["Email:Smtp:UseDefaultCredentials"],
                "true",
                StringComparison.OrdinalIgnoreCase);
            var username = configuration["Email:Smtp:Username"]?.Trim();
            var password = configuration["Email:Smtp:Password"];

            var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000,
                UseDefaultCredentials = useDefaultCredentials
            };

            if (!useDefaultCredentials && !string.IsNullOrWhiteSpace(username))
            {
                client.Credentials = new NetworkCredential(username, password ?? string.Empty);
            }

            logger.LogInformation(
                "SMTP delivery is enabled for password reset emails. Host: {Host}, Port: {Port}, SSL: {EnableSsl}, UsernameConfigured: {HasUsername}, DefaultCredentials: {UseDefaultCredentials}.",
                host,
                port,
                enableSsl,
                !string.IsNullOrWhiteSpace(username),
                useDefaultCredentials);

            return client;
        }

        var pickupDirectory = configuration["Email:PickupDirectory"]?.Trim();
        if (string.IsNullOrWhiteSpace(pickupDirectory))
        {
            pickupDirectory = Path.Combine(hostEnvironment.ContentRootPath, "App_Data", "Emails");
        }

        Directory.CreateDirectory(pickupDirectory);
        pickupDirectoryPath = pickupDirectory;

        logger.LogInformation(
            "SMTP host is not configured. Password reset emails will be written to pickup directory {PickupDirectory}.",
            pickupDirectory);

        return new SmtpClient
        {
            DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory,
            PickupDirectoryLocation = pickupDirectory
        };
    }

    private MailAddress BuildFromAddress()
    {
        var fromAddress = configuration["Email:FromAddress"]?.Trim();
        if (string.IsNullOrWhiteSpace(fromAddress))
        {
            fromAddress = "no-reply@ids.local";
        }

        var fromName = configuration["Email:FromName"]?.Trim();
        return string.IsNullOrWhiteSpace(fromName)
            ? new MailAddress(fromAddress)
            : new MailAddress(fromAddress, fromName);
    }

    private static string BuildHtmlBody(string recipientName, string resetUrl)
    {
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(recipientName) ? "there" : recipientName);
        var safeUrl = WebUtility.HtmlEncode(resetUrl);

        return $"""
                <html>
                  <body style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.6;">
                    <p>Hello {safeName},</p>
                    <p>We received a request to reset your IDS account password.</p>
                    <p>
                      <a href="{safeUrl}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;">
                        Reset Password
                      </a>
                    </p>
                    <p>If you did not request this, you can ignore this email.</p>
                    <p>This link will expire automatically.</p>
                  </body>
                </html>
                """;
    }

    private static string BuildPlainTextBody(string recipientName, string resetUrl)
    {
        var resolvedName = string.IsNullOrWhiteSpace(recipientName) ? "there" : recipientName;
        return
$"Hello {resolvedName},{Environment.NewLine}{Environment.NewLine}" +
$"We received a request to reset your IDS account password.{Environment.NewLine}{Environment.NewLine}" +
$"Reset your password using this link:{Environment.NewLine}{resetUrl}{Environment.NewLine}{Environment.NewLine}" +
$"If you did not request this, you can ignore this email.{Environment.NewLine}" +
"This link will expire automatically.";
    }
}
