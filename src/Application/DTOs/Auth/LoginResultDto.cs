namespace IDS.Project.Application.DTOs.Auth;

public enum LoginFailureReason
{
    None = 0,
    AccountNotFound = 1,
    InvalidCredentials = 2,
    ExternalAuthFailed = 3
}

public sealed record LoginResultDto(
    bool Succeeded,
    LoginResponseDto? Session,
    string? Error,
    LoginFailureReason FailureReason = LoginFailureReason.None)
{
    public static LoginResultDto Success(LoginResponseDto session) => new(true, session, null);
    public static LoginResultDto AccountNotFound(string error) => new(false, null, error, LoginFailureReason.AccountNotFound);
    public static LoginResultDto InvalidCredentials(string error) => new(false, null, error, LoginFailureReason.InvalidCredentials);
    public static LoginResultDto ExternalAuthFailed(string error) => new(false, null, error, LoginFailureReason.ExternalAuthFailed);
}
