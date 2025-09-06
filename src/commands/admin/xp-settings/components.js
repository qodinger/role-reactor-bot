import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create the XP settings action buttons
 * @param {Object} xpSettings
 * @returns {import('discord.js').ActionRowBuilder[]}
 */
export function createXpSettingsComponents(xpSettings) {
  // First row: System and All XP toggles
  const systemButtons = [
    new ButtonBuilder()
      .setCustomId("xp_toggle_system")
      .setLabel(xpSettings.enabled ? "Disable System" : "Enable System")
      .setEmoji(
        xpSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
      )
      .setStyle(xpSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("xp_toggle_all")
      .setLabel(
        xpSettings.messageXP && xpSettings.commandXP && xpSettings.roleXP
          ? "Disable All XP"
          : "Enable All XP",
      )
      .setEmoji(EMOJIS.UI.INFO)
      .setStyle(
        xpSettings.messageXP && xpSettings.commandXP && xpSettings.roleXP
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
      ),
  ];

  // Second row: Individual XP toggles
  const individualToggleButtons = [
    new ButtonBuilder()
      .setCustomId("xp_toggle_message")
      .setLabel(
        xpSettings.messageXP ? "Disable Message XP" : "Enable Message XP",
      )
      .setEmoji(EMOJIS.UI.MESSAGE)
      .setStyle(
        xpSettings.messageXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("xp_toggle_command")
      .setLabel(
        xpSettings.commandXP ? "Disable Command XP" : "Enable Command XP",
      )
      .setEmoji(EMOJIS.UI.COMMAND)
      .setStyle(
        xpSettings.commandXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
    new ButtonBuilder()
      .setCustomId("xp_toggle_role")
      .setLabel(xpSettings.roleXP ? "Disable Role XP" : "Enable Role XP")
      .setEmoji(EMOJIS.FEATURES.ROLES)
      .setStyle(
        xpSettings.roleXP ? ButtonStyle.Secondary : ButtonStyle.Primary,
      ),
  ];

  // Third row: Configuration buttons
  const configButtons = [
    new ButtonBuilder()
      .setCustomId("xp_config_message")
      .setLabel("Configure Message XP")
      .setEmoji(EMOJIS.UI.MESSAGE)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("xp_config_command")
      .setLabel("Configure Command XP")
      .setEmoji(EMOJIS.UI.COMMAND)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("xp_config_role")
      .setLabel("Configure Role XP")
      .setEmoji(EMOJIS.FEATURES.ROLES)
      .setStyle(ButtonStyle.Secondary),
  ];

  return [
    new ActionRowBuilder().addComponents(...systemButtons),
    new ActionRowBuilder().addComponents(...individualToggleButtons),
    new ActionRowBuilder().addComponents(...configButtons),
  ];
}
