using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Project.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClickUpConnections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClickUpConnections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    ClickUpUserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WorkspaceId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    WorkspaceName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProtectedAccessToken = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClickUpConnections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClickUpConnections_AspNetUsers_ApplicationUserId",
                        column: x => x.ApplicationUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClickUpConnections_ApplicationUserId_WorkspaceId",
                table: "ClickUpConnections",
                columns: new[] { "ApplicationUserId", "WorkspaceId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClickUpConnections");
        }
    }
}
