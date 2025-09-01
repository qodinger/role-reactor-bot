import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Create the welcome settings success embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} newSettings
 * @param {import('discord.js').Channel} channel
 * @param {import('discord.js').Role} autoRole
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createWelcomeSettingsEmbed(
  interaction,
  newSettings,
  channel,
  autoRole,
) {
  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Welcome System Configured`)
    .setDescription("Your welcome system has been successfully configured!")
    .addFields([
      {
        name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
        value: channel.toString(),
        inline: true,
      },
      {
        name: `${EMOJIS.STATUS.SUCCESS} Status`,
        value: newSettings.enabled ? "Enabled" : "Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.IMAGE} Format`,
        value: newSettings.embedEnabled ? "Embed" : "Text",
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
        value: autoRole ? autoRole.toString() : "None",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.QUESTION} Welcome Message`,
        value: newSettings.message || "Default message",
        inline: false,
      },
    ])
    .setFooter({
      text: `${EMOJIS.FEATURES.ROLES} Welcome System • ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL(),
    })
    .setTimestamp();
}
