import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription(`${EMOJIS.UI.QUESTION} Ask the magic 8-ball a question`)
  .addStringOption(option =>
    option
      .setName("question")
      .setDescription("Your question for the magic 8-ball")
      .setRequired(true),
  );

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const question = interaction.options.getString("question");

    // Enhanced responses with categories and emojis
    const responseCategories = {
      positive: [
        { text: "It is certain.", emoji: "✨" },
        { text: "It is decidedly so.", emoji: "🌟" },
        { text: "Without a doubt.", emoji: "💫" },
        { text: "Yes - definitely.", emoji: "✅" },
        { text: "You may rely on it.", emoji: "🎯" },
        { text: "As I see it, yes.", emoji: "🔮" },
        { text: "Most likely.", emoji: "🎪" },
        { text: "Outlook good.", emoji: "🌈" },
        { text: "Yes.", emoji: "🎉" },
        { text: "Signs point to yes.", emoji: "🚀" },
      ],
      neutral: [
        { text: "Reply hazy, try again.", emoji: "🌫️" },
        { text: "Ask again later.", emoji: "⏰" },
        { text: "Better not tell you now.", emoji: "🤐" },
        { text: "Cannot predict now.", emoji: "❓" },
        { text: "Concentrate and ask again.", emoji: "🧘" },
      ],
      negative: [
        { text: "Don't count on it.", emoji: "💔" },
        { text: "My reply is no.", emoji: "❌" },
        { text: "My sources say no.", emoji: "📰" },
        { text: "Outlook not so good.", emoji: "☁️" },
        { text: "Very doubtful.", emoji: "🤨" },
      ],
    };

    // Select random category first, then random response from that category
    const categories = Object.keys(responseCategories);
    const randomCategory =
      categories[Math.floor(Math.random() * categories.length)];
    const categoryResponses = responseCategories[randomCategory];
    const selectedResponse =
      categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

    // Determine color based on response category
    let embedColor;
    let categoryEmoji;
    switch (randomCategory) {
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

    const embed = new EmbedBuilder()
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
          `Asked by ${interaction.user.username}`,
          interaction.user.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    logger.logCommand("8ball", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in 8ball command", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(THEME.ERROR)
          .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
          .setDescription("Sorry, the magic 8-ball is broken right now."),
      ],
    });
  }
}
