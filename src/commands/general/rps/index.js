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
  helpFields: [
    {
      name: `How to Use`,
      value: "```/rps user:@opponent choice:rock```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: [
        "**user** *(required)* - User to challenge (can be a bot or another user)",
        "**choice** *(required)* - Your choice: Rock, Paper, or Scissors (hidden from opponent)",
      ].join("\n"),
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
        "A fun Rock Paper Scissors game! Your choice is hidden from your opponent until they make their choice. The bot will automatically determine the winner based on classic RPS rules!",
      inline: false,
    },
    {
      name: `Game Rules`,
      value: [
        "• **Rock** beats Scissors",
        "• **Paper** beats Rock",
        "• **Scissors** beats Paper",
        "• Same choice results in a tie",
      ].join("\n"),
      inline: false,
    },
  ],
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
