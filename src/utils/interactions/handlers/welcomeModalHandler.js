import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { createWelcomeConfigPageEmbed } from "../../../commands/admin/welcome/modals.js";
import { createWelcomeConfigPageComponents } from "../../../commands/admin/welcome/components.js";
import { validateWelcomeMessage } from "../../validation/welcomeValidation.js";
import { validateModalInput } from "../../validation/formValidation.js";
import { INPUT_LIMITS } from "../../validation/inputValidation.js";
import { EMOJIS } from "../../../config/theme.js";

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
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const rawMessageInput =
      interaction.fields.getTextInputValue("welcome_message");

    const inputValidation = validateModalInput(
      rawMessageInput,
      "Welcome Message",
      {
        required: false,
        maxLength: INPUT_LIMITS.EMBED_DESCRIPTION,
        stripHtml: true,
        removeScripts: true,
      },
    );

    if (!inputValidation.valid) {
      return interaction.editReply({
        embeds: [inputValidation.error],
        flags: MessageFlags.Ephemeral,
      });
    }

    const sanitizedMessage = inputValidation.sanitized;
    const validation = validateWelcomeMessage(sanitizedMessage);

    if (!validation.valid) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Invalid Message",
            description:
              validation.error || "Please provide a valid welcome message.",
            solution: "Remove any HTML or script content and try again.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const dbManager = await getDatabaseManager();

    // Get current settings to preserve existing values
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const newSettings = {
      ...currentSettings,
      message:
        validation.sanitized ||
        `Welcome **{user}** to **{server}**! ${EMOJIS.ACTIONS.WELCOME}`,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    const updatedSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    const embed = createWelcomeConfigPageEmbed(interaction, updatedSettings);
    const components = createWelcomeConfigPageComponents(
      interaction.guild,
      updatedSettings,
    );

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
      flags: [MessageFlags.Ephemeral],
    });
  }
}
