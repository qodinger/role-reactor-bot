import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import config from "../../config/config.js";
import { getDefaultInviteLink } from "../../utils/discord/invite.js";

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription(
    `${EMOJIS.STATUS.INFO} Get the support server link for help and community.`,
  );

export async function execute(interaction, client) {
  try {
    const supportLink = config.externalLinks.support;
    const guideLink = config.externalLinks.guide;
    const botName = client.user?.username || "Role Reactor";
    const botAvatar = client.user?.displayAvatarURL() || null;
    const userName = interaction.user.displayName || interaction.user.username;

    // Generate invite link
    let inviteLink = client.inviteLink;
    if (!inviteLink) {
      inviteLink = await getDefaultInviteLink(client);
    }

    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setAuthor(
        UI_COMPONENTS.createAuthor(
          `${botName} - Support & Community`,
          botAvatar,
        ),
      )
      .setDescription(
        `Hey ${userName}! 👋\n\n` +
          `Need help with **${botName}**? Join our community for support!\n\n` +
          `🆘 **24/7 Support** • 🤝 **Friendly Community** • 📚 **Helpful Guides**`,
      )
      .addFields(
        {
          name: "🆘 What We Offer",
          value: [
            "• **Discord Support** - Get help from our team and community",
            "• **Bug Reports** - Report issues and suggest improvements",
            "• **Feature Requests** - Suggest new features you'd like to see",
            "• **Setup Help** - Get assistance with bot configuration",
            "• **Troubleshooting** - Find solutions to common problems",
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔗 Join Our Community",
          value: `[Click here to join our Support Server](${supportLink})`,
          inline: false,
        },
      )
      .setFooter(
        UI_COMPONENTS.createFooter("We're here to help! 🎉", botAvatar),
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Join Support Server")
        .setEmoji(EMOJIS.ACTIONS.LINK)
        .setStyle(ButtonStyle.Link)
        .setURL(supportLink),
      new ButtonBuilder()
        .setLabel("Documentation")
        .setEmoji("📚")
        .setStyle(ButtonStyle.Link)
        .setURL(guideLink),
      new ButtonBuilder()
        .setLabel("Invite Bot")
        .setEmoji("➕")
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
      content: `${EMOJIS.STATUS.ERROR} Unable to provide the support link. Please try again later.`,
      flags: 64,
    });
  }
}
