import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Create goodbye settings embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} settings - Goodbye settings
 * @param {import('discord.js').TextChannel|null} goodbyeChannel - Goodbye channel
 * @returns {EmbedBuilder}
 */
export function createGoodbyeSettingsEmbed(
  interaction,
  settings,
  goodbyeChannel,
) {
  const embed = new EmbedBuilder()
    .setTitle("Goodbye System")
    .setDescription(
      `Configure goodbye messages for **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Goodbye System",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Configuration fields
  embed.addFields([
    {
      name: "Status",
      value: settings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} Enabled`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Channel",
      value: goodbyeChannel
        ? `${goodbyeChannel}`
        : `${EMOJIS.STATUS.ERROR} Not Set`,
      inline: true,
    },
    {
      name: "Format",
      value: settings.embedEnabled
        ? `${EMOJIS.UI.MENU} Embed`
        : `${EMOJIS.UI.MESSAGE} Text`,
      inline: true,
    },
  ]);

  // Message field
  if (settings.message) {
    embed.addFields([
      {
        name: "Message",
        value:
          settings.message.length > 1000
            ? `${settings.message.substring(0, 1000)}...`
            : settings.message,
        inline: false,
      },
    ]);
  }

  // Placeholders information
  embed.addFields([
    {
      name: "Available Placeholders",
      value: [
        "`{user}` - Mentions the user who left",
        "`{user.name}` - Username of the user who left",
        "`{user.tag}` - Full tag of the user who left",
        "`{user.id}` - ID of the user who left",
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
