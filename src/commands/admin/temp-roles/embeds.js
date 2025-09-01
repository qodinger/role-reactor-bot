import { EmbedBuilder } from "discord.js";
import { formatDuration } from "../../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../../config/theme.js";

/**
 * Create the temporary role assignment embed
 * @param {import('discord.js').Role} role
 * @param {Array} users
 * @param {string} durationString
 * @param {string} reason
 * @param {Array} results
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleEmbed(
  role,
  users,
  durationString,
  reason,
  results,
) {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Temporary Role Assignment")
    .setDescription(`Temporary role **${role.name}** has been assigned`)
    .setColor(role.color || 0x00ff00) // Use role color or green
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
    });

  // Add role information
  embed.addFields([
    {
      name: "🎭 Role",
      value: role.toString(),
      inline: true,
    },
    {
      name: "⏰ Duration",
      value: formatDuration(durationString),
      inline: true,
    },
    {
      name: "👥 Target Users",
      value: `${users.length} user${users.length !== 1 ? "s" : ""}`,
      inline: true,
    },
    {
      name: "📝 Reason",
      value: reason,
      inline: false,
    },
  ]);

  // Add notification status if there are results
  if (results && results.length > 0) {
    const dmSentCount = results.filter(r => r.success && r.dmSent).length;
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
      embed.addFields({
        name: "📬 Notifications",
        value:
          dmSentCount > 0
            ? `📨 ${dmSentCount} DM${dmSentCount !== 1 ? "s" : ""} sent successfully`
            : "📭 No DM notifications sent",
        inline: false,
      });
    }
  }

  // Add results if available
  if (results && results.length > 0) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const updateCount = results.filter(r => r.success && r.wasUpdate).length;
    const newCount = successCount - updateCount;

    let summaryText = `✅ **${successCount}** successful`;
    if (updateCount > 0) {
      summaryText += ` (${newCount} new, ${updateCount} updated)`;
    }
    summaryText += `\n❌ **${failureCount}** failed`;

    embed.addFields({
      name: "📊 Results Summary",
      value: summaryText,
      inline: false,
    });

    // Add detailed results if there are any failures
    if (failureCount > 0) {
      const failedResults = results.filter(r => !r.success);
      const failureText = failedResults
        .map(r => `<@${r.user.id}>: ${r.error}`)
        .join("\n")
        .slice(0, 1000); // Limit to Discord field limit

      embed.addFields({
        name: "❌ Failed Assignments",
        value: failureText,
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
      "• Use `/temp-roles remove` to remove roles early",
      "• Roles automatically expire after their set duration",
      "• Use `/temp-roles assign` to create new temporary roles",
    ].join("\n"),
    inline: false,
  });

  return embed;
}

/**
 * Create the temporary role removed embed
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').Role} targetRole
 * @param {string} reason
 * @param {import('discord.js').User} removedBy
 * @param {Object} tempRole
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleRemovedEmbed(
  targetUser,
  targetRole,
  reason,
  removedBy,
  tempRole,
) {
  // Calculate time remaining before removal
  const now = new Date();
  const expiresAt = new Date(tempRole.expiresAt);
  const timeRemaining =
    expiresAt > now
      ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
      : "Expired";

  return new EmbedBuilder()
    .setTitle("🗑️ Temporary Role Removed")
    .setDescription(
      `Successfully removed the **${targetRole.name}** role from **${targetUser.username}**.`,
    )
    .setColor(0x00ff00) // Green for success
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
        name: "👮 Removed By",
        value: `${removedBy.username}`,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: reason || "No reason provided",
        inline: false,
      },
      {
        name: "⏰ Would Have Expired",
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: "⏱️ Time Remaining",
        value: timeRemaining,
        inline: true,
      },
    )
    .setFooter({
      text: "Role Reactor • Temporary Roles",
    })
    .setTimestamp();
}
