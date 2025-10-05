import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../config/theme.js";

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
    .setAuthor({
      name: `${member.user.username} left the server`,
      iconURL: member.user.displayAvatarURL({ dynamic: true, size: 64 }),
    })
    .setDescription(
      processGoodbyeMessage(
        settings.message ||
          "**{user}** left the server\nThanks for being part of **{server}**! 👋",
        member,
      ),
    )
    .addFields({
      name: "",
      value: "",
      inline: false,
    })
    .addFields({
      name: "📊 Server Statistics",
      value: `**${member.guild.memberCount}** members remaining`,
      inline: true,
    })
    .addFields({
      name: "⏰ Left At",
      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
      inline: true,
    })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTimestamp()
    .setFooter({
      text: `${member.guild.name} • Goodbye System`,
      iconURL: member.client.user.displayAvatarURL(),
    });

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
