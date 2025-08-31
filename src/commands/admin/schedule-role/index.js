import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleScheduleRole, handleCancel, handleView } from "./handlers.js";
import { handleList } from "./list.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("schedule-role")
  .setDescription("Schedule a role assignment")
  .addSubcommand(subcommand =>
    subcommand
      .setName("create")
      .setDescription("Create a new role schedule")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription("Comma-separated list of user IDs or mentions")
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName("role")
          .setDescription("The role to assign")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("type")
          .setDescription("Type of schedule")
          .setRequired(true)
          .addChoices(
            { name: "One Time", value: "one-time" },
            { name: "Daily", value: "daily" },
            { name: "Weekly", value: "weekly" },
            { name: "Monthly", value: "monthly" },
            { name: "Custom Interval", value: "custom" },
          ),
      )
      .addStringOption(option =>
        option
          .setName("schedule")
          .setDescription(
            "When to assign: 'tomorrow 9am', '9am', 'monday 6pm', '15 2pm', '120'",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("duration")
          .setDescription("How long the role should last (e.g., 1h, 2d, 1w)")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the role assignment")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List all scheduled and recurring roles"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("cancel")
      .setDescription("Cancel a scheduled or recurring role")
      .addStringOption(option =>
        option
          .setName("id")
          .setDescription("Schedule ID (shortened format like 2802a998...7f7a)")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("view")
      .setDescription("View detailed information about a schedule")
      .addStringOption(option =>
        option
          .setName("id")
          .setDescription("Schedule ID (shortened format like 2802a998...7f7a)")
          .setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    const deferred = await deferInteraction(interaction);
    await checkPermissions(interaction);

    const subcommand = interaction.options.getSubcommand();
    await routeSubcommand(interaction, subcommand, deferred);
  } catch (error) {
    logger.error("Error in schedule-role command:", error);
    await handleCommandError(interaction, error);
  }
}

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function deferInteraction(interaction) {
  try {
    await interaction.deferReply({ flags: 64 }); // ephemeral flag
    return true; // Successfully deferred
  } catch (deferError) {
    if (
      deferError.message !== "Interaction has already been acknowledged." &&
      deferError.message !== "Unknown interaction"
    ) {
      const logger = getLogger();
      logger.error("Failed to defer reply:", deferError);
    }
    return false; // Failed to defer
  }
}

async function checkPermissions(interaction) {
  if (!(await hasAdminPermissions(interaction.member, ["ManageRoles"]))) {
    throw new Error("Insufficient permissions");
  }
}

async function routeSubcommand(interaction, subcommand, deferred) {
  switch (subcommand) {
    case "create":
      await handleScheduleRole(interaction, deferred);
      break;
    case "list":
      await handleList(interaction, deferred);
      break;
    case "cancel":
      await handleCancel(interaction, deferred);
      break;
    case "view":
      await handleView(interaction, deferred);
      break;
    default:
      if (deferred) {
        await interaction.editReply({
          ...errorEmbed({
            title: "Invalid Subcommand",
            description:
              "Please use 'create' to schedule a role, 'list' to view schedules, 'view' to see details, or 'cancel' to cancel a schedule.",
          }),
        });
      } else {
        await interaction.reply({
          ...errorEmbed({
            title: "Invalid Subcommand",
            description:
              "Please use 'create' to schedule a role, 'list' to view schedules, 'view' to see details, or 'cancel' to cancel a schedule.",
          }),
          flags: 64,
        });
      }
  }
}

async function handleCommandError(interaction, _error) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
          }),
        ],
        flags: 64,
      });
    }
  } catch (replyError) {
    const logger = getLogger();
    logger.error("Failed to send error response:", replyError);
  }
}
