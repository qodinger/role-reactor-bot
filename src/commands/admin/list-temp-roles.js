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
  formatRemainingTime,
  getTemporaryRoles,
} from "../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

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
    // Lazy load storage manager to avoid circular dependencies
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storageManager = await getStorageManager();
    storageManager._clearCache();
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
        flags: 64,
      });
    }
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");
      return interaction.editReply({
        content: `❌ **Missing Bot Permissions**\nI need the following permissions: **${permissionNames}**\n\nPlease ensure I have the required permissions and try again.`,
        flags: 64,
      });
    }
    const targetUser = interaction.options.getUser("user");
    if (targetUser) {
      const userTempRoles = await getTemporaryRoles(interaction.guild.id);
      const userRoles = userTempRoles[targetUser.id] || {};
      const tempRoles = Object.entries(userRoles).map(([roleId, roleData]) => ({
        roleId,
        ...roleData,
      }));

      if (tempRoles.length === 0) {
        return interaction.editReply({
          content: `📋 **No Temporary Roles**\n${targetUser} has no temporary roles assigned.`,
          flags: 64,
        });
      }
      const embed = new EmbedBuilder()
        .setTitle(`⏰ Temporary Roles for ${targetUser.username}`)
        .setDescription(`Showing ${tempRoles.length} temporary role(s)`)
        .setColor(THEME_COLOR)
        .setTimestamp()
        .setFooter({
          text: "Role Reactor • Temporary Roles",
          iconURL: client.user.displayAvatarURL(),
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));
      for (const tempRole of tempRoles) {
        const role = interaction.guild.roles.cache.get(tempRole.roleId);
        const roleName = role ? role.name : `Unknown Role (${tempRole.roleId})`;
        const expiresAt = new Date(tempRole.expiresAt);
        const remainingTime = formatRemainingTime(tempRole.expiresAt);

        // Handle createdAt date safely
        let addedAtText = "Unknown";
        if (tempRole.createdAt) {
          const addedAt = new Date(tempRole.createdAt);
          if (!isNaN(addedAt.getTime())) {
            addedAtText = `<t:${Math.floor(addedAt.getTime() / 1000)}:R>`;
          }
        }

        embed.addFields({
          name: `🎭 ${roleName}`,
          value: [
            `**Role:** ${role || `Unknown (${tempRole.roleId})`}`,
            `**Added:** ${addedAtText}`,
            `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
            `**Time Left:** ${remainingTime}`,
          ].join("\n"),
          inline: true,
        });
      }
      await interaction.editReply({
        embeds: [embed],
        flags: 64,
      });
    } else {
      const allTempRoles = await getTemporaryRoles(interaction.guild.id);
      const guildTempRoles = Object.entries(allTempRoles).flatMap(
        ([userId, roles]) =>
          Object.entries(roles).map(([roleId, roleData]) => ({
            userId,
            roleId,
            ...roleData,
          })),
      );
      if (guildTempRoles.length === 0) {
        return interaction.editReply({
          content:
            "📋 **No Temporary Roles**\nThere are no temporary roles assigned in this server.",
          flags: 64,
        });
      }
      const userRoles = {};
      for (const tempRole of guildTempRoles) {
        if (!userRoles[tempRole.userId]) {
          userRoles[tempRole.userId] = [];
        }
        userRoles[tempRole.userId].push(tempRole);
      }
      const embed = new EmbedBuilder()
        .setTitle(`⏰ Temporary Roles in ${interaction.guild.name}`)
        .setDescription(
          `Showing ${guildTempRoles.length} temporary role(s) across ${Object.keys(userRoles).length} user(s)`,
        )
        .setColor(THEME_COLOR)
        .setTimestamp()
        .setFooter({
          text: "Role Reactor • Temporary Roles",
          iconURL: client.user.displayAvatarURL(),
        });
      const userEntries = Object.entries(userRoles).slice(0, 10);
      for (const [userId, roles] of userEntries) {
        try {
          const user = await client.users.fetch(userId);
          const roleList = roles
            .map(tempRole => {
              const role = interaction.guild.roles.cache.get(tempRole.roleId);
              const roleName = role
                ? role.name
                : `Unknown Role (${tempRole.roleId})`;
              const remainingTime = formatRemainingTime(tempRole.expiresAt);
              return `• **${roleName}** - ${remainingTime}`;
            })
            .join("\n");
          embed.addFields({
            name: `👤 ${user.username}`,
            value: roleList,
            inline: false,
          });
        } catch {
          embed.addFields({
            name: `👤 Unknown User (${userId})`,
            value: roles
              .map(tempRole => {
                const role = interaction.guild.roles.cache.get(tempRole.roleId);
                const roleName = role
                  ? role.name
                  : `Unknown Role (${tempRole.roleId})`;
                const remainingTime = formatRemainingTime(tempRole.expiresAt);
                return `• **${roleName}** - ${remainingTime}`;
              })
              .join("\n"),
            inline: false,
          });
        }
      }
      if (Object.keys(userRoles).length > 10) {
        embed.addFields({
          name: "📝 Note",
          value: `Showing first 10 users. There are ${Object.keys(userRoles).length - 10} more users with temporary roles.`,
          inline: false,
        });
      }
      await interaction.editReply({
        embeds: [embed],
        flags: 64,
      });
    }
  } catch (error) {
    logger.error("Error listing temporary roles", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while listing temporary roles. Please try again.",
      flags: 64,
    });
  }
}
