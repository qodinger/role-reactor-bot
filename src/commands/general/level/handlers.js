import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager as defaultGetDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createLevelEmbed } from "./embeds.js";

/**
 * Handle the level display
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {Object} options - Optional dependencies for testing
 * @param {Function} options.getDatabaseManager - Optional database manager getter
 * @param {Function} options.getExperienceManager - Optional experience manager getter
 */
export async function handleLevel(interaction, _client, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Allow dependency injection for testing
    const getDatabaseManager =
      options.getDatabaseManager || defaultGetDatabaseManager;
    const dbManager = await getDatabaseManager();

    if (!dbManager.guildSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Guild settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    // Check if XP system is enabled
    const guildSettings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    if (!guildSettings.experienceSystem.enabled) {
      return interaction.editReply(
        errorEmbed({
          title: "XP System Disabled",
          description: "The XP system is not enabled for this server.",
          solution:
            "Ask an administrator to enable the XP system using `/xp setup`.",
        }),
      );
    }

    // Get target user (default to command user)
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    if (!targetMember) {
      return interaction.editReply(
        errorEmbed({
          title: "User Not Found",
          description: "The specified user is not in this server.",
          solution: "Make sure the user is a member of this server.",
        }),
      );
    }

    // Ignore bots
    if (targetUser.bot) {
      return interaction.editReply(
        errorEmbed({
          title: "Bot Account",
          description: "Bot accounts do not participate in the XP system.",
          solution: "Check the level of a human member instead!",
        }),
      );
    }

    // Allow dependency injection for testing
    const getExperienceManager =
      options.getExperienceManager ||
      (await import("../../../features/experience/ExperienceManager.js"))
        .getExperienceManager;
    const experienceManager = await getExperienceManager();

    // Get user data
    const userData = await experienceManager.getUserData(
      interaction.guild.id,
      targetUser.id,
    );
    const progress = experienceManager.calculateProgress(userData.totalXP);

    // Get rank for everyone
    const rank = await experienceManager.getUserRank(
      interaction.guild.id,
      targetUser.id,
    );

    // Check for Pro Engine (Premium)
    const { getPremiumManager } = await import(
      "../../../features/premium/PremiumManager.js"
    );
    const { PremiumFeatures } = await import(
      "../../../features/premium/config.js"
    );
    const premiumManager = getPremiumManager();
    await premiumManager.isFeatureActive(
      interaction.guild.id,
      PremiumFeatures.PRO.id,
    );

    // Standard Embed Display (Rank cards disabled)
    const embed = createLevelEmbed(
      interaction,
      targetUser,
      userData,
      progress,
      rank,
    );
    await interaction.editReply({ embeds: [embed] });

    const duration = Date.now() - startTime;
    logger.info(
      `Level displayed for user ${targetUser.tag} in guild ${interaction.guild.name} by user ${interaction.user.tag} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error displaying level after ${duration}ms`, error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display level information.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
