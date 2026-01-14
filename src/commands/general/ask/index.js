import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

export const disabled = true;

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
  helpFields: [
    {
      name: `How to Use`,
      value: "```/ask question:How do I set up role reactions?```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**question** *(required)* - Your question or message for the AI assistant (max 1000 characters)",
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
        "An intelligent AI response about the bot, server, or commands. The AI assistant can help you understand how to use features, troubleshoot issues, and get the most out of Role Reactor Bot!",
      inline: false,
    },
  ],
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
