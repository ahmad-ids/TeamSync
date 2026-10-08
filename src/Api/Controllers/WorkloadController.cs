using System.Security.Claims;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.Workload;
using IDS.Project.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IDS.Project.Api.Controllers;

[ApiController]
[Route("api/workload")]
[Authorize(Roles = "TeamLeader,Member")]
public sealed class WorkloadController(IWorkloadQueryService workloadQueryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WorkloadSummaryDto>> GetSummary(
        [FromQuery] string period = "thisWeek",
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] Guid? teamId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "workload",
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var summary = await workloadQueryService.GetSummaryAsync(
            currentUserId,
            period,
            startDate,
            endDate,
            teamId,
            search,
            sortBy,
            cancellationToken);

        return Ok(summary);
    }
}
