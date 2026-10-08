using IDS.Project.Api.Extensions;
using IDS.Project.Application.DependencyInjection;
using IDS.Project.Infrastructure.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddPresentation();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

await app.Services.InitializeInfrastructureAsync();
await app.Services.ValidateOAuthConfigurationAsync();

app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
