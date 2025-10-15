import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Create the level embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').User} user - Target user
 * @param {object} userData - User experience data
 * @param {object} progress - Progress data
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLevelEmbed(interaction, user, userData, progress) {
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${EMOJIS.FEATURES.EXPERIENCE} Level Information`)
    .setDescription(`**${user.displayName || user.username}**'s XP progress`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields([
      {
        name: `${EMOJIS.STATUS.INFO} Current Level`,
        value: `**${progress.currentLevel}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.EXPERIENCE} Total XP`,
        value: `**${progress.totalXP.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.ALARM} Next Level`,
        value: `**${progress.xpNeededForNextLevel.toLocaleString()}** XP needed`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.PROGRESS} Progress to Level ${progress.currentLevel + 1}`,
        value: createProgressBar(progress.progress),
        inline: false,
      },
      {
        name: `${EMOJIS.UI.PROGRESS} Statistics`,
        value: [
          `💬 **Messages**: ${(userData.messagesSent || 0).toLocaleString()}`,
          `⚡ **Commands**: ${(userData.commandsUsed || 0).toLocaleString()}`,
          `🎭 **Roles Earned**: ${(userData.rolesEarned || 0).toLocaleString()}`,
          `🎤 **Voice Time**: ${formatVoiceTime(userData.voiceTime || 0)}`,
        ].join("\n"),
        inline: false,
      },
    ])
    .setFooter({
      text: `${EMOJIS.FEATURES.EXPERIENCE} Keep chatting to earn more XP!`,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a visual progress bar
 * @param {number} progress - Progress percentage (0-100)
 * @returns {string} Progress bar string
 */
function createProgressBar(progress) {
  const filled = Math.round(progress / 10);
  const empty = 10 - filled;

  return `\`${"█".repeat(filled)}${"░".repeat(empty)}\` ${progress.toFixed(1)}%`;
}

/**
 * Format voice time in hours and minutes
 * @param {number} minutes - Voice time in minutes
 * @returns {string} Formatted time
 */
function formatVoiceTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
