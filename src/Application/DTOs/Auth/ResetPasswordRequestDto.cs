namespace IDS.Project.Application.DTOs.Auth;

public sealed record ResetPasswordRequestDto(
    string Email,
    string Token,
    string Password,
    string ConfirmPassword);
