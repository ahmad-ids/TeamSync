using IDS.Project.Application.DTOs.Tasks;

namespace IDS.Project.Application.Abstractions.Services;

public interface ITaskWorkflowService
{
    Task<bool> DeleteTaskAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<TaskDetailsDto?> ReassignTaskAsync(
        Guid taskId,
        CreateTaskReassignmentRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<bool> AcknowledgeTaskAsync(
        Guid taskId,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<TaskDetailsDto?> UpdateTaskStatusAsync(
        Guid taskId,
        UpdateTaskStatusDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);
}
