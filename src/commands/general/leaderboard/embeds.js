import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Create the leaderboard embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Array} leaderboardData - Leaderboard data
 * @param {string} type - Leaderboard type
 * @param {number} limit - Number of users shown
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLeaderboardEmbed(
  interaction,
  leaderboardData,
  type,
  limit,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${EMOJIS.FEATURES.EXPERIENCE} ${getLeaderboardTitle(type)}`)
    .setDescription(`Top ${limit} users in ${interaction.guild.name}`)
    .setTimestamp();

  // Add leaderboard entries
  const leaderboardText = leaderboardData
    .map((user, index) => {
      const position = index + 1;
      const medal = getPositionMedal(position);
      const username =
        interaction.guild.members.cache.get(user.userId)?.displayName ||
        interaction.guild.members.cache.get(user.userId)?.user.username ||
        `User ${user.userId}`;

      return formatLeaderboardEntry(position, medal, username, user, type);
    })
    .join("\n");

  embed.addFields([
    {
      name: `${EMOJIS.UI.TROPHY} Rankings`,
      value: leaderboardText || "No data available",
      inline: false,
    },
  ]);

  // Add footer with additional info
  const totalUsers = leaderboardData.length;
  embed.setFooter({
    text: `${EMOJIS.FEATURES.EXPERIENCE} Showing ${totalUsers} users • Use /leaderboard to see more`,
    iconURL: interaction.guild.iconURL(),
  });

  return embed;
}

/**
 * Get leaderboard title based on type
 * @param {string} type - Leaderboard type
 * @returns {string} Title
 */
function getLeaderboardTitle(type) {
  switch (type) {
    case "level":
      return "Level Leaderboard";
    case "messages":
      return "Message Leaderboard";
    case "voice":
      return "Voice Time Leaderboard";
    default:
      return "XP Leaderboard";
  }
}

/**
 * Get position medal emoji
 * @param {number} position - Position (1-based)
 * @returns {string} Medal emoji
 */
function getPositionMedal(position) {
  switch (position) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `${position}.`;
  }
}

/**
 * Format leaderboard entry
 * @param {number} position - Position
 * @param {string} medal - Medal emoji
 * @param {string} username - Username
 * @param {object} user - User data
 * @param {string} type - Leaderboard type
 * @returns {string} Formatted entry
 */
function formatLeaderboardEntry(position, medal, username, user, type) {
  // Calculate level from totalXP using the correct formula
  let level = 1;
  while (Math.floor(100 * Math.pow(level, 1.5)) <= (user.totalXP || 0)) {
    level++;
  }
  level = level - 1;

  switch (type) {
    case "level":
      return `${medal} **${username}** - Level ${level}`;
    case "messages":
      return `${medal} **${username}** - ${(user.messagesSent || 0).toLocaleString()} messages`;
    case "voice": {
      const voiceHours = Math.floor((user.voiceTime || 0) / 60);
      const voiceMinutes = (user.voiceTime || 0) % 60;
      return `${medal} **${username}** - ${voiceHours}h ${voiceMinutes}m`;
    }
    default:
      return `${medal} **${username}** - ${(user.totalXP || 0).toLocaleString()} XP (Level ${level})`;
  }
}
