using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Project.Infrastructure.Persistence.Migrations;

public partial class AddTaskReassignmentRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "TaskReassignmentRequests",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                TaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                RequestedById = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                CurrentAssigneeId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                ProposedAssigneeId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                Status = table.Column<int>(type: "int", nullable: false),
                CurrentAssigneeDecision = table.Column<int>(type: "int", nullable: false),
                CurrentAssigneeRespondedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                ProposedAssigneeDecision = table.Column<int>(type: "int", nullable: false),
                ProposedAssigneeRespondedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                FinalizedById = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                FinalizedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TaskReassignmentRequests", x => x.Id);
                table.ForeignKey(
                    name: "FK_TaskReassignmentRequests_Tasks_TaskId",
                    column: x => x.TaskId,
                    principalTable: "Tasks",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_TaskReassignmentRequests_TaskId",
            table: "TaskReassignmentRequests",
            column: "TaskId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "TaskReassignmentRequests");
    }
}
