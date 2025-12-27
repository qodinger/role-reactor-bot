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
