import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAssign, handleList, handleRemove } from "./handlers.js";
import { handleDeferral } from "./deferral.js";

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
      .setDescription("Remove a temporary role from users before it expires")
      .addStringOption(opt =>
        opt
          .setName("users")
          .setDescription("Comma-separated list of user IDs or mentions")
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
    // Use aggressive deferral to prevent timeout
    const deferSuccess = await handleDeferral(interaction);
    if (!deferSuccess) {
      logger.warn("Failed to defer interaction, skipping execution", {
        interactionId: interaction.id,
      });
      return;
    }

    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
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
        await handleAssign(interaction, client);
        break;
      case "list":
        await handleList(interaction, client);
        break;
      case "remove":
        await handleRemove(interaction, client);
        break;

      default:
        await interaction.editReply(
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

    // Always use editReply since we defer at the start
    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process temp-roles command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      // Fallback to reply if somehow not deferred
      await interaction.reply(
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
