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
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.FEATURES.ROLES} Welcome System Settings`)
    .setDescription(
      `Current welcome system configuration for **${interaction.guild.name}**`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Welcome System",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add configuration fields
  embed.addFields([
    {
      name: `${EMOJIS.STATUS.SUCCESS} Status`,
      value: settings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.CHANNELS} Channel`,
      value: welcomeChannel
        ? `${welcomeChannel}`
        : `${EMOJIS.STATUS.ERROR} **Not Set**`,
      inline: true,
    },
    {
      name: `${EMOJIS.ACTIONS.EDIT} Format`,
      value: settings.embedEnabled
        ? `${EMOJIS.UI.MENU} **Embed**`
        : `${EMOJIS.UI.MESSAGE} **Text**`,
      inline: true,
    },
    {
      name: `${EMOJIS.FEATURES.ROLES} Auto-Role`,
      value: autoRole ? `${autoRole}` : `${EMOJIS.STATUS.ERROR} **None**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.MESSAGE} Message`,
      value: settings.message || "No custom message set",
      inline: false,
    },
  ]);

  // Add placeholder information
  embed.addFields([
    {
      name: `${EMOJIS.UI.INFO} Available Placeholders`,
      value: [
        "`{user}` - Mentions the user who joined",
        "`{user.name}` - Username of the user who joined",
        "`{user.tag}` - Full tag of the user who joined",
        "`{user.id}` - ID of the user who joined",
        "`{server}` - Server name",
        "`{server.id}` - Server ID",
        "`{memberCount}` - Current member count",
        "`{memberCount.ordinal}` - Ordinal member count (1st, 2nd, etc.)",
      ].join("\n"),
      inline: false,
    },
  ]);

  return embed;
}
