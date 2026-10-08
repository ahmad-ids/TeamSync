using System.Security.Claims;
using IDS.Project.Application.Abstractions.Services;
using IDS.Project.Application.DTOs.ChangeRequests;
using IDS.Project.Application.DTOs.Tasks;
using IDS.Project.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IDS.Project.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController(
    ITaskQueryService taskQueryService,
    ITaskCommandService taskCommandService,
    ITaskWorkflowService taskWorkflowService,
    IChangeRequestService changeRequestService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskListItemDto>>> GetTasks(CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var tasks = await taskQueryService.GetTasksAsync(
            currentUserId,
            User.IsInRole(RoleNames.TeamLeader),
            cancellationToken);

        return Ok(tasks);
    }

    [HttpGet("form-options")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<TaskFormOptionsDto>> GetFormOptions(CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var options = await taskCommandService.GetFormOptionsAsync(currentUserId, cancellationToken);
        return options is null ? NotFound() : Ok(options);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TaskDetailsDto>> GetTask(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var details = await taskQueryService.GetTaskDetailsAsync(
            id,
            currentUserId,
            User.IsInRole(RoleNames.TeamLeader),
            cancellationToken);

        return details is null ? NotFound() : Ok(details);
    }

    [HttpGet("{id:guid}/change-request-options")]
    [Authorize(Roles = "Member")]
    public async Task<ActionResult<ChangeRequestOptionsDto>> GetChangeRequestOptions(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var options = await changeRequestService.GetChangeRequestOptionsAsync(id, currentUserId, cancellationToken);
        return options is null ? NotFound() : Ok(options);
    }

    [HttpPost("preview")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<TaskPreviewDto>> PreviewTask([FromBody] TaskPreviewRequestDto request, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var preview = await taskCommandService.GetTaskPreviewAsync(request, currentUserId, cancellationToken);
            return preview is null ? NotFound() : Ok(preview);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpPost]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<TaskDetailsDto>> CreateTask([FromBody] UpsertTaskDto request, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await taskCommandService.CreateTaskAsync(request, currentUserId, cancellationToken);
            if (result is null)
            {
                return NotFound();
            }

            return CreatedAtAction(nameof(GetTask), new { id = result.Id }, result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<TaskDetailsDto>> UpdateTask(Guid id, [FromBody] UpsertTaskDto request, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await taskCommandService.UpdateTaskAsync(id, request, currentUserId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<IActionResult> DeleteTask(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var deleted = await taskWorkflowService.DeleteTaskAsync(id, currentUserId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
        catch (Exception exception)
        {
            return Problem(detail: exception.GetBaseException().Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    [HttpPost("{id:guid}/reassign")]
    [Authorize(Roles = "TeamLeader")]
    public async Task<ActionResult<TaskDetailsDto>> ReassignTask(
        Guid id,
        [FromBody] CreateTaskReassignmentRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await taskWorkflowService.ReassignTaskAsync(id, request, currentUserId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }

    [HttpPost("{id:guid}/acknowledge")]
    [Authorize(Roles = "Member")]
    public async Task<IActionResult> AcknowledgeTask(Guid id, CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        var acknowledged = await taskWorkflowService.AcknowledgeTaskAsync(id, currentUserId, cancellationToken);
        return acknowledged ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Roles = "Member")]
    public async Task<ActionResult<TaskDetailsDto>> UpdateTaskStatus(
        Guid id,
        [FromBody] UpdateTaskStatusDto request,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await taskWorkflowService.UpdateTaskStatusAsync(id, request, currentUserId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(detail: exception.Message);
        }
    }
}
