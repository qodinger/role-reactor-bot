import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createXpSettingsEmbed } from "./embeds.js";
import { createXpSettingsComponents } from "./components.js";

/**
 * Handle the main XP settings display
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleXpSettings(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Get database manager and settings BEFORE deferring reply
    const dbManager = await getDatabaseManager();

    // Check if guild settings repository is available
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

    let settings;
    try {
      // Add timeout for database operations - reduced to 3 seconds to stay within Discord limits
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Database operation timed out")),
          3000,
        );
      });

      settings = await Promise.race([
        dbManager.guildSettings.getByGuild(interaction.guild.id),
        timeoutPromise,
      ]);
    } catch (error) {
      logger.error(
        `Failed to retrieve guild settings for guild ${interaction.guild.id}`,
        error,
      );
      return interaction.reply(
        errorEmbed({
          title: "Database Error",
          description: "Failed to retrieve guild settings from database.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    // Now defer the reply after we have the data
    await interaction.deferReply({ flags: 64 });

    const xpSettings = settings.experienceSystem;

    // Create settings embed and components
    const embed = createXpSettingsEmbed(interaction, xpSettings);
    const components = createXpSettingsComponents(xpSettings);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    const duration = Date.now() - startTime;
    logger.info(
      `XP settings displayed for guild ${interaction.guild.name} by user ${interaction.user.tag} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error displaying XP settings after ${duration}ms`, error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display XP settings.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
