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

  // Always show configure button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure")
      .setLabel("Configure")
      .setEmoji(EMOJIS.ACTIONS.SETTINGS)
      .setStyle(ButtonStyle.Secondary),
  );

  // Add level-up configuration button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_levelup")
      .setLabel("Level-Up Messages")
      .setEmoji(EMOJIS.FEATURES.EXPERIENCE)
      .setStyle(ButtonStyle.Secondary),
  );

  // Show toggle button (always enabled)
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle")
      .setLabel(xpSettings.enabled ? "Disable" : "Enable")
      .setEmoji(
        xpSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
      )
      .setStyle(ButtonStyle.Secondary),
  );

  // Add XP source configuration buttons as a second row
  const secondRowButtons = [
    new ButtonBuilder()
      .setCustomId("xp_configure_sources")
      .setLabel("XP Sources")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.UI.INFO),
  ];

  // Test XP button removed as requested

  // Don't add back to settings button on main page

  return [
    new ActionRowBuilder().addComponents(...buttonComponents),
    new ActionRowBuilder().addComponents(...secondRowButtons),
  ];
}

/**
 * Create XP source configuration components
 * @param {Object} xpSettings - XP settings
 * @returns {ActionRowBuilder[]}
 */
export function createXpSourceComponents(xpSettings) {
  const buttonComponents = [];

  // Individual XP source toggles
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_message")
      .setLabel(
        xpSettings.messageXP ? "Disable Message XP" : "Enable Message XP",
      )
      .setEmoji(EMOJIS.UI.MESSAGE)
      .setStyle(
        xpSettings.messageXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_command")
      .setLabel(
        xpSettings.commandXP ? "Disable Command XP" : "Enable Command XP",
      )
      .setEmoji(EMOJIS.UI.COMMAND)
      .setStyle(
        xpSettings.commandXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_role")
      .setLabel(xpSettings.roleXP ? "Disable Role XP" : "Enable Role XP")
      .setEmoji(EMOJIS.FEATURES.ROLES)
      .setStyle(
        xpSettings.roleXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_voice")
      .setLabel(xpSettings.voiceXP ? "Disable Voice XP" : "Enable Voice XP")
      .setEmoji("🎤")
      .setStyle(
        xpSettings.voiceXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  );

  // Second row: Bulk actions and back button
  const secondRowButtons = [
    new ButtonBuilder()
      .setCustomId("xp_toggle_all")
      .setLabel(
        xpSettings.messageXP &&
          xpSettings.commandXP &&
          xpSettings.roleXP &&
          xpSettings.voiceXP
          ? "Disable All XP"
          : "Enable All XP",
      )
      .setEmoji(EMOJIS.UI.INFO)
      .setStyle(
        xpSettings.messageXP &&
          xpSettings.commandXP &&
          xpSettings.roleXP &&
          xpSettings.voiceXP
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
  ];

  secondRowButtons.push(
    new ButtonBuilder()
      .setCustomId("back_to_settings")
      .setLabel("Back to Settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

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

  // Level-up message toggle
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("xp_toggle_levelup")
      .setLabel(
        xpSettings.levelUpMessages
          ? "Disable Level-Up Messages"
          : "Enable Level-Up Messages",
      )
      .setEmoji(EMOJIS.FEATURES.EXPERIENCE)
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
      .setLabel("Select Channel")
      .setEmoji(EMOJIS.UI.CHANNELS)
      .setStyle(ButtonStyle.Secondary),
  );

  // Test level-up message button
  if (xpSettings.levelUpMessages) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("xp_test_levelup")
        .setLabel("Test Level-Up")
        .setEmoji(EMOJIS.ACTIONS.TEST)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Create first row with main action buttons
  const firstRow = new ActionRowBuilder().addComponents(...buttonComponents);

  // Create second row with back button
  const secondRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("back_to_settings")
      .setLabel("Back to Settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

  return [firstRow, secondRow];
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
      .setLabel("Basic Configuration")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.SETTINGS),
  );

  // Advanced Configuration button
  firstRowButtons.push(
    new ButtonBuilder()
      .setCustomId("xp_configure_advanced")
      .setLabel("Advanced Configuration")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.SETTINGS),
  );

  // Create first row with configuration buttons
  const firstRow = new ActionRowBuilder().addComponents(...firstRowButtons);

  // Create second row with back button
  const secondRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("back_to_settings")
      .setLabel("Back to Settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

  return [firstRow, secondRow];
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
