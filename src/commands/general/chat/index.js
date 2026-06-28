import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

export const disabled = false;

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
  name: "chat",
  category: "general",
  description:
    "Chat with the AI — conversation is shared with everyone in this channel",
  keywords: ["chat", "ask", "ai", "assistant", "help me", "question"],
  emoji: "💬",
  helpFields: [
    {
      name: "Ways to Chat",
      value:
        "**Slash command:**\n```/chat message:How do I set up role reactions?```\n**Mention the bot:**\n```@Role Reactor what can you do?```",
      inline: false,
    },
    {
      name: "What You Need",
      value:
        "**message** *(required)* — Your message to the AI (max 1000 characters)",
      inline: false,
    },
    {
      name: "How it works",
      value:
        "The AI remembers the full conversation in this channel — all members can read and build on what others have said, just like a normal chat. Both `/chat` and `@mentions` share the same channel history. Different channels have separate sessions.",
      inline: false,
    },
    {
      name: "Permissions",
      value: "• None required",
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
      .setName("message")
      .setDescription("Your message to the AI")
      .setRequired(true)
      .setMaxLength(1000),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
