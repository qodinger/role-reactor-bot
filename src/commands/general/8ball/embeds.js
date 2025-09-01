import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function create8BallEmbed(question, selectedResponse, category, user) {
  // Determine color based on response category
  let embedColor;
  let categoryEmoji;
  switch (category) {
    case "positive":
      embedColor = THEME.SUCCESS;
      categoryEmoji = "✨";
      break;
    case "neutral":
      embedColor = THEME.INFO;
      categoryEmoji = "🤔";
      break;
    case "negative":
      embedColor = THEME.WARNING;
      categoryEmoji = "💭";
      break;
    default:
      embedColor = THEME.INFO;
      categoryEmoji = "🎱";
  }

  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${EMOJIS.UI.QUESTION} Magic 8-Ball`)
    .addFields(
      {
        name: `${EMOJIS.UI.QUESTION} Question`,
        value: `*"${question}"*`,
        inline: false,
      },
      {
        name: `${categoryEmoji} Answer`,
        value: `**${selectedResponse.emoji} ${selectedResponse.text}**`,
        inline: false,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Asked by ${user.username}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, the magic 8-ball is broken right now.");
}
