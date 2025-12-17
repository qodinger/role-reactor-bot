import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

/**
 * Ask command definition
 * Allows users to ask questions to an AI assistant about the bot and server
 */
export const data = new SlashCommandBuilder()
  .setName("ask")
  .setDescription("Ask the AI assistant about the bot or server")
  .addStringOption(option =>
    option
      .setName("question")
      .setDescription("Your question or message")
      .setRequired(true)
      .setMaxLength(1000),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
