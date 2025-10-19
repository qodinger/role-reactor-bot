import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleScheduleRole,
  handleCancel,
  handleView,
  handleUpdate,
  handleBulkCancel,
} from "./handlers.js";
import { handleList } from "./list.js";

// Import refactored utility modules
import { validateInteraction, validateBotMember } from "./validation.js";
import { sendResponse, handleDeferral } from "./deferral.js";
import { handleCommandError } from "./errorHandling.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("schedule-role")
  .setDescription("Schedule a role assignment - permanent or temporary")
  .addSubcommand(subcommand =>
    subcommand
      .setName("create")
      .setDescription("Create a new role schedule - permanent or temporary")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User IDs or mentions separated by comma, semicolon, or space",
          )
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
          .setDescription(
            "How long the role should last (e.g., 1h, 2d, 1w) - Leave empty for permanent roles",
          )
          .setRequired(false),
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
          .setDescription("Schedule ID (short format like SRA1B2C3)")
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
          .setDescription("Schedule ID (short format like SRA1B2C3)")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("update")
      .setDescription("Update an existing schedule")
      .addStringOption(option =>
        option
          .setName("id")
          .setDescription("Schedule ID to update (short format like SRA1B2C3)")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("schedule")
          .setDescription(
            "New schedule time (e.g., 'tomorrow 9am', 'monday 6pm')",
          )
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("duration")
          .setDescription("New duration (e.g., 1h, 2d, 1w)")
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription("New comma-separated list of user IDs or mentions")
          .setRequired(false),
      )
      .addRoleOption(option =>
        option
          .setName("role")
          .setDescription("New role to assign")
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("New reason for the role assignment")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("bulk-cancel")
      .setDescription("Cancel multiple schedules at once")
      .addStringOption(option =>
        option
          .setName("ids")
          .setDescription("Comma-separated list of schedule IDs to cancel")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for bulk cancellation")
          .setRequired(false),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();
  let deferResult = { success: false }; // Default value

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    // Validate interaction first to avoid unnecessary work
    const validation = validateInteraction(interaction);
    if (!validation.success) {
      logger.warn("Interaction validation failed", {
        interactionId: interaction.id,
        error: validation.error,
      });
      return;
    }

    // Always defer the interaction to prevent timeout during database operations
    deferResult = await handleDeferral(interaction);
    logger.debug("Deferral result", {
      interactionId: interaction.id,
      success: deferResult.success,
      error: deferResult.error,
      alreadyAcknowledged: deferResult.alreadyAcknowledged,
    });

    if (!deferResult.success) {
      logger.warn("Failed to defer interaction, proceeding without deferral", {
        interactionId: interaction.id,
        error: deferResult.error,
      });
    }

    // Validate bot member
    const botMemberValidation = validateBotMember(interaction);
    if (!botMemberValidation.success) {
      return await sendResponse(
        interaction,
        errorEmbed(botMemberValidation.errorResponse),
        deferResult.deferred || deferResult.success, // Use actual deferral status
      );
    }

    // Check permissions
    await checkPermissions(interaction);

    const subcommand = interaction.options.getSubcommand();
    // Use deferral result for status
    const isDeferred = deferResult.success && deferResult.deferred;

    await routeSubcommand(interaction, subcommand, isDeferred);
  } catch (error) {
    await handleCommandError(
      interaction,
      error,
      "schedule-role command",
      deferResult?.success || false, // Use actual deferral status
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
    case "update":
      logger.debug("Calling handleUpdate");
      await handleUpdate(interaction, deferred);
      break;
    case "bulk-cancel":
      logger.debug("Calling handleBulkCancel");
      await handleBulkCancel(interaction, deferred);
      break;
    default: {
      logger.warn("Invalid subcommand", { subcommand });
      const errorResponse = errorEmbed({
        title: "Invalid Subcommand",
        description:
          "Please use 'create' to schedule a role, 'list' to view schedules, 'view' to see details, 'update' to modify a schedule, 'cancel' to cancel a schedule, or 'bulk-cancel' to cancel multiple schedules.",
      });
      await sendResponse(interaction, errorResponse, deferred);
      break;
    }
  }
}
