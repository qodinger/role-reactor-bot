import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAssignTempRole } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("assign-temp-role")
  .setDescription(
    "Assign a temporary role to multiple users that expires after a set time",
  )
  .addStringOption(option =>
    option
      .setName("users")
      .setDescription(
        "Comma-separated list of user IDs or mentions to assign the temporary role to",
      )
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The role to assign temporarily")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("duration")
      .setDescription("How long the role should last (e.g., 1h, 2d, 1w, 30m)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for assigning the temporary role")
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
            "You need Administrator permissions to assign temporary roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the assign temp role logic
    await handleAssignTempRole(interaction);
  } catch (error) {
    logger.error("Error in assign-temp-role command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process assign-temp-role command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
