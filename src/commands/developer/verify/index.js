import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription(
    "Manually verify Ko-fi donations and grant credits (Developer only)",
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("donation")
      .setDescription("Verify a Ko-fi donation and grant credits")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant credits to")
          .setRequired(true),
      )
      .addNumberOption(option =>
        option
          .setName("amount")
          .setDescription("Donation amount in USD")
          .setRequired(true)
          .setMinValue(0.01),
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
      .setDescription("Verify a Ko-fi subscription and grant Core status")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant Core status to")
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
      .setDescription("Manually add credits without Ko-fi verification")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to grant credits to")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("credits")
          .setDescription("Number of credits to add")
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
  .setDefaultMemberPermissions(0n); // Developer only

export { execute };
