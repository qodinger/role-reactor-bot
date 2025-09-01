import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Create the XP settings action buttons
 * @param {Object} xpSettings
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createXpSettingsComponents(xpSettings) {
  const buttonComponents = [
    new ButtonBuilder()
      .setCustomId("xp_toggle_system")
      .setLabel(xpSettings.enabled ? "Disable System" : "Enable System")
      .setEmoji(
        xpSettings.enabled ? EMOJIS.STATUS.ERROR : EMOJIS.STATUS.SUCCESS,
      )
      .setStyle(xpSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
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

  return new ActionRowBuilder().addComponents(...buttonComponents);
}
