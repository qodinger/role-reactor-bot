import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "wyr",
  category: "general",
  description: "Get a random 'Would You Rather' question",
  keywords: ["wyr", "would you rather", "question", "choice", "fun", "game"],
  emoji: "🤔",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/wyr [category:Funny]```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**category** *(optional)* - Choose a specific category: Funny, Superhero, Technology, Relationships, Life Choices, Philosophical, Challenging, Pop Culture, Food, Adventure, or Modern Life",
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
        "A random 'Would You Rather' question to spark conversations and debates! Choose from different categories or get a random question. Great for icebreakers and fun discussions!",
      inline: false,
    },
    {
      name: `Categories`,
      value: [
        "**Funny** - Light-hearted and humorous questions",
        "**Superhero** - Questions about superpowers and heroes",
        "**Technology** - Modern tech, AI, and digital life questions",
        "**Relationships** - Questions about love, friendship, and connections",
        "**Life Choices** - Thought-provoking life decisions",
        "**Philosophical** - Deep and meaningful questions",
        "**Challenging** - Difficult moral and ethical choices",
        "**Pop Culture** - Questions about movies, music, and current trends",
        "**Food** - Culinary choices and eating preferences",
        "**Adventure** - Travel, exploration, and exciting experiences",
        "**Modern Life** - Contemporary lifestyle, work, and social issues",
      ].join("\n"),
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addStringOption(option =>
    option
      .setName("category")
      .setDescription("Choose a specific category for the question")
      .setRequired(false)
      .addChoices(
        { name: "Funny", value: "FUNNY" },
        { name: "Superhero", value: "SUPERHERO" },
        { name: "Technology", value: "TECHNOLOGY" },
        { name: "Relationships", value: "RELATIONSHIPS" },
        { name: "Life Choices", value: "LIFE_CHOICES" },
        { name: "Philosophical", value: "PHILOSOPHICAL" },
        { name: "Challenging", value: "CHALLENGING" },
        { name: "Pop Culture", value: "POP_CULTURE" },
        { name: "Food", value: "FOOD" },
        { name: "Adventure", value: "ADVENTURE" },
        { name: "Modern Life", value: "MODERN_LIFE" },
      ),
  );

export { execute };
