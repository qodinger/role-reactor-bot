import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createSponsorEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.STAR} Sponsor the Bot`)
    .setDescription("Support the bot's development and get exclusive benefits!")
    .addFields(
      {
        name: "🎯 Supporter Benefits",
        value: [
          "• 🎯 **Priority Support** - Get help faster when you need it",
          "• 🆕 **Early Access** - Try new features before everyone else",
          "• 🏷️ **Supporter Badge** - Show your support in the community",
          "• 💬 **Direct Feedback** - Help shape the bot's future",
          "• 🎁 **Exclusive Features** - Access to special commands and tools",
        ].join("\n"),
        inline: false,
      },
      {
        name: "💝 How to Support",
        value: [
          "• 💳 **Any Amount** - Give what you can afford",
          "• 🔄 **One-Time or Regular** - Donate once or set up recurring",
          "• 🌟 **No Pressure** - Support only if you want to",
          "• 🎯 **Every Bit Helps** - Even small donations make a difference",
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, an error occurred.");
}
