using Microsoft.AspNetCore.Identity;

namespace IDS.Project.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser
{
    public string? ClickUpUserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public Guid? TeamId { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
