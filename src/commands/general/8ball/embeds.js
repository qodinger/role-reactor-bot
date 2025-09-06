import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";

export function create8BallEmbed(question, selectedResponse, category, user) {
  // Determine color and styling based on response category
  let embedColor;
  let categoryEmoji;
  let categoryName;
  let description;

  switch (category) {
    case "veryPositive":
      embedColor = THEME.SUCCESS; // Soft sky blue
      categoryEmoji = "✨";
      categoryName = "Exceptional Fortune";
      description = "The universe is absolutely on your side!";
      break;
    case "positive":
      embedColor = THEME.SUCCESS; // Soft sky blue
      categoryEmoji = "🌟";
      categoryName = "Positive Fortune";
      description = "The stars align in your favor!";
      break;
    case "neutral":
      embedColor = THEME.INFO; // Soft blue
      categoryEmoji = "🌫️";
      categoryName = "Uncertain Future";
      description = "The mists of fate are unclear...";
      break;
    case "negative":
      embedColor = THEME.WARNING; // Soft yellow
      categoryEmoji = "💔";
      categoryName = "Challenging Path";
      description = "The road ahead may be difficult...";
      break;
    case "veryNegative":
      embedColor = THEME.ERROR; // Soft coral
      categoryEmoji = "⚠️";
      categoryName = "Dangerous Path";
      description = "The cosmic forces strongly warn against this...";
      break;
    default:
      embedColor = THEME.PRIMARY; // Soft lavender
      categoryEmoji = "🎱";
      categoryName = "Mystical Response";
      description = "The cosmic forces have spoken...";
  }

  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🎱 Magic 8-Ball`)
    .setDescription(`*${description}*`)
    .addFields([
      {
        name: `❓ Your Question`,
        value: `*"${question}"*`,
        inline: false,
      },
      {
        name: `${categoryEmoji} ${categoryName}`,
        value: `**${selectedResponse.emoji} ${selectedResponse.text}**`,
        inline: false,
      },
    ])
    .setFooter({
      text: `Asked by ${user.username} • Role Reactor`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp()
    .setAuthor({
      name: "🔮 Mystical Oracle",
    });
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR) // Soft coral
    .setTitle(`🎱 Magic 8-Ball Error`)
    .setDescription("*The cosmic forces are temporarily unavailable...*")
    .addFields([
      {
        name: "❌ What Happened?",
        value: "The mystical energies are disrupted. Please try again later.",
        inline: false,
      },
      {
        name: "🔮 Oracle Status",
        value: "The 8-ball needs a moment to realign with the universe.",
        inline: false,
      },
    ])
    .setFooter({
      text: "Role Reactor • Mystical Services",
    })
    .setTimestamp();
}
