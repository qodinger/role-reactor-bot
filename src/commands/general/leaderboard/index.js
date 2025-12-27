import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleLeaderboard } from "./handlers.js";

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
  name: "leaderboard",
  category: "general",
  description: "View the XP leaderboard for this server",
  keywords: ["leaderboard", "top", "ranking", "xp", "levels", "rank", "stats"],
  emoji: "🏆",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/leaderboard [limit:10] [type:xp]```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: [
        "**limit** *(optional)* - Number of users to show (1-20, default: 10)",
        "**type** *(optional)* - Choose from: xp, level, messages, voice (default: xp)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **View Channel** permission required",
      inline: false,
    },
    {
      name: `Leaderboard Types`,
      value: [
        "**xp** - Total experience points (default)",
        "**level** - Current level",
        "**messages** - Total messages sent",
        "**voice** - Total voice time",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "A beautiful leaderboard showing top users by XP, level, messages, or voice time. Choose from different ranking types to see who's most active in your server!",
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
  .addIntegerOption(option =>
    option
      .setName("limit")
      .setDescription("Number of users to show (1-20)")
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false),
  )
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("Type of leaderboard to show")
      .addChoices(
        { name: "XP (Total Experience)", value: "xp" },
        { name: "Level", value: "level" },
        { name: "Messages", value: "messages" },
        { name: "Voice Time", value: "voice" },
      )
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

    // Handle the leaderboard display
    await handleLeaderboard(interaction, client);
  } catch (error) {
    logger.error("Error in leaderboard command:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process leaderboard command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Error",
          description: "Failed to process leaderboard command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}
