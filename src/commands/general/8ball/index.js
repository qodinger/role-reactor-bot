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
