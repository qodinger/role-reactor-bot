import { getLogger } from "../../../utils/logger.js";
import { getExperienceManager } from "../../../features/experience/ExperienceManager.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { createLevelEmbed, createErrorEmbed } from "./embeds.js";
import {
  calculateUserRank,
  calculateProgressBar,
  determineUserRank,
} from "./utils.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const experienceManager = await getExperienceManager();
    const dbManager = await getDatabaseManager();

    const userData = await experienceManager.getUserData(
      interaction.guild.id,
      targetUser.id,
    );
    const progress = experienceManager.calculateProgress(userData.totalXP);

    // Get XP settings from database
    const settings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    const xpSettings = settings.experienceSystem;

    // Add XP settings to userData for the embed
    userData.messageXPRange = `${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max}`;
    userData.commandXPBase = xpSettings.commandXPAmount.base;
    userData.roleXPAmount = xpSettings.roleXPAmount;

    // Get server rank by calculating position in leaderboard
    const leaderboard = await experienceManager.getLeaderboard(
      interaction.guild.id,
      100,
    );
    const serverRank = calculateUserRank(leaderboard, targetUser.id);

    // Create progress bar
    const progressBar = calculateProgressBar(progress.progress);

    // Determine rank and color
    const { rank, rankEmoji, rankColor } = determineUserRank(userData.level);

    const embed = createLevelEmbed(
      targetUser,
      userData,
      progress,
      progressBar,
      rank,
      rankEmoji,
      rankColor,
      serverRank,
      interaction.guild,
    );

    await interaction.reply({ embeds: [embed] });
    logger.logCommand("level", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in level command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
