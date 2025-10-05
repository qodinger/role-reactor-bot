import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleSetup, handleSettings } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Manage the welcome message system")
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
