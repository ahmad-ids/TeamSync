namespace IDS.Project.Application.DTOs.Members;

public sealed record MemberPrioritySplitDto(
    string Priority,
    int TaskCount,
    double Weight);
