import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getDefaultInviteLink } from "../../utils/discord/invite.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import config from "../../config/config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription(
      `${EMOJIS.ACTIONS.LINK} Get the bot's invite link for your server`,
    ),

  /**
   * Main command execution handler
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    try {
      // Prefer config, fallback to generated link
      let inviteLink = config.discord.inviteURL;
      if (!inviteLink) {
        inviteLink = client.inviteLink;
      }
      if (!inviteLink) {
        inviteLink = await getDefaultInviteLink(client);
      }
      if (!inviteLink) {
        throw new Error("Unable to generate invite link.");
      }

      const botName = client.user?.username || "Role Reactor";
      const botAvatar = client.user?.displayAvatarURL() || null;
      const userName =
        interaction.user.displayName || interaction.user.username;

      const embed = new EmbedBuilder()
        .setColor(THEME.PRIMARY)
        .setAuthor(
          UI_COMPONENTS.createAuthor(`${botName} - Invite me!`, botAvatar),
        )
        .setDescription(
          `Hey ${userName},\n` +
            `Thank you for your interest in **${botName}**!\n\n`,
        )
        .addFields({
          name: "**Invite the bot to your server:**",
          value: `[Click here to add ${botName}](${inviteLink})`,
          inline: false,
        })
        .setFooter(
          UI_COMPONENTS.createFooter(
            "Thank you for inviting Role Reactor!",
            botAvatar,
          ),
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Invite me!")
          .setEmoji(EMOJIS.ACTIONS.LINK)
          .setStyle(ButtonStyle.Link)
          .setURL(inviteLink),
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64,
      });
    } catch (_error) {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} Unable to generate invite link. Please try again later or contact support.`,
        flags: 64,
      });
    }
  },
};
