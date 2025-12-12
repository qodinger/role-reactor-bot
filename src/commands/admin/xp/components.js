import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create XP settings components
 * @param {Object} xpSettings - XP settings
 * @returns {ActionRowBuilder[]}
 */
export function createXpSettingsComponents(xpSettings) {
  const buttonComponents = [];

  // Toggle button - Primary style when disabled, Secondary when enabled
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle")
      .setLabel(xpSettings.enabled ? "Disable" : "Enable")
      .setStyle(
        xpSettings.enabled ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  // Configure button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure")
      .setLabel("Configure")
      .setStyle(ButtonStyle.Secondary),
  );

  // Add level-up configuration button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_levelup")
      .setLabel("Level-Up Messages")
      .setStyle(ButtonStyle.Secondary),
  );

  // Add XP source configuration button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_sources")
      .setLabel("XP Sources")
      .setStyle(ButtonStyle.Secondary),
  );

  // Test XP button removed as requested

  // Don't add back to settings button on main page

  return [new ActionRowBuilder().addComponents(...buttonComponents)];
}

/**
 * Create XP source configuration components
 * @param {Object} xpSettings - XP settings
 * @returns {ActionRowBuilder[]}
 */
export function createXpSourceComponents(xpSettings) {
  const buttonComponents = [];

  // Add back button (icon only) as first button
  const backButton = new ButtonBuilder()
    .setCustomId("back_to_settings")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.BACK);

  buttonComponents.push(backButton);

  // Individual XP source toggles
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_message")
      .setLabel(xpSettings.messageXP ? "Message XP" : "Message XP")
      .setStyle(
        xpSettings.messageXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_command")
      .setLabel(xpSettings.commandXP ? "Command XP" : "Command XP")
      .setStyle(
        xpSettings.commandXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_role")
      .setLabel(xpSettings.roleXP ? "Role XP" : "Role XP")
      .setStyle(
        xpSettings.roleXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_voice")
      .setLabel(xpSettings.voiceXP ? "Voice XP" : "Voice XP")
      .setStyle(
        xpSettings.voiceXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  // Bulk actions in second row
  const secondRowButtons = [
    new ButtonBuilder()
      .setCustomId("xp_toggle_all")
      .setLabel(
        xpSettings.messageXP &&
          xpSettings.commandXP &&
          xpSettings.roleXP &&
          xpSettings.voiceXP
          ? "Disable All"
          : "Enable All",
      )
      .setStyle(
        xpSettings.messageXP &&
          xpSettings.commandXP &&
          xpSettings.roleXP &&
          xpSettings.voiceXP
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
  ];

  return [
    new ActionRowBuilder().addComponents(...buttonComponents),
    new ActionRowBuilder().addComponents(...secondRowButtons),
  ];
}

/**
 * Create level-up configuration components
 * @param {Object} xpSettings - XP settings
 * @returns {ActionRowBuilder[]}
 */
export function createLevelUpComponents(xpSettings) {
  const buttonComponents = [];

  // Add back button (icon only) as first button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("back_to_settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

  // Level-up message toggle
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_levelup")
      .setLabel(xpSettings.levelUpMessages ? "Disable" : "Enable")
      .setStyle(
        xpSettings.levelUpMessages
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
  );

  // Channel selection button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_channel")
      .setLabel("Set Level-Up Channel")
      .setStyle(ButtonStyle.Secondary),
  );

  // Test level-up message button
  if (xpSettings.levelUpMessages) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("xp_test_levelup")
        .setLabel("Test Level-Up")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return [new ActionRowBuilder().addComponents(...buttonComponents)];
}

/**
 * Create XP configuration page components
 * @param {Object} xpSettings - Current XP settings
 * @returns {Array<ActionRowBuilder>}
 */
export function createXpConfigPageComponents(_xpSettings) {
  const firstRowButtons = [];

  // Basic Configuration button
  firstRowButtons.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_basic")
      .setLabel("Set XP Amounts")
      .setStyle(ButtonStyle.Secondary),
  );

  // Advanced Configuration button
  firstRowButtons.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_advanced")
      .setLabel("Set Cooldowns & Timing")
      .setStyle(ButtonStyle.Secondary),
  );

  // Add back button (icon only) as first button
  firstRowButtons.unshift(
    new ButtonBuilder()
      .setCustomId("back_to_settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

  return [new ActionRowBuilder().addComponents(...firstRowButtons)];
}

/**
 * Create channel selection menu for level-up messages
 * @param {Array} channels - Available text channels
 * @param {string} currentChannelId - Currently selected channel ID
 * @returns {ActionRowBuilder}
 */
export function createChannelSelectMenu(channels, currentChannelId) {
  const options = channels.map(channel => ({
    label: channel.name,
    value: channel.id,
    description: `#${channel.name}`,
    emoji: EMOJIS.UI.CHANNELS,
    default: channel.id === currentChannelId,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("xp_select_channel")
    .setPlaceholder("Select a channel for level-up messages")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
}
