import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Create the welcome settings embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} settings
 * @param {import('discord.js').Channel} welcomeChannel
 * @param {import('discord.js').Role} autoRole
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createWelcomeSettingsEmbed(
  interaction,
  settings,
  welcomeChannel,
  autoRole,
) {
  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${EMOJIS.FEATURES.ROLES} Welcome System Settings`)
    .setDescription("Current configuration for the welcome system")
    .addFields([
      {
        name: `${EMOJIS.STATUS.SUCCESS} Status`,
        value: settings.enabled ? "🟢 Enabled" : "🔴 Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.CHANNELS} Welcome Channel`,
        value: welcomeChannel ? welcomeChannel.toString() : "Not set",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.IMAGE} Message Format`,
        value: settings.embedEnabled ? "📋 Embed" : "💬 Text",
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
        value: autoRole ? autoRole.toString() : "None",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.QUESTION} Welcome Message`,
        value: settings.message || "Default message",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Available Placeholders`,
        value:
          "`{user}` - User mention\n`{user.name}` - Username\n`{user.tag}` - User tag\n`{user.id}` - User ID\n`{server}` - Server name\n`{server.id}` - Server ID\n`{memberCount}` - Member count\n`{memberCount.ordinal}` - Ordinal member count",
        inline: false,
      },
    ])
    .setFooter({
      text: `${EMOJIS.FEATURES.ROLES} Welcome System • ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL(),
    })
    .setTimestamp();
}
