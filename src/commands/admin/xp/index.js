import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetup, handleSettings } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Manage the XP system settings and configuration")
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription("Configure the XP system for your server")
      .addBooleanOption(option =>
        option
          .setName("enabled")
          .setDescription("Enable or disable the XP system")
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("message-xp")
          .setDescription("Enable XP for sending messages")
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("command-xp")
          .setDescription("Enable XP for using commands")
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("role-xp")
          .setDescription("Enable XP for role assignments")
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("voice-xp")
          .setDescription("Enable XP for voice chat participation")
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("View and manage the XP system settings"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

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
      case "setup":
        await handleSetup(interaction, client);
        break;
      case "settings":
        await handleSettings(interaction, client);
        break;
      default:
        logger.warn(`Unknown subcommand: ${subcommand}`);
        await interaction.reply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: `The subcommand "${subcommand}" is not recognized.`,
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
