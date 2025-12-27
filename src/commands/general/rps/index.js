import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "rps",
  category: "general",
  description: "Challenge someone to Rock Paper Scissors",
  keywords: ["rps", "rock paper scissors", "game", "challenge", "play"],
  emoji: "✂️",
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to challenge (can be a bot or another user)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("choice")
      .setDescription("Your choice (hidden from opponent)")
      .setRequired(true)
      .addChoices(
        { name: "Rock", value: "rock" },
        { name: "Paper", value: "paper" },
        { name: "Scissors", value: "scissors" },
      ),
  );

export { execute };
