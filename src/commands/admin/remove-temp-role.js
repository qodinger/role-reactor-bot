import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/discord/permissions.js";
import {
  removeTemporaryRole,
  getUserTemporaryRoles,
} from "../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("remove-temp-role")
  .setDescription("Remove a temporary role from a user before it expires")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to remove the temporary role from")
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The temporary role to remove")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for removing the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Validate if a role is a temporary role for a user
export async function validateTemporaryRole(roleData) {
  const logger = getLogger();

  try {
    const tempRoles = await getUserTemporaryRoles(
      roleData.guildId,
      roleData.userId,
    );
    const tempRole = tempRoles.find(tr => tr.roleId === roleData.roleId);

    if (!tempRole) {
      return false;
    }

    // Check if the role has expired
    const now = new Date();
    const expiresAt = new Date(tempRole.expiresAt);
    if (expiresAt < now) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating temporary role", error);
    return false;
  }
}

// Remove role from user
export async function removeRoleFromUser(member, roleId) {
  const logger = getLogger();

  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
      return false;
    }

    if (!member.roles.cache.has(roleId)) {
      return false;
    }

    await member.roles.remove(role);
    return true;
  } catch (error) {
    logger.error("Error removing role from user", error);
    return false;
  }
}

// Remove temporary role data
export async function removeTemporaryRoleData(roleData) {
  const logger = getLogger();

  try {
    await removeTemporaryRole(
      roleData.guildId,
      roleData.userId,
      roleData.roleId,
    );
    return true;
  } catch (error) {
    logger.error("Error removing temporary role data", error);
    return false;
  }
}

export async function execute(interaction, client) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["Administrator"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Administrator permissions to remove temporary roles.",
        }),
      );
    }

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
    const embed = new EmbedBuilder()
      .setTitle("✅ Temporary Role Removed")
      .setDescription(
        `Successfully removed the **${targetRole.name}** role from **${targetUser.username}**.`,
      )
      .setColor(THEME_COLOR)
      .addFields(
        {
          name: "👤 User",
          value: `${targetUser.username} (${targetUser.id})`,
          inline: true,
        },
        {
          name: "🎭 Role",
          value: `${targetRole.name} (${targetRole.id})`,
          inline: true,
        },
        {
          name: "📝 Reason",
          value: reason,
          inline: true,
        },
        {
          name: "⏰ Removed At",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
      )
      .setFooter({
        text: "Role Reactor • Temporary Roles",
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

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
