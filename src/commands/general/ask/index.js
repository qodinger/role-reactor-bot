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
  name: "ask",
  category: "general",
  description: "Ask the AI assistant about the bot or server",
  keywords: ["ask", "question", "chat", "ai", "assistant", "help me"],
  emoji: "💬",
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addStringOption(option =>
    option
      .setName("question")
      .setDescription("Your question or message")
      .setRequired(true)
      .setMaxLength(1000),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
