using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Project.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClickUpWorkspaceTeamMappingAndUserClickUpId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TeamId",
                table: "ClickUpConnections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClickUpUserId",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClickUpConnections_TeamId",
                table: "ClickUpConnections",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_ClickUpUserId",
                table: "AspNetUsers",
                column: "ClickUpUserId",
                unique: true,
                filter: "[ClickUpUserId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_ClickUpConnections_Teams_TeamId",
                table: "ClickUpConnections",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClickUpConnections_Teams_TeamId",
                table: "ClickUpConnections");

            migrationBuilder.DropIndex(
                name: "IX_ClickUpConnections_TeamId",
                table: "ClickUpConnections");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_ClickUpUserId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "ClickUpConnections");

            migrationBuilder.DropColumn(
                name: "ClickUpUserId",
                table: "AspNetUsers");
        }
    }
}
