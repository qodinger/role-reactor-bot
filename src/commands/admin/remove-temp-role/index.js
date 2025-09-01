import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleRemoveTempRole } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("remove-temp-role")
  .setDescription("Remove a temporary role from a user before it expires")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to remove the temporary role from")
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The temporary role to remove")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for removing the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

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
            "You need Administrator permissions to remove temporary roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the remove temp role logic
    await handleRemoveTempRole(interaction);
  } catch (error) {
    logger.error("Error in remove-temp-role command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process remove-temp-role command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
