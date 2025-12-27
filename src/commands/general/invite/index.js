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
  helpFields: [
    {
      name: `How to Use`,
      value: "```/invite```",
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
        "An invite link to add Role Reactor Bot to your server. The link is sent as an ephemeral message, so only you can see it. Share it with others to invite the bot!",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

export { execute };
