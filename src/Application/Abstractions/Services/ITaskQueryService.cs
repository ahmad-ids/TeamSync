using IDS.Project.Application.DTOs.Tasks;

namespace IDS.Project.Application.Abstractions.Services;

public interface ITaskQueryService
{
    Task<TaskListItemDto[]> GetTasksAsync(
        string currentUserId,
        bool isTeamLeader,
        CancellationToken cancellationToken = default);

    Task<TaskDetailsDto?> GetTaskDetailsAsync(
        Guid taskId,
        string currentUserId,
        bool isTeamLeader,
        CancellationToken cancellationToken = default);
}
