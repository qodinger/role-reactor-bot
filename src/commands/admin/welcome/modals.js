import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

/**
 * Create the welcome configuration modal
 * @param {Object} currentSettings - Current welcome settings
 * @returns {ModalBuilder}
 */
export function createWelcomeConfigModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("welcome_config_modal")
    .setTitle("Configure Welcome System");

  // Message input
  const messageInput = new TextInputBuilder()
    .setCustomId("welcome_message")
    .setLabel("Message")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "Enter welcome message (use {user}, {server}, {memberCount})",
    )
    .setValue(
      currentSettings.message || "Welcome **{user}** to **{server}**! 🎉",
    )
    .setRequired(false);

  // Add inputs to modal
  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

  return modal;
}
