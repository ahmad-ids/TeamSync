namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpTestTaskDto(
    string Id,
    string Name,
    string Status,
    IReadOnlyCollection<string> AssigneeEmails,
    DateTimeOffset? DueDate,
    long? TimeEstimate);
