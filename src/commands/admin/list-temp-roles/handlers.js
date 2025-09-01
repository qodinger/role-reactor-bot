import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import { getTemporaryRoles } from "../../../utils/discord/temporaryRoles.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createTempRolesListEmbed } from "./embeds.js";
import { processTempRoles } from "./utils.js";

/**
 * Handle the main list temp roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleListTempRoles(interaction, client) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    // Check bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
        errorEmbed({
          title: "Missing Bot Permissions",
          description: `I need the following permissions to view temporary roles: **${permissionNames}**`,
          solution:
            "Please ask a server administrator to grant me these permissions and try again.",
          fields: [
            {
              name: "🔧 How to Fix",
              value:
                "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
              inline: false,
            },
            {
              name: "📋 Required Permissions",
              value:
                "• View Channels (to access server information)\n• Read Message History (to view role information)",
              inline: false,
            },
          ],
        }),
      );
    }

    const targetUser = interaction.options.getUser("user");

    let tempRoles;
    if (targetUser) {
      // Get temporary roles for specific user
      tempRoles = await getTemporaryRoles(interaction.guild.id, targetUser.id);

      if (!tempRoles || tempRoles.length === 0) {
        return interaction.editReply(
          errorEmbed({
            title: "No Temporary Roles Found",
            description: `${targetUser.username} doesn't have any active temporary roles.`,
            solution:
              "Temporary roles are assigned using `/assign-temp-role` and automatically expire after their set duration.",
            fields: [
              {
                name: "💡 How to Assign",
                value:
                  "Use `/assign-temp-role` to give users temporary roles with automatic expiration.",
                inline: false,
              },
              {
                name: "📝 Example",
                value:
                  "`/assign-temp-role users:@user role:Event Role duration:2h reason:Event access`",
                inline: false,
              },
            ],
          }),
        );
      }
    } else {
      // Get all temporary roles
      tempRoles = await getTemporaryRoles(interaction.guild.id);

      if (!tempRoles || tempRoles.length === 0) {
        return interaction.editReply(
          errorEmbed({
            title: "No Temporary Roles Found",
            description: "There are no active temporary roles in this server.",
            solution:
              "Temporary roles are assigned using `/assign-temp-role` and automatically expire after their set duration.",
            fields: [
              {
                name: "🎯 Getting Started",
                value:
                  "Create temporary roles to give users time-limited access to channels or permissions!",
                inline: false,
              },
              {
                name: "📝 Quick Setup",
                value:
                  "`/assign-temp-role users:@user role:Event Role duration:2h reason:Event access`",
                inline: false,
              },
              {
                name: "⏰ Duration Examples",
                value:
                  "• `30m` - 30 minutes\n• `2h` - 2 hours\n• `1d` - 1 day\n• `1w` - 1 week",
                inline: false,
              },
            ],
          }),
        );
      }
    }

    // Ensure tempRoles is an array
    if (!Array.isArray(tempRoles)) {
      tempRoles = [];
    }

    // Process temporary roles
    const processedRoles = await processTempRoles(interaction.guild, tempRoles);

    if (processedRoles.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Active Temporary Roles",
          description: targetUser
            ? `${targetUser.username} has no active temporary roles.`
            : "There are no active temporary roles in this server.",
          solution: "All temporary roles may have expired or been removed.",
          fields: [
            {
              name: "💡 Tip",
              value:
                "Temporary roles automatically expire after their set duration. Use `/assign-temp-role` to create new ones.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Create embed
    const embed = createTempRolesListEmbed(
      interaction,
      client,
      processedRoles,
      targetUser,
    );

    await interaction.editReply({ embeds: [embed] });

    // Log successful command execution
    logger.logCommand("list-temp-roles", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error listing temporary roles", error);
    logger.logCommand(
      "list-temp-roles",
      interaction.user.id,
      Date.now(),
      false,
    );

    await interaction.editReply(
      errorEmbed({
        title: "Listing Failed",
        description:
          "Something went wrong while retrieving temporary roles. This might be due to a temporary issue.",
        solution:
          "Please try again in a moment. If the problem persists, check that I have the necessary permissions.",
        fields: [
          {
            name: "🔧 Quick Fix",
            value:
              "• Make sure I have permission to view server members\n• Check that the database connection is working\n• Verify your internet connection is stable",
            inline: false,
          },
        ],
      }),
    );
  }
}
