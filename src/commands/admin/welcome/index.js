import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetup, handleSettings } from "./handlers.js";

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
  name: "welcome",
  category: "admin",
  description: "Manage the welcome message system",
  keywords: ["welcome", "greet", "join", "member join", "new member"],
  emoji: "🎉",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/welcome setup channel:#welcome message:Welcome {user} to {server}! 🎉 auto-role:@Member enabled:true```",
        "```/welcome settings```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**setup** - Configure the welcome system with channel, message, and auto-role",
        "**settings** - View and manage current welcome system settings",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Server** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Interactive welcome system with channel selection, message customization, auto-role assignment, and real-time settings management for new members!",
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
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription(
        "Configure the welcome system for members joining the server",
      )
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
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("View and manage the welcome system settings"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
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
    logger.error("Error in welcome command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process welcome command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
