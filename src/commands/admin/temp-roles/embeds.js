import { EmbedBuilder } from "discord.js";
import {
  formatDuration,
  parseDuration,
} from "../../../utils/discord/tempRoles.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Create the temporary role assignment embed
 * @param {import('discord.js').Role} role
 * @param {Array} users
 * @param {string} durationString
 * @param {string} reason
 * @param {Array} results
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleEmbed(
  role,
  users,
  durationString,
  reason,
  results,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Role Assigned`)
    .setDescription(
      `**${role.name}** role assigned to **${users.length}** user${users.length !== 1 ? "s" : ""}`,
    )
    .setColor(role.color || THEME.SUCCESS)
    .setThumbnail(role.iconURL() || null)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  // Role details and assignment info
  embed.addFields([
    {
      name: `${EMOJIS.FEATURES.ROLES} Role Details`,
      value: [
        `**Name:** ${role.name}`,
        `**Mention:** ${role.toString()}`,
        `**Color:** ${role.hexColor}`,
        `**Position:** ${role.position}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: `${EMOJIS.TIME.ALARM} Assignment Info`,
      value: [
        `**Duration:** ${formatDuration(durationString)}`,
        `**Users:** ${users.length} user${users.length !== 1 ? "s" : ""}`,
        `**Expires:** <t:${Math.floor((Date.now() + parseDuration(durationString)) / 1000)}:R>`,
        `**Reason:** ${reason || "No reason provided"}`,
      ].join("\n"),
      inline: true,
    },
  ]);

  // Add results if available
  if (results && results.length > 0) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const updateCount = results.filter(r => r.success && r.wasUpdate).length;
    const newCount = successCount - updateCount;

    // Detailed results summary
    let resultsText = `${EMOJIS.STATUS.SUCCESS} **${successCount}** successful`;
    if (updateCount > 0) {
      resultsText += ` (${newCount} new, ${updateCount} updated)`;
    }
    if (failureCount > 0) {
      resultsText += `\n${EMOJIS.STATUS.ERROR} **${failureCount}** failed`;
    }

    embed.addFields({
      name: `${EMOJIS.UI.PROGRESS} Assignment Results`,
      value: resultsText,
      inline: false,
    });

    // Add detailed failures if any
    if (failureCount > 0) {
      const failedResults = results.filter(r => !r.success);
      const failureText = failedResults
        .map(r => `• <@${r.user.id}>: ${r.error}`)
        .join("\n")
        .slice(0, 1000);

      embed.addFields({
        name: `${EMOJIS.STATUS.ERROR} Failed Assignments`,
        value: failureText || "No details available",
        inline: false,
      });
    }
  }

  return embed;
}

/**
 * Create the temporary roles list embed
 * @param {Array} processedRoles
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRolesListEmbed(
  processedRoles,
  targetUser,
  guild,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.UI.MENU} Temporary Roles`)
    .setDescription(
      targetUser
        ? `Active roles for **${targetUser.username}**`
        : `**${processedRoles.length}** active role${processedRoles.length !== 1 ? "s" : ""} in this server`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  if (processedRoles.length === 0) {
    embed.addFields({
      name: `${EMOJIS.UI.EMPTY} No Active Roles`,
      value: "No temporary roles found",
      inline: false,
    });
  } else {
    // Group by user if showing all roles
    if (!targetUser) {
      const userGroups = {};
      processedRoles.forEach(role => {
        if (!userGroups[role.userId]) {
          userGroups[role.userId] = [];
        }
        userGroups[role.userId].push(role);
      });

      // Sort users by username for consistent display
      const sortedUsers = Object.entries(userGroups).sort((a, b) =>
        a[1][0].userInfo.username.localeCompare(b[1][0].userInfo.username),
      );

      for (const [, roles] of sortedUsers) {
        const user = roles[0].userInfo;
        const roleList = roles
          .map(role => {
            const timeRemaining = role.timeRemaining;
            const isExpiringSoon =
              timeRemaining.includes("minute") && parseInt(timeRemaining) <= 5;
            const statusEmoji = isExpiringSoon
              ? EMOJIS.STATUS.WARNING
              : EMOJIS.TIME.ALARM;

            return `${statusEmoji} **${role.roleInfo.name}** • ${timeRemaining}`;
          })
          .join("\n");

        embed.addFields({
          name: `${EMOJIS.UI.USER} ${user.username} (${roles.length})`,
          value: roleList,
          inline: false,
        });
      }
    } else {
      // Show roles for specific user
      const roleList = processedRoles
        .map(role => {
          const timeRemaining = role.timeRemaining;
          const isExpiringSoon =
            timeRemaining.includes("minute") && parseInt(timeRemaining) <= 5;
          const statusEmoji = isExpiringSoon
            ? EMOJIS.STATUS.WARNING
            : EMOJIS.TIME.ALARM;

          return `${statusEmoji} **${role.roleInfo.name}** • ${timeRemaining}`;
        })
        .join("\n");

      embed.addFields({
        name: `${EMOJIS.FEATURES.ROLES} Active Roles (${processedRoles.length})`,
        value: roleList,
        inline: false,
      });
    }
  }

  return embed;
}

/**
 * Create the temporary role removed embed
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').Role} targetRole
 * @param {string} reason
 * @param {import('discord.js').User} removedBy
 * @param {Object} tempRole
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleRemovedEmbed(
  targetUser,
  targetRole,
  reason,
  removedBy,
  tempRole,
  client,
) {
  // Calculate time remaining before removal
  const now = new Date();
  const expiresAt = new Date(tempRole.expiresAt);
  const timeRemaining =
    expiresAt > now
      ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
      : "Expired";

  return new EmbedBuilder()
    .setTitle(`${EMOJIS.ACTIONS.DELETE} Temporary Role Removed`)
    .setDescription(
      `Successfully removed the **${targetRole.name}** role from **${targetUser.username}**.`,
    )
    .setColor(THEME.SUCCESS)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields([
      {
        name: `${EMOJIS.UI.USER} User Information`,
        value: [
          `**Username:** ${targetUser.username}`,
          `**ID:** \`${targetUser.id}\``,
          `**Mention:** ${targetUser.toString()}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Role Information`,
        value: [
          `**Name:** ${targetRole.name}`,
          `**ID:** \`${targetRole.id}\``,
          `**Color:** ${targetRole.hexColor}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: `${EMOJIS.ACTIONS.REMOVE} Removal Details`,
        value: [
          `**Removed by:** ${removedBy.username}`,
          `**Reason:** ${reason || "No reason provided"}`,
          `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`,
        ].join("\n"),
        inline: false,
      },
      {
        name: `${EMOJIS.TIME.ALARM} Original Expiration`,
        value: [
          `**Would have expired:** <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
          `**Time remaining:** ${timeRemaining}`,
          `**Duration:** ${expiresAt > now ? "Early removal" : "Already expired"}`,
        ].join("\n"),
        inline: false,
      },
    ])
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    })
    .setTimestamp();
}

/**
 * Create the temporary role bulk removal embed
 * @param {import('discord.js').Role} role
 * @param {Array} users
 * @param {string} reason
 * @param {Array} results
 * @param {import('discord.js').User} removedBy
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleRemovalEmbed(
  role,
  users,
  reason,
  results,
  removedBy,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.ACTIONS.DELETE} Temporary Role Removal`)
    .setDescription(
      `Successfully removed the **${role.name}** role from ${users.length} user${users.length !== 1 ? "s" : ""}`,
    )
    .setColor(role.color || THEME.SUCCESS)
    .setThumbnail(role.iconURL() || null)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  // Main information section
  embed.addFields([
    {
      name: `${EMOJIS.FEATURES.ROLES} Role Details`,
      value: [
        `**Name:** ${role.name}`,
        `**Mention:** ${role.toString()}`,
        `**Color:** ${role.hexColor}`,
        `**Position:** ${role.position}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: `${EMOJIS.UI.USERS} Removal Info`,
      value: [
        `**Target Users:** ${users.length} user${users.length !== 1 ? "s" : ""}`,
        `**Removed by:** ${removedBy.username}`,
        `**Reason:** ${reason}`,
        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`,
      ].join("\n"),
      inline: true,
    },
  ]);

  // Add results if available
  if (results && results.length > 0) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Results summary with better formatting
    let resultsText = `${EMOJIS.STATUS.SUCCESS} **${successCount}** successful`;
    if (failureCount > 0) {
      resultsText += `\n${EMOJIS.STATUS.ERROR} **${failureCount}** failed`;
    }

    embed.addFields({
      name: `${EMOJIS.UI.PROGRESS} Removal Results`,
      value: resultsText,
      inline: true,
    });

    // Add detailed results if there are any failures
    if (failureCount > 0) {
      const failedResults = results.filter(r => !r.success);
      const failureText = failedResults
        .map(r => `• <@${r.user?.id || "Unknown"}>: ${r.error}`)
        .join("\n")
        .slice(0, 1000); // Limit to Discord field limit

      embed.addFields({
        name: `${EMOJIS.STATUS.ERROR} Failed Removals`,
        value: failureText || "No details available",
        inline: false,
      });
    }
  }

  return embed;
}
