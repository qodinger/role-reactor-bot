import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleScheduleRole, handleCancel, handleView } from "./handlers.js";
import { handleList } from "./list.js";

// Import refactored utility modules
import { validateInteraction, validateBotMember } from "./validation.js";
import { handleDeferral, sendResponse } from "./deferral.js";
import { handleCommandError } from "./errorHandling.js";

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

    // Validate interaction
    const validation = validateInteraction(interaction);
    if (!validation.success) {
      return;
    }

    // Validate bot member
    const botMemberValidation = validateBotMember(interaction);
    if (!botMemberValidation.success) {
      return await sendResponse(
        interaction,
        errorEmbed(botMemberValidation.errorResponse),
        false,
      );
    }

    // Handle deferral
    const deferResult = await handleDeferral(interaction);
    if (!deferResult.success) {
      if (deferResult.isExpired) {
        logger.warn("Interaction expired during deferral");
      }
      return;
    }

    // Check permissions
    await checkPermissions(interaction);

    const subcommand = interaction.options.getSubcommand();
    await routeSubcommand(interaction, subcommand, true); // Always deferred at this point
  } catch (error) {
    await handleCommandError(
      interaction,
      error,
      "schedule-role command",
      false,
    );
  }
}

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function checkPermissions(interaction) {
  if (!(await hasAdminPermissions(interaction.member, ["ManageRoles"]))) {
    throw new Error("Insufficient permissions");
  }
}

async function routeSubcommand(interaction, subcommand, deferred) {
  const logger = getLogger();

  logger.debug("Routing subcommand", {
    subcommand,
    deferred,
    interactionId: interaction.id,
  });

  switch (subcommand) {
    case "create":
      logger.debug("Calling handleScheduleRole");
      await handleScheduleRole(interaction, deferred);
      break;
    case "list":
      logger.debug("Calling handleList");
      await handleList(interaction, deferred);
      break;
    case "cancel":
      logger.debug("Calling handleCancel");
      await handleCancel(interaction, deferred);
      break;
    case "view":
      logger.debug("Calling handleView");
      await handleView(interaction, deferred);
      break;
    default: {
      logger.warn("Invalid subcommand", { subcommand });
      const errorResponse = errorEmbed({
        title: "Invalid Subcommand",
        description:
          "Please use 'create' to schedule a role, 'list' to view schedules, 'view' to see details, or 'cancel' to cancel a schedule.",
      });
      await sendResponse(interaction, errorResponse, deferred);
      break;
    }
  }
}
