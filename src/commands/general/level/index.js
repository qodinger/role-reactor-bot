import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleLevel } from "./handlers.js";

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
  name: "level",
  category: "general",
  description: "View your current level and XP progress",
  keywords: ["level", "xp", "experience", "progress", "rank", "stats"],
  emoji: "📊",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/level [user:@username]```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**user** *(optional)* - Check a specific member's level (leave empty to see your own)",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **View Channel** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Detailed level information including current XP, progress to next level, and rank. Perfect for tracking your growth and comparing with other members!",
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
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to check level for (optional)")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Handle the level display
    await handleLevel(interaction, client);
  } catch (error) {
    logger.error("Error in level command:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process level command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Error",
          description: "Failed to process level command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}
