import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "8ball",
  category: "general",
  description: "Ask the magic 8-ball a question",
  keywords: [
    "8ball",
    "eight ball",
    "magic",
    "question",
    "fortune",
    "prediction",
  ],
  emoji: "🎱",
  // Detailed help fields for /help command
  helpFields: [
    {
      name: `How to Use`,
      value: "```/8ball question:Will I succeed in my career?```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**question** *(required)* - Ask the intelligent magic 8-ball anything you want to know!",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• No special permissions required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "An intelligent response from the mystical oracle with 5 smart categories: Very Positive, Positive, Neutral, Negative, and Very Negative. The 8-ball analyzes your question's sentiment and context to provide more relevant answers!",
      inline: false,
    },
    {
      name: `Smart Features`,
      value:
        "**Sentiment Analysis** - Detects positive/negative keywords in your question\n**Context Awareness** - Recognizes personal, urgent, and emotional questions\n**Smart Weighting** - Adjusts response probabilities based on question type\n**5 Response Levels** - From exceptional fortune to dangerous warnings",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addStringOption(option =>
    option
      .setName("question")
      .setDescription("Your question for the magic 8-ball")
      .setRequired(true),
  );

export { execute };
