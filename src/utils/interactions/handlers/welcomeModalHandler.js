import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { createWelcomeSettingsEmbed } from "../../../commands/admin/welcome/embeds.js";
import { createWelcomeSettingsComponents } from "../../../commands/admin/welcome/components.js";
import { isValidMessage } from "../../validation/welcomeValidation.js";

/**
 * Handle welcome configuration modal submission
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleWelcomeConfigModal(interaction) {
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

    await interaction.deferReply({ ephemeral: true });

    const messageInput =
      interaction.fields.getTextInputValue("welcome_message");

    if (!isValidMessage(messageInput)) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Invalid Message",
            description: "Please provide a valid welcome message.",
          }),
        ],
        ephemeral: true,
      });
    }

    const dbManager = await getDatabaseManager();

    // Get current settings to preserve existing values
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...currentSettings, // Preserve all existing settings
      message: messageInput || "Welcome **{user}** to **{server}**! 🎉",
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    const updatedSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );
    const welcomeChannel = interaction.guild.channels.cache.get(
      updatedSettings.channelId,
    );

    const embed = createWelcomeSettingsEmbed(
      interaction,
      updatedSettings,
      welcomeChannel,
      null,
    );
    const components = createWelcomeSettingsComponents(updatedSettings);

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome settings configured by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeConfigModal: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Configuration Error",
          description:
            "An error occurred while configuring the welcome system.",
        }),
      ],
      ephemeral: true,
    });
  }
}
