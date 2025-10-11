import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { EMOJIS } from "../../../config/theme.js";

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
        { flags: MessageFlags.Ephemeral },
      );
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get form data
    const messageInput =
      interaction.fields.getTextInputValue("goodbye_message");

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

    // Get current settings to preserve other values
    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

    // Update only the message, preserve other settings
    const newSettings = {
      ...currentSettings,
      message:
        messageInput ||
        `**{user}** left the server\nThanks for being part of **{server}**! ${EMOJIS.ACTIONS.WAVE}`,
    };

    await dbManager.goodbyeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings for display
    const updatedSettings = await dbManager.goodbyeSettings.getByGuild(
      interaction.guild.id,
    );

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

    // Update the original message
    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Goodbye message configured via modal by ${interaction.user.tag} in ${interaction.guild.name}`,
      {
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
