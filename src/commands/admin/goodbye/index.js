import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetup, handleSettings } from "./handlers.js";

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "goodbye",
  category: "admin",
  description: "Manage the goodbye message system",
  keywords: ["goodbye", "farewell", "leave", "member leave", "departure"],
  emoji: "👋",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/goodbye setup channel:#general message:**{user}** left the server! Thanks for being part of **{server}**! 👋 enabled:true```",
        "```/goodbye settings```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**setup** - Configure the goodbye system with channel and message",
        "**settings** - View and manage current goodbye system settings",
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
        "Interactive goodbye system with channel selection, message customization, and real-time settings management for members leaving!",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription(
        "Configure the goodbye system for members leaving the server",
      )
      .addChannelOption(option =>
        option
          .setName("channel")
          .setDescription("Channel where goodbye messages will be sent")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("message")
          .setDescription(
            "Goodbye message (use placeholders like {user}, {server})",
          )
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("enabled")
          .setDescription("Enable or disable the goodbye system")
          .setRequired(false),
      )
      .addBooleanOption(option =>
        option
          .setName("embed")
          .setDescription("Use embed format for goodbye messages")
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("View and manage the goodbye system settings"),
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
            "You need Manage Server permissions to configure the goodbye system.",
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
    logger.error("Error in goodbye command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process goodbye command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
