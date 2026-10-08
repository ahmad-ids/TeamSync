using DomainTaskStatus = IDS.Project.Domain.Enums.TaskStatus;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record UpdateTaskStatusDto(DomainTaskStatus Status);
