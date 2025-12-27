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
  name: "userinfo",
  category: "general",
  description: "Display detailed information about a user",
  keywords: ["userinfo", "user", "info", "information", "profile", "details"],
  emoji: "👤",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/userinfo [user:@username]```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**user** *(optional)* - The user to get information about (leave empty to see your own info)",
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
        "Detailed user information including account creation date, server join date, roles, permissions, and more! Great for checking user details and account information.",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Userinfo command definition
 * Displays detailed information about a user
 */
export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to get information about")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

export { execute };
