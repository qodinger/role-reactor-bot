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
        "**category** *(optional)* - Choose a specific category: Funny, Superhero, Life Choices, Philosophical, Challenging, or Pop Culture",
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
        "**Life Choices** - Thought-provoking life decisions",
        "**Philosophical** - Deep and meaningful questions",
        "**Challenging** - Difficult choices to make",
        "**Pop Culture** - Questions about movies, music, and trends",
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
        { name: "Life Choices", value: "LIFE_CHOICES" },
        { name: "Philosophical", value: "PHILOSOPHICAL" },
        { name: "Challenging", value: "CHALLENGING" },
        { name: "Pop Culture", value: "POP_CULTURE" },
      ),
  );

export { execute };
