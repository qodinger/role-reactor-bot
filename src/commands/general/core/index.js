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
  name: "core",
  category: "general",
  description: "Check your Core balance and view pricing information",
  keywords: ["core", "balance", "credits", "pricing", "energy", "currency"],
  emoji: "⚡",
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Core command definition
 * Allows users to check their Core balance and view pricing information
 */
export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addSubcommand(subcommand =>
    subcommand
      .setName("balance")
      .setDescription("Check your current Core balance and tier status"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("pricing")
      .setDescription("View Core pricing and purchase options"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
