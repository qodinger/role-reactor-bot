import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";

/**
 * Create the temporary roles list embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {Array} processedRoles
 * @param {import('discord.js').User} targetUser
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRolesListEmbed(
  interaction,
  client,
  processedRoles,
  targetUser,
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
      "• Use `/remove-temp-role` to remove roles early",
      "• Roles automatically expire after their set duration",
      "• Use `/assign-temp-role` to create new temporary roles",
    ].join("\n"),
    inline: false,
  });

  return embed;
}
