import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../config/theme.js";

/**
 * Process goodbye message with placeholders
 * @param {string} message - The message template
 * @param {GuildMember} member - The guild member who left
 * @returns {string} - Processed message
 */
export function processGoodbyeMessage(message, member) {
  return message
    .replace(/{user}/g, member.user.toString())
    .replace(/{user.name}/g, member.user.username)
    .replace(/{user.tag}/g, member.user.tag)
    .replace(/{user.id}/g, member.user.id)
    .replace(/{server}/g, member.guild.name)
    .replace(/{server.id}/g, member.guild.id)
    .replace(/{memberCount}/g, member.guild.memberCount)
    .replace(/{memberCount.ordinal}/g, getOrdinal(member.guild.memberCount));
}

/**
 * Create goodbye embed
 * @param {Object} settings - Goodbye settings
 * @param {GuildMember} member - The guild member who left
 * @returns {EmbedBuilder} - Goodbye embed
 */
export function createGoodbyeEmbed(settings, member) {
  const embed = new EmbedBuilder()
    .setColor(settings.embedColor || THEME_COLOR)
    .setTitle(
      processGoodbyeMessage(
        settings.embedTitle || "👋 Goodbye from {server}!",
        member,
      ),
    )
    .setDescription(
      processGoodbyeMessage(
        settings.message ||
          "Goodbye {user}! Thanks for being part of {server}! 👋",
        member,
      ),
    )
    .setTimestamp()
    .setFooter({
      text: `${EMOJIS.FEATURES.ROLES} Goodbye System • ${member.guild.name}`,
      iconURL: member.client.user.displayAvatarURL(),
    });

  // Add thumbnail if enabled
  if (settings.embedThumbnail !== false) {
    embed.setThumbnail(
      member.user.displayAvatarURL({ dynamic: true, size: 256 }),
    );
  }

  // Add fields with member information
  embed.addFields([
    {
      name: `${EMOJIS.UI.USERS} Farewell`,
      value: `**👤 Name:** ${member.user.username}\n**📅 Left:** <t:${Math.floor(Date.now() / 1000)}:R>\n**🎯 Was:** ${getOrdinal(member.guild.memberCount + 1)} member`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.INFO} Server`,
      value: `**👥 Members:** ${member.guild.memberCount}\n**🏠 Server:** ${member.guild.name}`,
      inline: true,
    },
  ]);

  return embed;
}

/**
 * Get ordinal number (1st, 2nd, 3rd, etc.)
 * @param {number} num - The number
 * @returns {string} - Ordinal number
 */
function getOrdinal(num) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
