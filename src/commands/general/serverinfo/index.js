import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "serverinfo",
  category: "general",
  description: "Display detailed information about this server",
  keywords: ["serverinfo", "server", "info", "information", "guild", "details"],
  emoji: "ℹ️",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/serverinfo```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: "No parameters needed - just run the command!",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **View Channel** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Detailed server information including member count, channels, roles, creation date, owner, verification level, and more! Perfect for getting a complete overview of your server.",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Serverinfo command definition
 * Displays detailed information about the server
 */
export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

export { execute };
