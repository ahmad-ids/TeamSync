namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskFormOptionsDto(
    Guid TeamId,
    string TeamName,
    TaskFormMemberOptionDto[] Members);
