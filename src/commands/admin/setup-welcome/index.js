import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetupWelcome } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("setup-welcome")
  .setDescription("Configure the welcome system for new members")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("Channel where welcome messages will be sent")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("message")
      .setDescription(
        "Welcome message (use placeholders like {user}, {server})",
      )
      .setRequired(false),
  )
  .addRoleOption(option =>
    option
      .setName("auto-role")
      .setDescription("Role to automatically assign to new members")
      .setRequired(false),
  )
  .addBooleanOption(option =>
    option
      .setName("enabled")
      .setDescription("Enable or disable the welcome system")
      .setRequired(false),
  )
  .addBooleanOption(option =>
    option
      .setName("embed")
      .setDescription("Use embed format for welcome messages")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the welcome system.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    // Handle the setup welcome logic
    await handleSetupWelcome(interaction);
  } catch (error) {
    logger.error("Error in setup-welcome command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process setup-welcome command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
