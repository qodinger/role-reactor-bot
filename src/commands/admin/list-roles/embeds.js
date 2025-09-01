import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";

/**
 * Create the list roles embed
 * @param {Array} guildMappings
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createListRolesEmbed(guildMappings, client) {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role-Reaction Messages")
    .setDescription(
      `Found **${guildMappings.length}** role-reaction message${guildMappings.length !== 1 ? "s" : ""} in this server.`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Click reactions to get roles!",
      iconURL: client.user.displayAvatarURL(),
    });

  const roleList = guildMappings
    .map(([messageId, mapping]) => {
      const rolesObj = mapping.roles || {};
      const rolesArr = Array.isArray(rolesObj)
        ? rolesObj
        : Object.values(rolesObj);
      const roleMentions = rolesArr
        .map(role =>
          role.roleId ? `<@&${role.roleId}>` : role.roleName || "Unknown",
        )
        .join(", ");
      // Channel mention (if available)
      const channelMention = mapping.channelId
        ? `<#${mapping.channelId}>`
        : "Unknown channel";
      return `**Message ID:** ${messageId}\n**Channel:** ${channelMention}\n**Roles:** ${rolesArr.length} role(s)\n${roleMentions}`;
    })
    .join("\n\n");

  embed.addFields({
    name: "📋 Messages",
    value: roleList,
    inline: false,
  });

  return embed;
}
