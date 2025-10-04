import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleLevel } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("level")
  .setDescription("View your current level and XP progress")
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
    // Handle the level display
    await handleLevel(interaction, client);
  } catch (error) {
    logger.error("Error in level command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process level command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
