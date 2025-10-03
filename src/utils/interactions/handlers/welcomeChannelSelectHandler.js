import { getLogger } from "../../logger.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { createWelcomeConfigModal } from "../../../commands/admin/welcome/modals.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";

/**
 * Handle welcome channel select interaction
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleWelcomeChannelSelect(interaction) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome system.",
          }),
        ],
        ephemeral: true,
      });
    }

    const selectedChannelId = interaction.values[0];
    const selectedChannel =
      interaction.guild.channels.cache.get(selectedChannelId);

    if (!selectedChannel) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Channel Not Found",
            description: "The selected channel could not be found.",
          }),
        ],
        ephemeral: true,
      });
    }

    // Check if bot has permission to send messages in the selected channel
    if (
      !selectedChannel
        .permissionsFor(interaction.client.user)
        .has("SendMessages")
    ) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Error",
            description: `I don't have permission to send messages in ${selectedChannel.toString()}`,
            solution:
              "Please grant me Send Messages permission in the selected channel.",
          }),
        ],
        ephemeral: true,
      });
    }

    // Get current settings from database
    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Save the selected channel ID to the database immediately
    const updatedSettings = {
      ...currentSettings,
      channelId: selectedChannelId,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, updatedSettings);

    // Create modal with selected channel pre-filled and current settings
    const modal = createWelcomeConfigModal({
      ...updatedSettings,
    });

    await interaction.showModal(modal);

    logger.info(
      `Welcome config modal opened for channel ${selectedChannel.name} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(
      `Error in handleWelcomeChannelSelect: ${error.message}`,
      error,
    );
    await interaction.reply({
      embeds: [
        errorEmbed({
          title: "Selection Error",
          description:
            "An error occurred while processing the channel selection.",
        }),
      ],
      ephemeral: true,
    });
  }
}
