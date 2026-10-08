using IDS.Project.Application.DTOs.ClickUp;

namespace IDS.Project.Application.Abstractions.Services;

public interface IClickUpTaskDiscoveryService
{
    Task<ClickUpDiscoveryStructureDto?> GetDiscoveryStructureAsync(
        string applicationUserId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ClickUpDiscoveredTaskDto>?> GetDiscoveredTasksAsync(
        string applicationUserId,
        string? listId = null,
        bool includeClosed = true,
        int limit = 100,
        CancellationToken cancellationToken = default);
}
