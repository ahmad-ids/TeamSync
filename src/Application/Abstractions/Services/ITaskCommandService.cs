using IDS.Project.Application.DTOs.Tasks;

namespace IDS.Project.Application.Abstractions.Services;

public interface ITaskCommandService
{
    Task<TaskFormOptionsDto?> GetFormOptionsAsync(
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<TaskPreviewDto?> GetTaskPreviewAsync(
        TaskPreviewRequestDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<TaskDetailsDto?> CreateTaskAsync(
        UpsertTaskDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);

    Task<TaskDetailsDto?> UpdateTaskAsync(
        Guid taskId,
        UpsertTaskDto request,
        string currentUserId,
        CancellationToken cancellationToken = default);
}
