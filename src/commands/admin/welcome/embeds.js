import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

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
    .setTitle("Welcome System")
    .setDescription(
      `Configure welcome messages for **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Welcome System",
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
      value: welcomeChannel
        ? `${welcomeChannel}`
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
    {
      name: "Auto-Role",
      value: autoRole ? `${autoRole}` : `${EMOJIS.STATUS.ERROR} None`,
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
