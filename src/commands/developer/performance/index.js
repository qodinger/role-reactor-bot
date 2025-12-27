import { SlashCommandBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handlePerformanceCheck } from "./handlers.js";

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
  name: "performance",
  category: "developer",
  description: "View bot performance metrics and statistics",
  keywords: ["performance", "metrics", "stats", "monitoring", "speed"],
  emoji: "🚀",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/performance```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: "No parameters needed - just run the command!",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Developer** access required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Command usage statistics, event processing metrics, and performance data - great for understanding how your community uses the bot!",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(`🔒 [DEVELOPER ONLY] ${metadata.description}`)
  .setDefaultMemberPermissions(0n) // Visible to all, but restricted by isDeveloper() check
  .setDMPermission(false);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    const deferred = await deferInteraction(interaction);
    await handlePerformanceCheck(interaction, client, deferred);
  } catch (error) {
    logger.error("Error in performance command:", error);
    await handleCommandError(interaction, error);
  }
}

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function deferInteraction(interaction) {
  try {
    await interaction.deferReply(); // ephemeral flag
    return true; // Successfully deferred
  } catch (deferError) {
    if (
      deferError.message !== "Interaction has already been acknowledged." &&
      deferError.message !== "Unknown interaction"
    ) {
      const logger = getLogger();
      logger.error("Failed to defer reply:", deferError);
    }
    return false; // Failed to defer
  }
}

async function handleCommandError(interaction, _error) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description:
              "An unexpected error occurred while checking performance metrics.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description:
              "An unexpected error occurred while checking performance metrics.",
          }),
        ],
        flags: 64,
      });
    }
  } catch (replyError) {
    const logger = getLogger();
    logger.error("Failed to send error response:", replyError);
  }
}
