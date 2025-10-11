import { getLogger } from "../../../utils/logger.js";
import { create8BallEmbed, createErrorEmbed } from "./embeds.js";
import { EMOJIS } from "../../../config/theme.js";

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: false });

    const question = interaction.options.getString("question");

    // Smart response analysis
    const questionAnalysis = analyzeQuestion(question);

    // Enhanced responses with smart categorization
    const responseCategories = {
      veryPositive: [
        {
          text: "It is absolutely certain!",
          emoji: EMOJIS.EIGHTBALL.VERY_POSITIVE,
        },
        {
          text: "The stars have aligned perfectly!",
          emoji: EMOJIS.EIGHTBALL.STARS,
        },
        {
          text: "Without any doubt whatsoever!",
          emoji: EMOJIS.EIGHTBALL.CRYSTAL,
        },
        {
          text: "Yes - this is your destiny!",
          emoji: EMOJIS.EIGHTBALL.DESTINY,
        },
        {
          text: "The universe is on your side!",
          emoji: EMOJIS.EIGHTBALL.UNIVERSE,
        },
        {
          text: "This is written in the stars!",
          emoji: EMOJIS.EIGHTBALL.STARS,
        },
        {
          text: "Absolutely, without question!",
          emoji: EMOJIS.EIGHTBALL.MAGIC,
        },
        {
          text: "The future looks incredibly bright!",
          emoji: EMOJIS.EIGHTBALL.ENERGY,
        },
        { text: "Yes! This is your moment!", emoji: EMOJIS.EIGHTBALL.FORTUNE },
        {
          text: "All signs point to spectacular success!",
          emoji: EMOJIS.EIGHTBALL.COSMIC,
        },
      ],
      positive: [
        { text: "It is certain.", emoji: EMOJIS.EIGHTBALL.POSITIVE },
        { text: "It is decidedly so.", emoji: EMOJIS.EIGHTBALL.STARS },
        { text: "Without a doubt.", emoji: EMOJIS.EIGHTBALL.CRYSTAL },
        { text: "Yes - definitely.", emoji: EMOJIS.EIGHTBALL.MAGIC },
        { text: "You may rely on it.", emoji: EMOJIS.EIGHTBALL.DESTINY },
        { text: "As I see it, yes.", emoji: EMOJIS.EIGHTBALL.FATE },
        { text: "Most likely.", emoji: EMOJIS.EIGHTBALL.FORTUNE },
        { text: "Outlook good.", emoji: EMOJIS.EIGHTBALL.ENERGY },
        { text: "Yes.", emoji: EMOJIS.EIGHTBALL.POSITIVE },
        { text: "Signs point to yes.", emoji: EMOJIS.EIGHTBALL.COSMIC },
      ],
      neutral: [
        { text: "Reply hazy, try again.", emoji: EMOJIS.EIGHTBALL.NEUTRAL },
        { text: "Ask again later.", emoji: EMOJIS.EIGHTBALL.MYSTICAL },
        { text: "Better not tell you now.", emoji: EMOJIS.EIGHTBALL.ENIGMA },
        { text: "Cannot predict now.", emoji: EMOJIS.EIGHTBALL.MYSTERY },
        { text: "Concentrate and ask again.", emoji: EMOJIS.EIGHTBALL.WISDOM },
        {
          text: "The answer is unclear at this time.",
          emoji: EMOJIS.EIGHTBALL.FATE,
        },
        {
          text: "Time will reveal the truth.",
          emoji: EMOJIS.EIGHTBALL.PROPHECY,
        },
        {
          text: "The mists of fate are thick today.",
          emoji: EMOJIS.EIGHTBALL.NEUTRAL,
        },
      ],
      negative: [
        { text: "Don't count on it.", emoji: EMOJIS.EIGHTBALL.NEGATIVE },
        { text: "My reply is no.", emoji: EMOJIS.EIGHTBALL.NEGATIVE },
        { text: "My sources say no.", emoji: EMOJIS.EIGHTBALL.NEGATIVE },
        { text: "Outlook not so good.", emoji: EMOJIS.EIGHTBALL.NEGATIVE },
        { text: "Very doubtful.", emoji: EMOJIS.EIGHTBALL.ENIGMA },
        {
          text: "The signs are not favorable.",
          emoji: EMOJIS.EIGHTBALL.NEGATIVE,
        },
        {
          text: "This path may be challenging.",
          emoji: EMOJIS.EIGHTBALL.NEGATIVE,
        },
      ],
      veryNegative: [
        {
          text: "Absolutely not - avoid this path!",
          emoji: EMOJIS.EIGHTBALL.VERY_NEGATIVE,
        },
        {
          text: "The stars strongly advise against this!",
          emoji: EMOJIS.EIGHTBALL.VERY_NEGATIVE,
        },
        {
          text: "This would be a grave mistake!",
          emoji: EMOJIS.EIGHTBALL.VERY_NEGATIVE,
        },
        {
          text: "The future looks very bleak!",
          emoji: EMOJIS.EIGHTBALL.NEGATIVE,
        },
        {
          text: "Extremely doubtful - steer clear!",
          emoji: EMOJIS.EIGHTBALL.ENIGMA,
        },
        {
          text: "The cosmic forces warn against this!",
          emoji: EMOJIS.EIGHTBALL.VERY_NEGATIVE,
        },
        {
          text: "This path leads to certain failure!",
          emoji: EMOJIS.EIGHTBALL.VERY_NEGATIVE,
        },
      ],
    };

    // Smart category selection based on question analysis
    const selectedCategory = selectSmartCategory(
      questionAnalysis,
      responseCategories,
    );
    const categoryResponses = responseCategories[selectedCategory];
    const selectedResponse =
      categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

    const embed = create8BallEmbed(
      question,
      selectedResponse,
      selectedCategory,
      interaction.user,
    );

    await interaction.editReply({ embeds: [embed] });
    logger.logCommand("8ball", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in 8ball command", error);
    await interaction.editReply({
      embeds: [createErrorEmbed()],
    });
  }
}

/**
 * Analyze question to determine context and sentiment
 * @param {string} question - The user's question
 * @returns {Object} Analysis results
 */
function analyzeQuestion(question) {
  const lowerQuestion = question.toLowerCase();

  // Question type detection
  const questionTypes = {
    yesNo:
      /^(will|should|can|could|would|do|does|did|is|are|was|were|have|has|had)\b/i.test(
        question,
      ),
    when: /^(when|what time|how long|how soon)\b/i.test(question),
    how: /^(how|what way|in what way)\b/i.test(question),
    why: /^(why|what reason|for what reason)\b/i.test(question),
    what: /^(what|which|who)\b/i.test(question),
  };

  // Sentiment analysis keywords
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "happy",
    "success",
    "win",
    "achieve",
    "dream",
    "hope",
    "wish",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "hate",
    "sad",
    "fail",
    "lose",
    "problem",
    "trouble",
    "worry",
    "fear",
    "scared",
    "anxious",
  ];
  const urgentWords = [
    "urgent",
    "emergency",
    "critical",
    "important",
    "now",
    "immediately",
    "asap",
    "quickly",
  ];
  const personalWords = [
    "i",
    "me",
    "my",
    "myself",
    "personal",
    "life",
    "future",
    "career",
    "relationship",
    "family",
  ];

  // Count sentiment indicators
  const positiveCount = positiveWords.filter(word =>
    lowerQuestion.includes(word),
  ).length;
  const negativeCount = negativeWords.filter(word =>
    lowerQuestion.includes(word),
  ).length;
  const isUrgent = urgentWords.some(word => lowerQuestion.includes(word));
  const isPersonal = personalWords.some(word => lowerQuestion.includes(word));

  // Determine overall sentiment
  let sentiment = "neutral";
  if (positiveCount > negativeCount) sentiment = "positive";
  else if (negativeCount > positiveCount) sentiment = "negative";

  return {
    questionTypes,
    sentiment,
    isUrgent,
    isPersonal,
    positiveCount,
    negativeCount,
    wordCount: question.split(" ").length,
  };
}

/**
 * Select smart category based on question analysis
 * @param {Object} analysis - Question analysis results
 * @param {Object} responseCategories - Available response categories
 * @returns {string} Selected category
 */
function selectSmartCategory(analysis, responseCategories) {
  const categories = Object.keys(responseCategories);

  // Weight categories based on analysis
  const weights = {
    veryPositive: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    veryNegative: 0,
  };

  // Base weights (neutral is most common)
  weights.neutral = 30;
  weights.positive = 25;
  weights.negative = 20;
  weights.veryPositive = 15;
  weights.veryNegative = 10;

  // Adjust based on sentiment
  if (analysis.sentiment === "positive") {
    weights.veryPositive += 20;
    weights.positive += 15;
    weights.neutral -= 10;
    weights.negative -= 10;
  } else if (analysis.sentiment === "negative") {
    weights.veryNegative += 20;
    weights.negative += 15;
    weights.neutral -= 10;
    weights.positive -= 10;
  }

  // Adjust for personal questions (more positive)
  if (analysis.isPersonal) {
    weights.veryPositive += 10;
    weights.positive += 10;
    weights.veryNegative -= 5;
    weights.negative -= 5;
  }

  // Adjust for urgent questions (more neutral/realistic)
  if (analysis.isUrgent) {
    weights.neutral += 15;
    weights.veryPositive -= 10;
    weights.veryNegative -= 10;
  }

  // Ensure weights are non-negative
  Object.keys(weights).forEach(cat => {
    weights[cat] = Math.max(0, weights[cat]);
  });

  // Weighted random selection
  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  let random = Math.random() * totalWeight;

  for (const category of categories) {
    random -= weights[category];
    if (random <= 0) {
      return category;
    }
  }

  // Fallback to neutral
  return "neutral";
}
