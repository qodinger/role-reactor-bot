import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create the welcome settings action buttons
 * @param {Object} newSettings
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createWelcomeSettingsComponents(newSettings) {
  const buttonComponents = [];

  // Only add test button if welcome system is enabled and channel is configured
  if (newSettings.enabled && newSettings.channelId) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_test")
        .setLabel("Test Welcome")
        .setEmoji(EMOJIS.ACTIONS.QUICK)
        .setStyle(ButtonStyle.Primary),
    );
  }

  // Always show edit and toggle buttons
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_edit")
      .setLabel("Edit Settings")
      .setEmoji(EMOJIS.ACTIONS.EDIT)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_disable")
      .setLabel(newSettings.enabled ? "Disable" : "Enable")
      .setEmoji(
        newSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
      )
      .setStyle(newSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
  );

  return new ActionRowBuilder().addComponents(...buttonComponents);
}
