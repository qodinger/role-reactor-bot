import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

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
      .setDescription("Check your current Core balance"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("pricing")
      .setDescription("View Core pricing and membership benefits"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
