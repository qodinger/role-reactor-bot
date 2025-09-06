import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleWelcomeSettings } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("welcome-settings")
  .setDescription("View and manage welcome system settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Guild permissions to view welcome settings.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the welcome settings logic
    await handleWelcomeSettings(interaction);
  } catch (error) {
    logger.error("Error in welcome-settings command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process welcome-settings command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
