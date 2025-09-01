import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAssign, handleList, handleRemove } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("temp-roles")
  .setDescription("Manage temporary role assignments")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName("assign")
      .setDescription(
        "Assign a temporary role to users that expires after a set time",
      )
      .addStringOption(opt =>
        opt
          .setName("users")
          .setDescription("Comma-separated list of user IDs or mentions")
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("The role to assign temporarily")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("duration")
          .setDescription(
            "How long the role should last (e.g., 1h, 2d, 1w, 30m)",
          )
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for assigning the temporary role")
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("notify")
          .setDescription("Send DM notification to users (default: false)")
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("notify-expiry")
          .setDescription(
            "Send DM notification when role expires (default: false)",
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List temporary roles for a user or all users")
      .addUserOption(opt =>
        opt
          .setName("user")
          .setDescription("The user to check (leave empty for all users)")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove")
      .setDescription("Remove a temporary role from a user before it expires")
      .addUserOption(opt =>
        opt
          .setName("user")
          .setDescription("The user to remove the temporary role from")
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("The temporary role to remove")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for removing the temporary role")
          .setRequired(false),
      ),
  );

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Administrator permissions to manage temporary roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "assign":
        await handleAssign(interaction);
        break;
      case "list":
        await handleList(interaction, client);
        break;
      case "remove":
        await handleRemove(interaction);
        break;

      default:
        await interaction.reply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: `The subcommand "${subcommand}" is not recognized.`,
            solution: "Use assign, list, or remove as subcommands.",
          }),
        );
    }
  } catch (error) {
    logger.error(
      `Error in temp-roles ${interaction.options.getSubcommand()} command:`,
      error,
    );

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        errorEmbed({
          title: "Error",
          description: "Failed to process temp-roles command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process temp-roles command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}
