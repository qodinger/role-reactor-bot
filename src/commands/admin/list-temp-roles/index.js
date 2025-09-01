import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleListTempRoles } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("list-temp-roles")
  .setDescription("List temporary roles for a user or all users")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription(
        "The user to check temporary roles for (leave empty for all users)",
      )
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Administrator permissions to list temporary roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the list temp roles logic
    await handleListTempRoles(interaction, client);
  } catch (error) {
    logger.error("Error in list-temp-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process list-temp-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
