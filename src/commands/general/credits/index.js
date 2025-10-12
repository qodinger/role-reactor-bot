import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("credits")
  .setDescription("Manage your credits and Core membership")
  .addSubcommand(subcommand =>
    subcommand
      .setName("balance")
      .setDescription("Check your current credit balance"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("pricing")
      .setDescription("View credit pricing and Core membership benefits"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("add")
      .setDescription("Add credits to a user (Admin only)")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to add credits to")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of credits to add")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for adding credits")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove")
      .setDescription("Remove credits from a user (Admin only)")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to remove credits from")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of credits to remove")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for removing credits")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("set-core")
      .setDescription("Set Core membership status for a user (Admin only)")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to set Core status for")
          .setRequired(true),
      )
      .addBooleanOption(option =>
        option
          .setName("is-core")
          .setDescription("Whether the user should be a Core member")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for changing Core status")
          .setRequired(false),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
