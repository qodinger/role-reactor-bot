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

export const data = new SlashCommandBuilder()
  .setName("invite")
  .setDescription(`Get the bot's invite link for your server`);

export async function execute(interaction, client) {
  try {
    // Generate invite link dynamically
    let inviteLink = client.inviteLink;
    if (!inviteLink) {
      inviteLink = await getDefaultInviteLink(client);
    }
    if (!inviteLink) {
      throw new Error("Unable to generate invite link.");
    }

    const supportLink = config.externalLinks.support;
    const botName = client.user?.username || "Role Reactor";
    const botAvatar = client.user?.displayAvatarURL() || null;
    const userName = interaction.user.displayName || interaction.user.username;

    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setAuthor(
        UI_COMPONENTS.createAuthor(`${botName} - Invite me!`, botAvatar),
      )
      .setDescription(
        `Hey ${userName}! 👋\n\n` +
          `**${botName}** is the ultimate Discord bot for easy role management through reactions!\n\n` +
          `🎯 **Simple Setup** • 🎨 **Beautiful UI** • ⚡ **Instant Roles**`,
      )
      .addFields(
        {
          name: "🚀 Key Features",
          value: [
            "• **One-Click Roles** - Members get roles instantly with reactions",
            "• **Event Roles** - Perfect for tournaments, giveaways, and special access",
            "• **Safe & Secure** - Admin-only management keeps your server organized",
            "• **Always Online** - Built-in monitoring ensures smooth operation",
            "• **Privacy First** - No personal data collection beyond Discord IDs",
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔗 Invite Link",
          value: `[Click here to add ${botName} to your server](${inviteLink})`,
          inline: false,
        },
      )
      .setFooter(
        UI_COMPONENTS.createFooter(
          "Thank you for choosing Role Reactor! 🎉",
          botAvatar,
        ),
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Invite me!")
        .setEmoji(EMOJIS.ACTIONS.LINK)
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setEmoji("🆘")
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
      content: `${EMOJIS.STATUS.ERROR} Unable to generate invite link. Please try again later or contact support.`,
      flags: 64,
    });
  }
}
