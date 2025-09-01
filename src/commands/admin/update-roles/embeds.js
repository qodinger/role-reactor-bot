import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";

/**
 * Create the updated roles embed
 * @param {Object} updatedMapping
 * @param {Object} roleMapping
 * @param {import('discord.js').Client} client
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createUpdatedRolesEmbed(updatedMapping, roleMapping, client) {
  const embed = new EmbedBuilder()
    .setTitle(updatedMapping.title || "Role Selection")
    .setDescription(updatedMapping.description || "React to get a role!")
    .setColor(updatedMapping.color || THEME.INFO)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Self-Assignable Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  // Prepare role list
  const rolesToShow = Object.values(roleMapping || {});
  const roleList = rolesToShow
    .map(pair => {
      const limitText = pair.limit ? ` (${pair.limit} users max)` : "";
      return `${pair.emoji} <@&${pair.roleId}>${limitText}`;
    })
    .join("\n");

  embed.addFields({
    name: "🎭 Available Roles",
    value: roleList || "No roles available",
    inline: false,
  });

  return embed;
}
