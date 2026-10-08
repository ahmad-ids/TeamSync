using IDS.Project.Domain.Entities;
using IDS.Project.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace IDS.Project.Infrastructure.Persistence;

public sealed class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Team> Teams => Set<Team>();

    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    public DbSet<TaskStatusHistory> TaskStatusHistories => Set<TaskStatusHistory>();

    public DbSet<TaskChangeRequest> TaskChangeRequests => Set<TaskChangeRequest>();

    public DbSet<TaskReassignmentRequest> TaskReassignmentRequests => Set<TaskReassignmentRequest>();

    public DbSet<WeightMultiplierSetting> WeightMultiplierSettings => Set<WeightMultiplierSetting>();

    public DbSet<ClickUpConnection> ClickUpConnections => Set<ClickUpConnection>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Team>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.LeaderId).HasMaxLength(450).IsRequired();
        });

        builder.Entity<TaskItem>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ExternalId).HasMaxLength(100);
            entity.Property(x => x.ExternalSource).HasMaxLength(50);
            entity.Property(x => x.AssignedMemberId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.CreatedById).HasMaxLength(450).IsRequired();
            entity.Property(x => x.RequiredSpecialization).HasConversion<int>();
            entity.Property(x => x.EstimatedEffortHours).HasPrecision(8, 2);
            entity.HasIndex(x => new { x.ExternalSource, x.ExternalId })
                .IsUnique()
                .HasFilter("[ExternalSource] IS NOT NULL AND [ExternalId] IS NOT NULL");
            entity.HasOne(x => x.Team)
                .WithMany(x => x.Tasks)
                .HasForeignKey(x => x.TeamId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<TaskStatusHistory>(entity =>
        {
            entity.Property(x => x.ChangedById).HasMaxLength(450).IsRequired();
            entity.HasOne(x => x.Task)
                .WithMany(x => x.StatusHistory)
                .HasForeignKey(x => x.TaskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TaskChangeRequest>(entity =>
        {
            entity.Property(x => x.RequesterId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.HasOne(x => x.Task)
                .WithMany(x => x.ChangeRequests)
                .HasForeignKey(x => x.TaskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TaskReassignmentRequest>(entity =>
        {
            entity.Property(x => x.RequestedById).HasMaxLength(450).IsRequired();
            entity.Property(x => x.CurrentAssigneeId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.ProposedAssigneeId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.FinalizedById).HasMaxLength(450);
            entity.HasOne(x => x.Task)
                .WithMany(x => x.ReassignmentRequests)
                .HasForeignKey(x => x.TaskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WeightMultiplierSetting>(entity =>
        {
            entity.Property(x => x.Category).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Key).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Value).HasPrecision(8, 2);
        });

        builder.Entity<ClickUpConnection>(entity =>
        {
            entity.Property(x => x.ApplicationUserId)
                .HasMaxLength(450)
                .IsRequired();

            entity.Property(x => x.TeamId);

            entity.Property(x => x.ClickUpUserId)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.WorkspaceId)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.WorkspaceName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.ProtectedAccessToken)
                .IsRequired();

            entity.HasIndex(x => new
                {
                    x.ApplicationUserId,
                    x.WorkspaceId
                })
                .IsUnique();

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.ApplicationUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<Team>()
                .WithMany()
                .HasForeignKey(x => x.TeamId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(x => x.ClickUpUserId).HasMaxLength(100);
            entity.HasIndex(x => x.ClickUpUserId)
                .IsUnique()
                .HasFilter("[ClickUpUserId] IS NOT NULL");
        });
    }
}
