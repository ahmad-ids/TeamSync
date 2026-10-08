namespace IDS.Project.Application.DTOs.Auth;

public enum RegisterFailureReason
{
    None = 0,
    Validation = 1,
    DuplicateEmail = 2
}

public sealed record RegisterResultDto(
    bool Succeeded,
    RegisterResponseDto? Account,
    string? Error,
    RegisterFailureReason FailureReason = RegisterFailureReason.None)
{
    public static RegisterResultDto Success(RegisterResponseDto account) => new(true, account, null);
    public static RegisterResultDto Validation(string error) => new(false, null, error, RegisterFailureReason.Validation);
    public static RegisterResultDto DuplicateEmail(string error) => new(false, null, error, RegisterFailureReason.DuplicateEmail);
}
