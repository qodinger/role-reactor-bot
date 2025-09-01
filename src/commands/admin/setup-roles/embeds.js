import { EmbedBuilder } from "discord.js";

/**
 * Create the setup roles embed
 * @param {string} title
 * @param {string} description
 * @param {string} color
 * @param {Array} validRoles
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createSetupRolesEmbed(
  title,
  description,
  color,
  validRoles,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Click reactions to get roles!",
      iconURL: client.user.displayAvatarURL(),
    });

  const roleList = validRoles
    .map(role => {
      const limitText = role.limit ? ` (${role.limit} users max)` : "";
      return `${role.emoji} <@&${role.roleId}>${limitText}`;
    })
    .join("\n");

  embed.addFields({
    name: "🎭 Available Roles",
    value: roleList,
    inline: false,
  });

  // Add helpful tip
  embed.addFields({
    name: "💡 How to Use",
    value:
      "Members can click the reactions below to get or remove roles instantly!",
    inline: false,
  });

  return embed;
}
