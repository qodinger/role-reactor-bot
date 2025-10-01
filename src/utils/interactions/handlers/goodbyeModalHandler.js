import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { createGoodbyeSettingsEmbed } from "../../../commands/admin/goodbye/embeds.js";
import { createGoodbyeSettingsComponents } from "../../../commands/admin/goodbye/components.js";

/**
 * Handle goodbye configuration modal submission
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleGoodbyeConfigModal(interaction) {
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
        { ephemeral: true },
      );
    }

    await interaction.deferReply({ ephemeral: true });

    // Get form data
    const channelInput =
      interaction.fields.getTextInputValue("goodbye_channel");
    const messageInput =
      interaction.fields.getTextInputValue("goodbye_message");
    const enabledInput =
      interaction.fields.getTextInputValue("goodbye_enabled");
    const embedInput = interaction.fields.getTextInputValue("goodbye_embed");

    // Parse channel input (handle both mentions and IDs)
    let channelId = null;
    if (channelInput) {
      // Extract channel ID from mention or use as direct ID
      const channelMatch =
        channelInput.match(/<#(\d+)>/) || channelInput.match(/^(\d+)$/);
      if (channelMatch) {
        channelId = channelMatch[1];
      } else {
        return interaction.editReply(
          errorEmbed({
            title: "Invalid Channel",
            description: "Please provide a valid channel mention or ID.",
            solution: "Use #channel-name or the channel ID directly.",
          }),
        );
      }
    }

    // Validate channel exists
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.editReply(
        errorEmbed({
          title: "Channel Not Found",
          description:
            "The specified channel does not exist or is not accessible.",
          solution: "Please check the channel ID and try again.",
        }),
      );
    }

    // Parse boolean values
    const enabled = enabledInput.toLowerCase() === "true";
    const embedEnabled = embedInput.toLowerCase() === "true";

    // Validate message if provided
    if (messageInput && messageInput.length > 2000) {
      return interaction.editReply(
        errorEmbed({
          title: "Message Too Long",
          description: "The goodbye message cannot exceed 2000 characters.",
          solution: "Please shorten your message and try again.",
        }),
      );
    }

    // Save settings
    const dbManager = await getDatabaseManager();
    const newSettings = {
      channelId,
      message:
        messageInput ||
        "**{user}** left the server\nThanks for being part of **{server}**! 👋",
      enabled,
      embedEnabled,
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings for display
    const updatedSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Create updated embed and components
    const embed = createGoodbyeSettingsEmbed(
      interaction,
      updatedSettings,
      channel,
    );
    const components = createGoodbyeSettingsComponents(updatedSettings);

    // Update the original message
    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Goodbye system configured via modal by ${interaction.user.tag} in ${interaction.guild.name}`,
      {
        channelId,
        enabled,
        embedEnabled,
        messageLength: messageInput?.length || 0,
      },
    );
  } catch (error) {
    logger.error("Error in handleGoodbyeConfigModal:", error);
    await interaction.editReply(
      errorEmbed({
        title: "Configuration Error",
        description: "Failed to save goodbye configuration.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
