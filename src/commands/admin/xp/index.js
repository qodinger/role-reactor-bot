import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleXpCommand } from "./handlers.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "xp",
  category: "admin",
  description: "Manage the XP system settings and configuration",
  keywords: ["xp", "experience", "level", "settings", "config", "points"],
  emoji: "📈",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/xp settings```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "No parameters needed - just run the subcommand to access the XP system settings!",
      inline: false,
    },
    {
      name: `Subcommands`,
      value: ["**settings** - View and configure XP system settings"].join(
        "\n",
      ),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Server** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: [
        "Interactive XP system management interface with buttons to:",
        "• Toggle the entire XP system on/off",
        "• Enable/disable message XP, command XP, role XP, and voice XP individually",
        "• View current XP amounts, cooldowns, and settings",
        "• Access configuration help and reset options",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Quick Actions`,
      value: [
        "Use the buttons to quickly toggle features on/off",
        "All changes are applied immediately",
        "Settings use optimized default values",
      ].join("\n"),
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
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
