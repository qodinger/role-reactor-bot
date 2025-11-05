import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleLeaderboard } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the XP leaderboard for this server")
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
