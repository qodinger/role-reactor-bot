import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

/**
 * Create goodbye configuration modal
 * @param {Object} currentSettings - Current goodbye settings
 * @returns {ModalBuilder}
 */
export function createGoodbyeConfigModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("goodbye_config_modal")
    .setTitle("Configure Goodbye System");

  // Channel input (read-only, pre-filled from select menu)
  const channelInput = new TextInputBuilder()
    .setCustomId("goodbye_channel")
    .setLabel("Goodbye Channel (Selected)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Channel selected from dropdown")
    .setValue(
      currentSettings.channelId
        ? `<#${currentSettings.channelId}>`
        : "No channel selected",
    )
    .setRequired(false);

  // Message input
  const messageInput = new TextInputBuilder()
    .setCustomId("goodbye_message")
    .setLabel("Goodbye Message")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "Enter goodbye message (use {user}, {server}, {memberCount})\nExample: **{user}** left the server",
    )
    .setValue(currentSettings.message || "")
    .setRequired(false);

  // Enable/Disable input
  const enabledInput = new TextInputBuilder()
    .setCustomId("goodbye_enabled")
    .setLabel("Enable System (true/false)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("true or false")
    .setValue(currentSettings.enabled ? "true" : "false")
    .setRequired(true);

  // Embed format input
  const embedInput = new TextInputBuilder()
    .setCustomId("goodbye_embed")
    .setLabel("Use Embed Format (true/false)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("true or false")
    .setValue(currentSettings.embedEnabled ? "true" : "false")
    .setRequired(true);

  // Add inputs to modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(messageInput),
    new ActionRowBuilder().addComponents(enabledInput),
    new ActionRowBuilder().addComponents(embedInput),
  );

  return modal;
}
