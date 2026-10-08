using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace IDS.Project.Infrastructure.Persistence;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseSqlServer(
            "Server=.\\SQLEXPRESS;Database=IdsProjectDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;Encrypt=False");

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
