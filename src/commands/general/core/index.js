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
  helpFields: [
    {
      name: `How to Use`,
      value: ["```/core balance```", "```/core pricing```"].join("\n"),
      inline: false,
    },
    {
      name: `What You Need`,
      value: "No parameters needed - just run the subcommand!",
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**balance** - View your current Core balance and tier status",
        "**pricing** - View Core pricing, membership benefits, and donation options",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Send Messages** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Your Core balance, tier information, and transaction history. Core credits are used for AI avatar generation and can be purchased or transferred between users!",
      inline: false,
    },
  ],
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
