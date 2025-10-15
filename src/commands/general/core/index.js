import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Core command definition
 * Allows users to check their Core balance and view pricing information
 */
export const data = new SlashCommandBuilder()
  .setName("core")
  .setDescription("Check your Core balance and view pricing information")
  .addSubcommand(subcommand =>
    subcommand
      .setName("balance")
      .setDescription("Check your current Core balance and tier status"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("pricing")
      .setDescription(
        "View Core pricing, membership benefits, and donation options",
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
