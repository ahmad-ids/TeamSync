using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Project.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskItemExternalSyncFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Tasks",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "Tasks",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_ExternalSource_ExternalId",
                table: "Tasks",
                columns: new[] { "ExternalSource", "ExternalId" },
                unique: true,
                filter: "[ExternalSource] IS NOT NULL AND [ExternalId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_ExternalSource_ExternalId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "Tasks");
        }
    }
}
