import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleXpSettings } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("xp-settings")
  .setDescription("View and manage XP system settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
    // Validate user permissions first
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to view XP settings.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the XP settings display
    await handleXpSettings(interaction);
  } catch (error) {
    logger.error("Error in xp-settings command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process XP settings command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
