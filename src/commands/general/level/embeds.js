import { EmbedBuilder } from "discord.js";
import {
  getRankTitle,
  getFormattedRank,
  getAllRankTiers,
} from "../../../features/experience/rankTitles.js";

/**
 * Create the level embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').User} user - Target user
 * @param {object} userData - User experience data
 * @param {object} progress - Progress data
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLevelEmbed(interaction, user, userData, progress) {
  const rank = getRankTitle(progress.currentLevel);
  const nextRankTiers = getAllRankTiers();
  const nextRank = nextRankTiers.find(
    tier => tier.minLevel > progress.currentLevel,
  );

  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setTitle(`${rank.emoji} ${rank.title}`)
    .setDescription(`**${user.displayName || user.username}**'s XP progress`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields([
      {
        name: "Rank",
        value: `**${getFormattedRank(progress.currentLevel)}**`,
        inline: true,
      },
      {
        name: "Level",
        value: `**${progress.currentLevel}**`,
        inline: true,
      },
      {
        name: "Total XP",
        value: `**${progress.totalXP.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `Progress to Level ${progress.currentLevel + 1}`,
        value: createProgressBar(progress.progress, 15),
        inline: false,
      },
      {
        name: "Next Level",
        value: `**${progress.xpNeededForNextLevel.toLocaleString()}** XP needed`,
        inline: true,
      },
      {
        name: "Next Rank",
        value: nextRank
          ? `${nextRank.emoji} **${nextRank.title}** (Level ${nextRank.minLevel})`
          : "🏆 **Max Rank Achieved!**",
        inline: true,
      },
    ])
    .setFooter({
      text: "Keep chatting to earn more XP!",
      iconURL: user.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a visual progress bar
 * @param {number} progress - Progress percentage (0-100)
 * @param {number} width - Width of the progress bar (default: 10)
 * @returns {string} Progress bar string
 */
function createProgressBar(progress, width = 10) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  return `\`${"█".repeat(filled)}${"░".repeat(empty)}\` ${progress.toFixed(1)}%`;
}
