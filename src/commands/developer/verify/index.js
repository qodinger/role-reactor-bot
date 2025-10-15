import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription(
    "🔒 [DEVELOPER ONLY] Manually verify Ko-fi donations and grant Core credits",
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("donation")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Verify a Ko-fi donation and grant Core credits",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant Core credits to")
          .setRequired(true),
      )
      .addNumberOption(option =>
        option
          .setName("amount")
          .setDescription("Donation amount in USD")
          .setRequired(true)
          .setMinValue(0.01)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("ko-fi-url")
          .setDescription("Ko-fi donation URL (optional)")
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("notes")
          .setDescription("Additional notes (optional)")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("subscription")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Verify a Ko-fi subscription and grant Core membership",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant Core membership to")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("ko-fi-url")
          .setDescription("Ko-fi subscription URL (optional)")
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("notes")
          .setDescription("Additional notes (optional)")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("manual")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Manually add Core credits without Ko-fi verification",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant Core credits to")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("credits")
          .setDescription("Number of Core credits to add")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000),
      )
      .addStringOption(option =>
        option
          .setName("notes")
          .setDescription("Reason for manual credit addition")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .setDefaultMemberPermissions(0n); // Visible to all, but restricted by isDeveloper() check

export { execute };
