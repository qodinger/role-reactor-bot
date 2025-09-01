import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createWelcomeSettingsEmbed } from "./embeds.js";
import { createWelcomeSettingsComponents } from "./components.js";

/**
 * Handle the main welcome settings logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleWelcomeSettings(interaction) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    await interaction.deferReply({ flags: 64 });

    // Get database manager and settings
    const dbManager = await getDatabaseManager();

    // Check if welcome settings repository is available
    if (!dbManager.welcomeSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Welcome settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    let settings;
    try {
      settings = await dbManager.welcomeSettings.getByGuild(
        interaction.guild.id,
      );
    } catch (error) {
      logger.error(
        `Failed to retrieve welcome settings for guild ${interaction.guild.id}`,
        error,
      );
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Failed to retrieve welcome settings from database.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }

    // Get channel and role objects
    const welcomeChannel = settings.channelId
      ? interaction.guild.channels.cache.get(settings.channelId)
      : null;
    const autoRole = settings.autoRoleId
      ? interaction.guild.roles.cache.get(settings.autoRoleId)
      : null;

    // Create settings embed and components
    const embed = createWelcomeSettingsEmbed(
      interaction,
      settings,
      welcomeChannel,
      autoRole,
    );
    const components = createWelcomeSettingsComponents(settings);

    await interaction.editReply({
      embeds: [embed],
      components: [components],
    });

    logger.info(
      `Welcome settings viewed for ${interaction.guild.name} by ${interaction.user.tag} (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `Failed to view welcome settings for ${interaction.guild.name}`,
      error,
    );
    await interaction.editReply(
      errorEmbed({
        title: "Settings Error",
        description: "An error occurred while retrieving welcome settings.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
