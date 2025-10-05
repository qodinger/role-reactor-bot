import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";

/**
 * Handle goodbye channel selection
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleGoodbyeChannelSelect(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the goodbye system.",
          solution: "Contact a server administrator for assistance.",
        }),
        { flags: MessageFlags.Ephemeral },
      );
    }

    const selectedChannelId = interaction.values[0];
    const selectedChannel =
      interaction.guild.channels.cache.get(selectedChannelId);

    if (!selectedChannel) {
      return interaction.reply(
        errorEmbed({
          title: "Channel Not Found",
          description:
            "The selected channel no longer exists or is not accessible.",
          solution: "Please try selecting a different channel.",
        }),
        { flags: MessageFlags.Ephemeral },
      );
    }

    // Get current settings and update with selected channel
    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Update settings with selected channel
    const updatedSettings = {
      ...currentSettings,
      channelId: selectedChannelId,
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, updatedSettings);

    // Return to configuration page with updated settings
    const { createGoodbyeConfigPageEmbed } = await import(
      "../../../commands/admin/goodbye/modals.js"
    );
    const { createGoodbyeConfigPageComponents } = await import(
      "../../../commands/admin/goodbye/components.js"
    );

    const embed = createGoodbyeConfigPageEmbed(interaction, updatedSettings);
    const components = createGoodbyeConfigPageComponents(
      interaction.guild,
      updatedSettings,
    );

    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `Goodbye channel selected: #${selectedChannel.name} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeChannelSelect:", error);
    await interaction.reply(
      errorEmbed({
        title: "Selection Error",
        description: "Failed to process channel selection.",
        solution: "Please try again or contact support if the issue persists.",
      }),
      { ephemeral: true },
    );
  }
}
