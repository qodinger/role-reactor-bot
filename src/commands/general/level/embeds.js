import { EmbedBuilder } from "discord.js";
import {
  getRankTitle,
  getAllRankTiers,
} from "../../../features/experience/rankTitles.js";

/**
 * Create the level embed with a compact, horizontal layout
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').User} user - Target user
 * @param {object} userData - User experience data
 * @param {object} progress - Progress data
 * @param {number|string} leaderboardRank - User's rank
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLevelEmbed(
  interaction,
  user,
  userData,
  progress,
  leaderboardRank = null,
) {
  const rank = getRankTitle(progress.currentLevel);
  const nextRankTiers = getAllRankTiers();
  const nextRank = nextRankTiers.find(
    tier => tier.minLevel > progress.currentLevel,
  );

  // Format statistics
  const currentXP = progress.xpInCurrentLevel || 0;
  const neededXP = progress.xpNeededForNextLevel || 100;
  const percentage = Math.floor(progress.progress);

  // Create progress bar
  const progressBar = createProgressBar(percentage, 20);

  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setAuthor({
      name: `${user.username} • Level ${progress.currentLevel}`,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle(`${rank.emoji} ${rank.title}`)
    // Removed large thumbnail for cleaner width
    .addFields([
      {
        name: "🏆 Rank",
        value: `**#${leaderboardRank || "-"}**`,
        inline: true,
      },
      {
        name: "✨ Total XP",
        value: `**${progress.totalXP.toLocaleString()}**`,
        inline: true,
      },
      {
        name: "⭐ Level", // Moved Level here if title isn't sufficient, or redundant?
        // Author has Level. Let's keep it for clarity or replace with "Next Level" target.
        // Let's use "XP Left" or just keep Level for symmetry.
        value: `**${progress.currentLevel}**`,
        inline: true,
      },
      {
        name: `Progress to Level ${progress.currentLevel + 1}`,
        value: `${progressBar} **${percentage}%**\n${currentXP.toLocaleString()} / ${neededXP.toLocaleString()} XP`,
        inline: false,
      },
    ])
    .setFooter({
      text: nextRank
        ? `Next Tier: ${nextRank.title} (Level ${nextRank.minLevel})`
        : "🏆 Max Tier Achieved",
      iconURL: null, // Minimal footer
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a visual progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} width - Width of the progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(percentage, width = 10) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  // Modern block style
  const fillChar = "▰";
  const emptyChar = "▱";

  return `\`${fillChar.repeat(filled)}${emptyChar.repeat(empty)}\``;
}
