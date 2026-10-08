using System.Security.Claims;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Members;
using IDS.Project.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IDS.Project.Api.Controllers;

[ApiController]
[Route("api/members")]
[Authorize]
public sealed class MembersController(IWorkloadQueryService workloadQueryService) : ControllerBase
{
    [HttpGet("me/workload")]
    [Authorize(Roles = "Member")]
    public async Task<ActionResult<MemberWorkloadDetailsDto>> GetCurrentMemberWorkload(
        [FromQuery] string period = "thisWeek",
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var details = await workloadQueryService.GetMemberDetailsAsync(
            currentUserId,
            currentUserId,
            period,
            startDate,
            endDate,
            includeCompletedTasks: true,
            cancellationToken);

        return details is null ? NotFound() : Ok(details);
    }

    [HttpGet("{id}/workload")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<MemberWorkloadDetailsDto>> GetMemberWorkload(
        string id,
        [FromQuery] string period = "thisWeek",
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var details = await workloadQueryService.GetMemberDetailsAsync(
            id,
            currentUserId,
            period,
            startDate,
            endDate,
            includeCompletedTasks: true,
            cancellationToken);

        return details is null ? NotFound() : Ok(details);
    }
}
