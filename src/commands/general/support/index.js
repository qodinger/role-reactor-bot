import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "support",
  category: "general",
  description: "Get support and help information",
  keywords: ["support", "help", "assistance", "contact", "issue", "problem"],
  emoji: "🆘",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/support```",
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
        "Support information including how to get help, report issues, suggest features, and an interactive button for the Discord support server!",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

export { execute };
