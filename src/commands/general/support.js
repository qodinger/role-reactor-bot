import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import config from "../../config/config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("support")
    .setDescription(
      `${EMOJIS.STATUS.INFO} Get the support server link for help and community.`,
    ),

  /**
   * Main command execution handler
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      const supportLink = config.externalLinks.support;
      const botName = client.user?.username || "Role Reactor";
      const botAvatar = client.user?.displayAvatarURL() || null;
      const userName =
        interaction.user.displayName || interaction.user.username;

      const embed = new EmbedBuilder()
        .setColor(THEME.PRIMARY)
        .setAuthor(
          UI_COMPONENTS.createAuthor(`${botName} - Support Server`, botAvatar),
        )
        .setDescription(
          `Hey ${userName},\n` +
            `Need help, want to report an issue, or join our community?\n\n`,
        )
        .addFields({
          name: "**Join our Support Server:**",
          value: `[Click here to join our Support Server](${supportLink})`,
          inline: false,
        })
        .setFooter(
          UI_COMPONENTS.createFooter("We're here to help!", botAvatar),
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Join Support Server")
          .setEmoji(EMOJIS.ACTIONS.LINK)
          .setStyle(ButtonStyle.Link)
          .setURL(supportLink),
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64,
      });
    } catch (_error) {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} Unable to provide the support link. Please try again later.`,
        flags: 64,
      });
    }
  },
};
