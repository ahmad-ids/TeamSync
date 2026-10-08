using System.Security.Claims;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ChangeRequests;
using IDS.Project.Domain.Constants;
using IDS.Project.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IDS.Project.Api.Controllers;

[ApiController]
[Route("api/change-requests")]
[Authorize]
public sealed class ChangeRequestsController(IChangeRequestService changeRequestService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "TeamLeader,Member")]
    public async Task<ActionResult<ChangeRequestListResponseDto>> GetChangeRequests(
        [FromQuery] ChangeRequestStatus? status,
        [FromQuery] ChangeRequestType? type,
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] Guid? taskId,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var result = await changeRequestService.GetChangeRequestsAsync(
            status,
            type,
            search,
            sort,
            currentUserId,
            User.IsInRole(RoleNames.Member),
            taskId,
            cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Member")]
    public async Task<ActionResult<ChangeRequestDto>> CreateChangeRequest([FromBody] CreateChangeRequestDto request, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await changeRequestService.CreateChangeRequestAsync(request, currentUserId, cancellationToken);
            if (result is null)
            {
                return NotFound();
            }

            return CreatedAtAction(nameof(GetChangeRequests), null, result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<ChangeRequestDto>> Approve(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await changeRequestService.ApproveAsync(id, currentUserId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<ChangeRequestDto>> Reject(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await changeRequestService.RejectAsync(id, currentUserId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }
}
