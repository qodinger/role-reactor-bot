import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleUpdateRoles } from "./handlers.js";
import {
  rolesOption,
  titleOption,
  descriptionOption,
  colorOption,
} from "../../../utils/discord/slashCommandOptions.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("update-roles")
  .setDescription("Update an existing role-reaction message")
  .addStringOption(option =>
    option
      .setName("message_id")
      .setDescription("The ID of the message to update")
      .setRequired(true),
  )
  .addStringOption(titleOption())
  .addStringOption(descriptionOption())
  .addStringOption(rolesOption(false))
  .addStringOption(colorOption())
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
            "You need Administrator permissions to update role-reaction messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the update roles logic
    await handleUpdateRoles(interaction);
  } catch (error) {
    logger.error("Error in update-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process update-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
