import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "ping",
  category: "general",
  description: "Check the bot's latency and connection status",
  keywords: ["ping", "latency", "response time", "speed", "status"],
  emoji: "🏓",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/ping```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: "No parameters needed - just run the command!",
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
        "Bot latency information including API latency, heartbeat, and overall connection status. Great for checking if the bot is running smoothly!",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

export { execute };
