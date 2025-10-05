import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { errorEmbed } from "../../discord/responseMessages.js";
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
        flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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

    // Return to configuration page with updated settings
    const { createWelcomeConfigPageEmbed } = await import(
      "../../../commands/admin/welcome/modals.js"
    );
    const { createWelcomeConfigPageComponents } = await import(
      "../../../commands/admin/welcome/components.js"
    );

    const embed = createWelcomeConfigPageEmbed(interaction, updatedSettings);
    const components = createWelcomeConfigPageComponents(
      interaction.guild,
      updatedSettings,
    );

    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `Welcome channel ${selectedChannel.name} selected by ${interaction.user.tag} in ${interaction.guild.name}`,
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
