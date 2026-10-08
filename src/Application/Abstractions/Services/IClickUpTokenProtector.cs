using System;

namespace IDS.Project.Application.Abstractions.Services;

public interface IClickUpTokenProtector
{
    string Protect(string accessToken);

    string Unprotect(string protectedAccessToken);
}
