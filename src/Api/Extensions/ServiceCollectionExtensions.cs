using System.Text.Json.Serialization;

namespace IDS.Project.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPresentation(this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
        services.AddEndpointsApiExplorer();
        services.AddProblemDetails();
        services.AddCors(options =>
        {
            options.AddPolicy("Frontend", policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:5173",
                        "https://localhost:5173",
                        "http://127.0.0.1:5173",
                        "https://127.0.0.1:5173",
                        "http://localhost:4173",
                        "https://localhost:4173",
                        "http://127.0.0.1:4173",
                        "https://127.0.0.1:4173")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}
