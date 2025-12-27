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
