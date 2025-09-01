import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
// Note: direct removal and retrieval are handled via utils methods used below
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createTempRoleRemovedEmbed } from "./embeds.js";
import {
  validateTemporaryRole,
  removeRoleFromUser,
  removeTemporaryRoleData,
} from "./utils.js";

/**
 * Handle the main remove temp role logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleRemoveTempRole(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: 64 });

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
        errorEmbed({
          title: "Missing Bot Permissions",
          description: `I need the following permissions to remove temporary roles: **${permissionNames}**`,
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
                "• Manage Roles (to remove roles from members)\n• Send Messages (to notify users about role removal)",
              inline: false,
            },
          ],
        }),
      );
    }

    // Get inputs
    const targetUser = interaction.options.getUser("user");
    const targetRole = interaction.options.getRole("role");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate user exists in server
    const member = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (!member) {
      return interaction.editReply(
        errorEmbed({
          title: "User Not Found",
          description: "The specified user is not a member of this server.",
          solution: "Please check the username and try again.",
          fields: [
            {
              name: "🔍 Troubleshooting",
              value:
                "• Make sure the user is still in your server\n• Check that you typed the username correctly\n• Try using the user's ID instead of username",
              inline: false,
            },
          ],
        }),
      );
    }

    // Check if user has the role
    if (!member.roles.cache.has(targetRole.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "User Doesn't Have Role",
          description: `The user ${targetUser.username} doesn't have the ${targetRole.name} role.`,
          solution:
            "Please check that the user has the role you want to remove.",
          fields: [
            {
              name: "💡 Tip",
              value:
                "You can use `/list-temp-roles` to see all active temporary roles and their users.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Validate that it's a temporary role
    const roleData = {
      guildId: interaction.guild.id,
      userId: targetUser.id,
      roleId: targetRole.id,
    };

    const isValidTempRole = await validateTemporaryRole(roleData);
    if (!isValidTempRole) {
      return interaction.editReply(
        errorEmbed({
          title: "Not a Temporary Role",
          description: `The ${targetRole.name} role is not a temporary role for ${targetUser.username}.`,
          solution:
            "You can only remove temporary roles that were assigned using `/assign-temp-role`.",
          fields: [
            {
              name: "🔍 What's a Temporary Role?",
              value:
                "• Temporary roles are assigned with `/assign-temp-role`\n• They have an expiration time\n• They're different from regular server roles",
              inline: false,
            },
            {
              name: "💡 Tip",
              value:
                "Use `/list-temp-roles` to see all active temporary roles in your server.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Remove the role
    const roleRemoved = await removeRoleFromUser(member, targetRole.id);
    if (!roleRemoved) {
      return interaction.editReply(
        errorEmbed({
          title: "Failed to Remove Role",
          description:
            "I couldn't remove the role from the user. This might be due to permission issues.",
          solution:
            "Please check that I have permission to manage this role and try again.",
          fields: [
            {
              name: "🔧 Quick Fix",
              value:
                "• Make sure my role is above the target role in the role hierarchy\n• Check that I have 'Manage Roles' permission\n• Verify the role still exists",
              inline: false,
            },
          ],
        }),
      );
    }

    // Remove temporary role data
    const dataRemoved = await removeTemporaryRoleData(roleData);
    if (!dataRemoved) {
      logger.warn("Failed to remove temporary role data", {
        guildId: interaction.guild.id,
        userId: targetUser.id,
        roleId: targetRole.id,
      });
    }

    // Send success message
    const embed = createTempRoleRemovedEmbed(
      interaction,
      targetUser,
      targetRole,
      reason,
    );

    await interaction.editReply({ embeds: [embed] });

    // Log successful command execution
    const duration = Date.now() - startTime;
    logger.logCommand("remove-temp-role", interaction.user.id, duration, true);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error removing temporary role", error);
    logger.logCommand("remove-temp-role", interaction.user.id, duration, false);

    await interaction.editReply(
      errorEmbed({
        title: "Removal Failed",
        description:
          "Something went wrong while removing the temporary role. This might be due to a temporary issue.",
        solution:
          "Please try again in a moment. If the problem persists, check that I have the necessary permissions.",
        fields: [
          {
            name: "🔧 Quick Fix",
            value:
              "• Make sure I have 'Manage Roles' permission\n• Check that the role and user still exist\n• Verify your internet connection is stable",
            inline: false,
          },
        ],
      }),
    );
  }
}
