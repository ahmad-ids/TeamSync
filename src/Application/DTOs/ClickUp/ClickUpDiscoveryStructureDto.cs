namespace IDS.Project.Application.DTOs.ClickUp;

public sealed record ClickUpDiscoveryStructureDto(
    string WorkspaceId,
    string WorkspaceName,
    IReadOnlyCollection<ClickUpSpaceDto> Spaces,
    IReadOnlyCollection<ClickUpFolderDto> Folders,
    IReadOnlyCollection<ClickUpListDto> Lists,
    int SpaceCount,
    int FolderCount,
    int ListCount);
