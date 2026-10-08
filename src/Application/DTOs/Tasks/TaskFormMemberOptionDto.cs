using IDS.Project.Domain.Enums;

namespace IDS.Project.Application.DTOs.Tasks;

public sealed record TaskFormMemberOptionDto(
    string MemberId,
    string FullName,
    string Email,
    string JobTitle,
    TaskSpecialization Specialization,
    double CapacityPercentage,
    double AvailabilityPercentage,
    int ActiveTaskCount,
    WorkloadStatus WorkloadStatus);
