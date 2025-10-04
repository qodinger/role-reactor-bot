import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createLevelEmbed } from "./embeds.js";

/**
 * Handle the level display
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleLevel(interaction, _client) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Get database manager
    const dbManager = await getDatabaseManager();

    if (!dbManager.guildSettings) {
      return interaction.reply(
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
      return interaction.reply(
        errorEmbed({
          title: "XP System Disabled",
          description: "The XP system is not enabled for this server.",
          solution:
            "Ask an administrator to enable the XP system using `/xp setup`.",
        }),
      );
    }

    // Defer reply
    await interaction.deferReply({ flags: 64 });

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

    // Get experience manager
    const { getExperienceManager } = await import(
      "../../../features/experience/ExperienceManager.js"
    );
    const experienceManager = await getExperienceManager();

    // Get user data
    const userData = await experienceManager.getUserData(
      interaction.guild.id,
      targetUser.id,
    );
    const progress = experienceManager.calculateProgress(userData.totalXP);

    // Create level embed
    const embed = createLevelEmbed(interaction, targetUser, userData, progress);

    await interaction.editReply({
      embeds: [embed],
    });

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
