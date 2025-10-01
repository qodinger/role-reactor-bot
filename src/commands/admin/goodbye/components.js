import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create goodbye settings components
 * @param {Object} settings - Goodbye settings
 * @returns {ActionRowBuilder[]}
 */
export function createGoodbyeSettingsComponents(settings) {
  const buttonComponents = [];

  // Always show configure button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("goodbye_configure")
      .setLabel("Configure")
      .setEmoji(EMOJIS.ACTIONS.SETTINGS)
      .setStyle(ButtonStyle.Secondary),
  );

  // Only add test button if goodbye system is enabled and channel is configured
  if (settings.enabled && settings.channelId) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("goodbye_test")
        .setLabel("Test Goodbye")
        .setEmoji(EMOJIS.ACTIONS.QUICK)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Show toggle button (disabled if no channel and system is disabled)
  const canToggle = settings.channelId || settings.enabled;
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("goodbye_toggle")
      .setLabel(settings.enabled ? "Disable" : "Enable")
      .setEmoji(settings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canToggle),
    new ButtonBuilder()
      .setCustomId("goodbye_reset")
      .setLabel("Reset")
      .setEmoji(EMOJIS.ACTIONS.DELETE)
      .setStyle(ButtonStyle.Secondary),
  );

  // Add format switch button as a second row
  const formatRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("goodbye_format")
      .setLabel(`Switch to ${settings.embedEnabled ? "Text" : "Embed"}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.REFRESH),
  );

  return [new ActionRowBuilder().addComponents(...buttonComponents), formatRow];
}

/**
 * Create channel selection components
 * @param {import('discord.js').Guild} guild - The guild to get channels from
 * @param {string} currentChannelId - Currently selected channel ID
 * @returns {ActionRowBuilder[]}
 */
export function createChannelSelectComponents(guild, currentChannelId = null) {
  // Get text channels that the bot can send messages to
  const textChannels = guild.channels.cache
    .filter(
      channel =>
        channel.type === 0 && // Text channel
        channel.permissionsFor(guild.members.me)?.has("SendMessages"),
    )
    .sort((a, b) => a.position - b.position)
    .first(25); // Discord limit is 25 options

  const selectOptions = textChannels.map(channel => ({
    label: `#${channel.name}`,
    description: channel.topic || `Channel ID: ${channel.id}`,
    value: channel.id,
    emoji: EMOJIS.UI.CHANNELS,
  }));

  // Add current channel if it's not in the list
  if (
    currentChannelId &&
    !selectOptions.find(opt => opt.value === currentChannelId)
  ) {
    const currentChannel = guild.channels.cache.get(currentChannelId);
    if (currentChannel) {
      selectOptions.unshift({
        label: `#${currentChannel.name} (Current)`,
        description: currentChannel.topic || `Channel ID: ${currentChannel.id}`,
        value: currentChannelId,
        emoji: EMOJIS.UI.CHANNELS,
      });
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("goodbye_channel_select")
    .setPlaceholder("Select a channel for goodbye messages")
    .addOptions(selectOptions);

  const backButton = new ButtonBuilder()
    .setCustomId("goodbye_settings")
    .setLabel("Back to Settings")
    .setEmoji(EMOJIS.ACTIONS.BACK)
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder().addComponents(selectMenu),
    new ActionRowBuilder().addComponents(backButton),
  ];
}
