import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Create goodbye configuration modal
 * @param {Object} currentSettings - Current goodbye settings
 * @returns {ModalBuilder}
 */
export function createGoodbyeConfigModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("goodbye_config_modal")
    .setTitle("Configure Goodbye Message");

  // Message input
  const messageInput = new TextInputBuilder()
    .setCustomId("goodbye_message")
    .setLabel("Message")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      "Enter goodbye message (use {user}, {server}, {memberCount})",
    )
    .setValue(
      currentSettings.message ||
        "**{user}** left the server\nThanks for being part of **{server}**! 👋",
    )
    .setRequired(false);

  // Add inputs to modal
  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

  return modal;
}

/**
 * Create the goodbye configuration page embed
 * @param {import('discord.js').Interaction} interaction - The interaction
 * @param {Object} currentSettings - Current goodbye settings
 * @returns {Object} Embed object
 */
export function createGoodbyeConfigPageEmbed(
  interaction,
  currentSettings = {},
) {
  const currentChannel = currentSettings.channelId
    ? interaction.guild.channels.cache.get(currentSettings.channelId)
    : null;

  return {
    title: "Goodbye Configuration",
    description: "Configure your goodbye system settings",
    color: THEME.PRIMARY,
    fields: [
      {
        name: "Current Settings",
        value: [
          `**Channel:** ${currentChannel ? currentChannel.toString() : "Not set"}`,
          `**Message:** ${currentSettings.message ? "Custom message set" : "Using default"}`,
          `**Status:** ${currentSettings.enabled ? `${EMOJIS.STATUS.SUCCESS} Enabled` : `${EMOJIS.STATUS.ERROR} Disabled`}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Configuration Options",
        value: [
          `• **Select Channel** - Choose where goodbye messages are sent`,
          `• **Configure Message** - Customize the goodbye message content`,
          `• **Reset** - Reset all goodbye system settings to defaults`,
        ].join("\n"),
        inline: false,
      },
    ],
    footer: {
      text: "Role Reactor • Goodbye System",
    },
  };
}
