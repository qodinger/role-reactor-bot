import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "invite",
  category: "general",
  description: "Get the bot's invite link for your server",
  keywords: ["invite", "invite link", "add bot", "bot invite", "server invite"],
  emoji: "🔗",
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

export { execute };
