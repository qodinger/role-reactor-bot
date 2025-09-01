import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetupRoles } from "./handlers.js";
import {
  titleOption,
  descriptionOption,
  rolesOption,
  colorOption,
} from "../../../utils/discord/slashCommandOptions.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("setup-roles")
  .setDescription("Create a role-reaction message for self-assignable roles")
  .addStringOption(titleOption().setRequired(true))
  .addStringOption(descriptionOption().setRequired(true))
  .addStringOption(rolesOption(true))
  .addStringOption(colorOption())
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
            "You need Administrator permissions to create role-reaction messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the setup roles logic
    await handleSetupRoles(interaction, client);
  } catch (error) {
    logger.error("Error in setup-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process setup-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
