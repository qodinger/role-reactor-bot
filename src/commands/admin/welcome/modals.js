import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Create the welcome configuration modal
 * @param {Object} currentSettings - Current welcome settings
 * @returns {ModalBuilder}
 */
export function createWelcomeConfigModal(currentSettings = {}) {
  const modal = new ModalBuilder()
    .setCustomId("welcome_config_modal")
    .setTitle("Configure Welcome Message");

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

/**
 * Create the welcome configuration page embed
 * @param {import('discord.js').Interaction} interaction - The interaction
 * @param {Object} currentSettings - Current welcome settings
 * @returns {Object} Embed object
 */
export function createWelcomeConfigPageEmbed(
  interaction,
  currentSettings = {},
) {
  const currentChannel = currentSettings.channelId
    ? interaction.guild.channels.cache.get(currentSettings.channelId)
    : null;

  return {
    title: "Welcome Configuration",
    description: "Configure your welcome system settings",
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
          `• **Select Channel** - Choose where welcome messages are sent`,
          `• **Configure Message** - Customize the welcome message content`,
          `• **Reset** - Reset all welcome system settings to defaults`,
        ].join("\n"),
        inline: false,
      },
    ],
    footer: {
      text: "Role Reactor • Welcome System",
    },
  };
}
