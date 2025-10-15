import { SlashCommandBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAvatarDebug } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("avatar-debug")
  .setDescription(
    "🔒 [DEVELOPER ONLY] View avatar generation statistics and user history",
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("stats")
      .setDescription("View generation statistics")
      .addIntegerOption(
        option =>
          option
            .setName("hours")
            .setDescription("Hours to look back (default: 24)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(168), // Max 1 week
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("user")
      .setDescription("View generation history for a specific user")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to check generation history for")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("limit")
          .setDescription("Number of recent generations to show (default: 10)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50),
      ),
  )
  .setDefaultMemberPermissions(0n); // Developer only

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Handle the debug command
    await handleAvatarDebug(interaction, client);
  } catch (error) {
    logger.error("Error in avatar-debug command:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Avatar Debug Failed",
          description:
            "An unexpected error occurred while processing the developer debug command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Avatar Debug Failed",
          description:
            "An unexpected error occurred while processing the developer debug command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
        { ephemeral: true },
      );
    }
  }
}
