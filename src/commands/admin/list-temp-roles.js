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
import { getTemporaryRoles } from "../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("list-temp-roles")
  .setDescription("List temporary roles for a user or all users")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription(
        "The user to check temporary roles for (leave empty for all users)",
      )
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Calculate time remaining until a specific date
export function calculateTimeRemaining(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else {
    return "Less than a minute";
  }
}

// Get user information from guild
export async function getUserInfo(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    return {
      username: member.user.username,
      discriminator: member.user.discriminator,
      id: member.user.id,
    };
  } catch {
    return null;
  }
}

// Get role information from guild
export async function getRoleInfo(guild, roleId) {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return null;
  }

  return {
    name: role.name,
    color: role.color,
    id: role.id,
    position: role.position,
  };
}

// Re-export utility functions for tests
export { getTemporaryRoles };

export async function execute(interaction, client) {
  const logger = getLogger();

  await interaction.deferReply({ flags: 64 });
  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["Administrator"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Administrator permissions to view temporary roles.",
        }),
      );
    }

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
    const processedRoles = [];
    const now = new Date();

    for (const tempRole of tempRoles) {
      const expiresAt = new Date(tempRole.expiresAt);

      // Skip expired roles
      if (expiresAt <= now) {
        continue;
      }

      const userInfo = await getUserInfo(interaction.guild, tempRole.userId);
      const roleInfo = await getRoleInfo(interaction.guild, tempRole.roleId);

      if (userInfo && roleInfo) {
        const timeRemaining = calculateTimeRemaining(tempRole.expiresAt);
        processedRoles.push({
          ...tempRole,
          userInfo,
          roleInfo,
          timeRemaining,
        });
      }
    }

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
    const embed = new EmbedBuilder()
      .setTitle("🎭 Temporary Roles")
      .setDescription(
        targetUser
          ? `Active temporary roles for **${targetUser.username}**`
          : `Found **${processedRoles.length}** active temporary role${processedRoles.length !== 1 ? "s" : ""} in this server.`,
      )
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Temporary Roles",
        iconURL: client.user.displayAvatarURL(),
      });

    // Group by user if showing all roles
    if (!targetUser) {
      const userGroups = {};
      processedRoles.forEach(role => {
        if (!userGroups[role.userId]) {
          userGroups[role.userId] = [];
        }
        userGroups[role.userId].push(role);
      });

      for (const [, roles] of Object.entries(userGroups)) {
        const user = roles[0].userInfo;
        const roleList = roles
          .map(role => {
            const color = role.roleInfo.color
              ? `#${role.roleInfo.color.toString(16).padStart(6, "0")}`
              : "No color";
            return `• **${role.roleInfo.name}** - Expires in ${role.timeRemaining} (${color})`;
          })
          .join("\n");

        embed.addFields({
          name: `👤 ${user.username}`,
          value: roleList,
          inline: false,
        });
      }
    } else {
      // Show roles for specific user
      const roleList = processedRoles
        .map(role => {
          const color = role.roleInfo.color
            ? `#${role.roleInfo.color.toString(16).padStart(6, "0")}`
            : "No color";
          return `• **${role.roleInfo.name}** - Expires in ${role.timeRemaining} (${color})`;
        })
        .join("\n");

      embed.addFields({
        name: "🎭 Active Roles",
        value: roleList,
        inline: false,
      });
    }

    // Add helpful information
    embed.addFields({
      name: "💡 Management",
      value: [
        "• Use `/remove-temp-role` to remove roles early",
        "• Roles automatically expire after their set duration",
        "• Use `/assign-temp-role` to create new temporary roles",
      ].join("\n"),
      inline: false,
    });

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
