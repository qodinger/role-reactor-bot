import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSearchCommand } from "./handlers.js";

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
  name: "search",
  category: "admin",
  description: "Search for messages in the server",
  keywords: ["search", "find", "messages", "log", "moderation"],
  emoji: "🔍",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/search query:spammer channel:#general limit:10```",
      inline: false,
    },
    {
      name: `Parameters`,
      value: [
        "**query** - Text to search for (required)",
        "**channel** - Channel to search in (optional, defaults to all)",
        "**limit** - Number of results (1-25, default: 10)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Messages** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: [
        "Search through all messages in your server:",
        "• Find specific users or content",
        "• Great for moderation and logging",
      ].join("\n"),
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
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(opt =>
    opt.setName("query").setDescription("Text to search for").setRequired(true),
  )
  .addChannelOption(opt =>
    opt
      .setName("channel")
      .setDescription("Channel to search in")
      .setRequired(false),
  )
  .addIntegerOption(opt =>
    opt
      .setName("limit")
      .setDescription("Number of results (1-25)")
      .setMinValue(1)
      .setMaxValue(25)
      .setRequired(false),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description: "You need admin permissions to search messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    await handleSearchCommand(interaction, client);
  } catch (error) {
    logger.error("Error in search command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process search command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
