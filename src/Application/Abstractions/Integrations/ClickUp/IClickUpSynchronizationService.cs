using IDS.Project.Application.DTOs.ClickUp;

namespace IDS.Project.Application.Abstractions.Integrations.ClickUp;

public interface IClickUpSynchronizationService
{
    Task<ClickUpSyncResult> SynchronizeAsync(
        Guid currentUserId,
        CancellationToken cancellationToken);
}
