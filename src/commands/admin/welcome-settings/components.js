import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create the welcome settings action buttons
 * @param {Object} settings
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createWelcomeSettingsComponents(settings) {
  const buttonComponents = [];

  // Always show configure button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_configure")
      .setLabel("Configure")
      .setEmoji(EMOJIS.ACTIONS.EDIT)
      .setStyle(ButtonStyle.Primary),
  );

  // Only add test button if welcome system is enabled and channel is configured
  if (settings.enabled && settings.channelId) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_test")
        .setLabel("Test Welcome")
        .setEmoji(EMOJIS.ACTIONS.QUICK)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Show toggle button (disabled if no channel and system is disabled)
  const canToggle = settings.channelId || settings.enabled;
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_toggle")
      .setLabel(settings.enabled ? "Disable" : "Enable")
      .setEmoji(settings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS)
      .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setDisabled(!canToggle),
    new ButtonBuilder()
      .setCustomId("welcome_reset")
      .setLabel("Reset")
      .setEmoji(EMOJIS.ACTIONS.DELETE)
      .setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder().addComponents(...buttonComponents);
}
