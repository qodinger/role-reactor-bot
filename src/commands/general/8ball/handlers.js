import { getLogger } from "../../../utils/logger.js";
import { create8BallEmbed, createErrorEmbed } from "./embeds.js";

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
      categoryResponses[Math.floor(Math.random() * categories.length)];

    const embed = create8BallEmbed(
      question,
      selectedResponse,
      randomCategory,
      interaction.user,
    );

    await interaction.reply({ embeds: [embed] });
    logger.logCommand("8ball", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in 8ball command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
