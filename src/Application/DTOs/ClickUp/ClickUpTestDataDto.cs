namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpTestDataDto(
    bool ConnectionFound,
    string WorkspaceId,
    string WorkspaceName,
    bool MembersRequestSucceeded,
    int MembersCount,
    IReadOnlyCollection<ClickUpTestMemberDto> Members,
    bool StructureRequestSucceeded,
    int SpacesCount,
    int FoldersCount,
    int ListsCount,
    bool TasksRequestSucceeded,
    int TasksCount,
    IReadOnlyCollection<ClickUpTestTaskDto> SampleTasks,
    IReadOnlyCollection<string> Errors);
