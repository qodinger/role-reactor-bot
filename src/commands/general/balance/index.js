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
  name: "balance",
  category: "general",
  description: "Check your Paid Cores & Reward Sparks balance",
  keywords: ["balance", "core", "sparks", "credits", "wallet", "currency"],
  emoji: "🔮",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/balance check```\n```/balance send user:@user cores:10```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: "• `/balance check` - No parameters\n• `/balance send` - Target user & amount of Cores",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• None required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: "Your Paid Cores & Reward Sparks balance, or send Cores to another user.",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Core command definition
 * Allows users to check their Core balance or send Cores to another user
 */
export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addSubcommand(subcommand =>
    subcommand
      .setName("check")
      .setDescription("View your Paid Cores & Reward Sparks balance"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("send")
      .setDescription("Send Paid Cores to another user (10% burn tax applies, Sparks cannot be sent)")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to send Paid Cores to")
          .setRequired(true),
      )
      .addNumberOption(option =>
        option
          .setName("cores")
          .setDescription("How many Paid Cores to send (min 1)")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
