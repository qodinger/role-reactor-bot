import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleXpCommand } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Manage the XP system settings and configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName("settings")
      .setDescription("View and configure XP system settings"),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Validate user permissions first
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the XP system.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "settings":
        await handleXpCommand(interaction, client);
        break;
      default:
        await interaction.reply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: "The requested subcommand is not available.",
            solution: "Please use a valid subcommand.",
          }),
        );
    }
  } catch (error) {
    logger.error("Error in xp command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process XP command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
