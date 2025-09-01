import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createInviteEmbed(botName, botAvatar, userName, inviteLink) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setAuthor(UI_COMPONENTS.createAuthor(`${botName} - Invite me!`, botAvatar))
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
}
