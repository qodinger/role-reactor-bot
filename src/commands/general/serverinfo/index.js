import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Serverinfo command definition
 * Displays detailed information about the server
 */
export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Display detailed information about this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

export { execute };
