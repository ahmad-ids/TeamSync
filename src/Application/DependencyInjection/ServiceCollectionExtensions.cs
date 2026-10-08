using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace IDS.Project.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IWorkloadCalculator, WorkloadCalculator>();
        return services;
    }
}
