using Microsoft.EntityFrameworkCore;

namespace IDS.Project.Infrastructure.Persistence;

internal static class TaskReassignmentSchemaBootstrapper
{
    private const string MigrationId = "20260407183000_AddTaskReassignmentRequests";
    private const string ProductVersion = "8.0.14";

    public static async Task EnsureTaskReassignmentRequestsSchemaAsync(
        this ApplicationDbContext dbContext,
        CancellationToken cancellationToken = default)
    {
        if (!await TableExistsAsync(dbContext, "TaskReassignmentRequests", cancellationToken))
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                """
                IF OBJECT_ID(N'[dbo].[TaskReassignmentRequests]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[TaskReassignmentRequests] (
                        [Id] uniqueidentifier NOT NULL,
                        [TaskId] uniqueidentifier NOT NULL,
                        [RequestedById] nvarchar(450) NOT NULL,
                        [CurrentAssigneeId] nvarchar(450) NOT NULL,
                        [ProposedAssigneeId] nvarchar(450) NOT NULL,
                        [Reason] nvarchar(1000) NOT NULL,
                        [Status] int NOT NULL,
                        [CurrentAssigneeDecision] int NOT NULL,
                        [CurrentAssigneeRespondedAt] datetimeoffset NULL,
                        [ProposedAssigneeDecision] int NOT NULL,
                        [ProposedAssigneeRespondedAt] datetimeoffset NULL,
                        [FinalizedById] nvarchar(450) NULL,
                        [FinalizedAt] datetimeoffset NULL,
                        [CreatedAt] datetimeoffset NOT NULL,
                        [UpdatedAt] datetimeoffset NOT NULL,
                        CONSTRAINT [PK_TaskReassignmentRequests] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_TaskReassignmentRequests_Tasks_TaskId]
                            FOREIGN KEY ([TaskId]) REFERENCES [dbo].[Tasks] ([Id]) ON DELETE CASCADE
                    );

                    CREATE INDEX [IX_TaskReassignmentRequests_TaskId]
                        ON [dbo].[TaskReassignmentRequests] ([TaskId]);
                END
                """,
                cancellationToken);
        }

        await EnsureMigrationHistoryAsync(dbContext, cancellationToken);
    }

    private static async Task<bool> TableExistsAsync(
        ApplicationDbContext dbContext,
        string tableName,
        CancellationToken cancellationToken)
    {
        var result = await ExecuteScalarAsync<int?>(
            dbContext,
            "SELECT 1 FROM sys.tables WHERE name = @name;",
            ("@name", tableName),
            cancellationToken);

        return result.HasValue;
    }

    private static async Task EnsureMigrationHistoryAsync(
        ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var historyExists = await TableExistsAsync(dbContext, "__EFMigrationsHistory", cancellationToken);
        if (!historyExists)
        {
            return;
        }

        var applied = await ExecuteScalarAsync<string?>(
            dbContext,
            "SELECT [MigrationId] FROM [__EFMigrationsHistory] WHERE [MigrationId] = @migrationId;",
            ("@migrationId", MigrationId),
            cancellationToken);

        if (applied is not null)
        {
            return;
        }

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
            VALUES ({0}, {1});
            """,
            new object[] { MigrationId, ProductVersion },
            cancellationToken);
    }

    private static async Task<T?> ExecuteScalarAsync<T>(
        ApplicationDbContext dbContext,
        string commandText,
        (string Name, object Value) parameter,
        CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = commandText;
            var dbParameter = command.CreateParameter();
            dbParameter.ParameterName = parameter.Name;
            dbParameter.Value = parameter.Value;
            command.Parameters.Add(dbParameter);

            var value = await command.ExecuteScalarAsync(cancellationToken);
            if (value is null or DBNull)
            {
                return default;
            }

            return (T?)value;
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}
