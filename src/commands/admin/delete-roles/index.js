import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleDeleteRoles } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("delete-roles")
  .setDescription("Delete a role-reaction message")
  .addStringOption(option =>
    option
      .setName("message_id")
      .setDescription("The ID of the message to delete")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
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
            "You need Administrator permissions to delete role-reaction messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the delete roles logic
    await handleDeleteRoles(interaction);
  } catch (error) {
    logger.error("Error in delete-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process delete-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
