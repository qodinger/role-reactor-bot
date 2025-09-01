import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleListRoles } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("list-roles")
  .setDescription("List all role-reaction messages in this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Check if already replied to prevent double responses
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already handled, skipping");
      return;
    }

    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Administrator permissions to view role-reaction messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the list roles logic
    await handleListRoles(interaction, client);
  } catch (error) {
    logger.error("Error in list-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process list-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
