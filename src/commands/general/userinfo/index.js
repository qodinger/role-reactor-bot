import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Userinfo command definition
 * Displays detailed information about a user
 */
export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Display detailed information about a user")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to get information about")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

export { execute };
