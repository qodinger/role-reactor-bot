import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create welcome settings components
 * @param {Object} settings - Welcome settings
 * @returns {ActionRowBuilder[]}
 */
export function createWelcomeSettingsComponents(settings) {
  const buttonComponents = [];

  // Toggle button - Primary style when disabled, Secondary when enabled
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_toggle")
      .setLabel(settings.enabled ? "Disable" : "Enable")
      .setStyle(settings.enabled ? ButtonStyle.Secondary : ButtonStyle.Primary),
  );

  // Always show configure button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_configure")
      .setLabel("Configure")
      .setStyle(ButtonStyle.Secondary),
  );

  // Add role configuration button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_configure_role")
      .setLabel("Auto-Role")
      .setStyle(ButtonStyle.Secondary),
  );

  // Add format switch button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_format")
      .setLabel(`Switch to ${settings.embedEnabled ? "Text" : "Embed"}`)
      .setStyle(ButtonStyle.Secondary),
  );

  // Add test button if welcome system is enabled and channel is configured
  if (settings.enabled && settings.channelId) {
    buttonComponents.push(
      new ButtonBuilder()
        .setCustomId("welcome_test")
        .setLabel("Test Welcome")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return [new ActionRowBuilder().addComponents(...buttonComponents)];
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
    default: currentChannelId === channel.id, // Set as default if this is the current channel
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
        default: true, // Set as default since it's the current channel
      });
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("welcome_channel_select")
    .setPlaceholder(
      currentChannelId
        ? `Current: ${guild.channels.cache.get(currentChannelId)?.name || "Unknown Channel"}`
        : "Select a channel for welcome messages",
    )
    .addOptions(selectOptions);

  const backButton = new ButtonBuilder()
    .setCustomId("welcome_back_to_settings")
    .setEmoji(EMOJIS.ACTIONS.BACK)
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder().addComponents(selectMenu),
    new ActionRowBuilder().addComponents(backButton),
  ];
}

/**
 * Create role selection components for welcome system
 * @param {import('discord.js').Guild} guild - The guild to get roles from
 * @param {string} currentRoleId - Currently selected role ID
 * @returns {ActionRowBuilder[]}
 */
export function createRoleSelectComponents(guild, currentRoleId = null) {
  try {
    // Get roles that the bot can assign (below bot's highest role)
    const botHighestRole = guild.members.me?.roles?.highest;
    if (!botHighestRole) {
      console.error(
        "Bot member not found in guild, cannot determine assignable roles",
      );
      return [];
    }

    const assignableRoles = guild.roles.cache
      .filter(
        role =>
          role.id !== guild.id && // Not @everyone
          role.position < botHighestRole.position && // Below bot's highest role
          !role.managed, // Not managed by Discord
      )
      .sort((a, b) => b.position - a.position) // Sort by position (highest first)
      .first(25); // Discord limit is 25 options

    const selectOptions = assignableRoles.map(role => ({
      label: role.name,
      description: `Position: ${role.position} • Members: ${role.members.size}`,
      value: role.id,
      emoji: EMOJIS.FEATURES.ROLES,
      default: currentRoleId === role.id, // Set as default if this is the current role
    }));

    // Always add current role at the top if it exists
    if (currentRoleId) {
      const currentRole = guild.roles.cache.get(currentRoleId);
      if (currentRole) {
        // Remove current role from the list if it's already there
        const filteredOptions = selectOptions.filter(
          opt => opt.value !== currentRoleId,
        );

        // Add current role at the top
        selectOptions.length = 0; // Clear the array
        selectOptions.push({
          label: `${currentRole.name} (Current)`,
          description: `Position: ${currentRole.position} • Members: ${currentRole.members.size}`,
          value: currentRoleId,
          emoji: EMOJIS.FEATURES.ROLES,
          default: true, // Set as default since it's the current role
        });

        // Add the rest of the roles
        selectOptions.push(...filteredOptions);
      }
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("welcome_role_select")
      .setPlaceholder(
        currentRoleId
          ? `Current: ${guild.roles.cache.get(currentRoleId)?.name || "Unknown Role"}`
          : "Select a role for auto-assignment",
      )
      .addOptions(selectOptions);

    const backButton = new ButtonBuilder()
      .setCustomId("welcome_back_to_settings")
      .setEmoji(EMOJIS.ACTIONS.BACK)
      .setStyle(ButtonStyle.Secondary);

    const clearRoleButton = new ButtonBuilder()
      .setCustomId("welcome_clear_role")
      .setLabel("Clear Auto-Role")
      .setStyle(ButtonStyle.Secondary);

    return [
      new ActionRowBuilder().addComponents(selectMenu),
      new ActionRowBuilder().addComponents(backButton, clearRoleButton),
    ];
  } catch (error) {
    console.error("Error creating role select components:", error);
    return [];
  }
}

/**
 * Create welcome configuration page components
 * @param {import('discord.js').Guild} guild - The guild
 * @param {Object} currentSettings - Current welcome settings
 * @returns {ActionRowBuilder[]}
 */
export function createWelcomeConfigPageComponents(
  guild,
  _currentSettings = {},
) {
  const buttonComponents = [];

  // Channel selection button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_select_channel")
      .setLabel("Select Channel")
      .setStyle(ButtonStyle.Secondary),
  );

  // Message configuration button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_configure_message")
      .setLabel("Configure Message")
      .setStyle(ButtonStyle.Secondary),
  );

  // Reset button
  buttonComponents.push(
    new ButtonBuilder()
      .setCustomId("welcome_reset")
      .setLabel("Reset")
      .setStyle(ButtonStyle.Danger),
  );

  // Add back button (icon only) as first button
  buttonComponents.unshift(
    new ButtonBuilder()
      .setCustomId("welcome_back_to_settings")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.BACK),
  );

  return [new ActionRowBuilder().addComponents(...buttonComponents)];
}
