import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createSponsorEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Support the Bot")
    .setDescription("Help keep this bot free and running for everyone!")
    .addFields(
      {
        name: "Why Support?",
        value: [
          "• **Development** - Support new features and improvements",
          "• **Maintenance** - Keep servers running and updated",
          "• **Bug Fixes** - Ensure the bot stays reliable",
          "• **Keep It Free** - Help maintain the bot's free services",
          "• **Innovation** - Enable new ideas and capabilities",
        ].join("\n"),
        inline: false,
      },
      {
        name: "How to Support",
        value: [
          "• **Any Amount** - Give what you can afford",
          "• **One-Time or Regular** - Donate once or set up recurring",
          "• **No Pressure** - Support only if you want to",
          "• **Every Bit Helps** - Even small donations make a difference",
          "• **No Commitment** - Cancel anytime",
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
    .setTitle("Error")
    .setDescription("Sorry, an error occurred.");
}
