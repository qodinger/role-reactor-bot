import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  createOneTimeScheduleEmbed,
  createRecurringScheduleEmbed,
} from "./embeds.js";
import { extractScheduleOptions, formatDisplayId } from "./utils.js";
import { THEME } from "../../../config/theme.js";

// Import refactored utility modules
import { validateScheduleOptions } from "./validation.js";
import { sendResponse } from "./deferral.js";
import { handleCommandError } from "./errorHandling.js";
import {
  createOneTimeSchedule as createOneTimeScheduleOp,
  createRecurringSchedule as createRecurringScheduleOp,
  cancelScheduleById,
  getScheduleById,
} from "./scheduleOperations.js";

// ============================================================================
// SCHEDULE CREATION HANDLERS
// ============================================================================

export async function handleScheduleRole(interaction, deferred = false) {
  const logger = getLogger();

  try {
    // Handle schedule role creation with proper deferral support

    // Extract and validate options
    const options = extractScheduleOptions(interaction);
    logger.debug("Options received", { options });

    const optionsValidation = validateScheduleOptions(options);
    if (!optionsValidation.success) {
      return await sendResponse(
        interaction,
        optionsValidation.errorResponse,
        deferred,
      );
    }

    const { userIds } = optionsValidation.data;
    const validatedOptions = { ...options, userIds };

    // Create schedule based on type
    let result;
    let embed;

    if (validatedOptions.type === "one-time") {
      const scheduleResult = await createOneTimeScheduleOp(
        interaction,
        validatedOptions,
      );
      if (!scheduleResult.success) {
        return await sendResponse(
          interaction,
          scheduleResult.errorResponse,
          deferred,
        );
      }
      result = scheduleResult.data;
      embed = createOneTimeScheduleEmbed(result, validatedOptions);
    } else {
      const scheduleResult = await createRecurringScheduleOp(
        interaction,
        validatedOptions,
      );
      if (!scheduleResult.success) {
        return await sendResponse(
          interaction,
          scheduleResult.errorResponse,
          deferred,
        );
      }
      result = scheduleResult.data;

      // Parse schedule for embed details
      const { parseRecurringSchedule } = await import(
        "../../../utils/scheduleParser.js"
      );
      const parsedSchedule = parseRecurringSchedule(
        validatedOptions.type,
        validatedOptions.schedule,
      );
      embed = createRecurringScheduleEmbed(
        result,
        validatedOptions,
        parsedSchedule,
      );
    }

    // Send success response
    await sendResponse(
      interaction,
      {
        embeds: [embed],
        flags: 0, // Not ephemeral
      },
      deferred,
    );

    logger.debug("Schedule creation completed successfully", {
      type: validatedOptions.type,
      scheduleId: result.scheduleId,
    });
  } catch (error) {
    await handleCommandError(interaction, error, "schedule creation", deferred);
  }
}

// ============================================================================
// CANCEL HANDLERS
// ============================================================================

export async function handleCancel(interaction, deferred = false) {
  const logger = getLogger();

  try {
    // Note: Deferral is now skipped for schedule-role commands due to Discord API slowness
    // This handler works without deferral

    const scheduleId = interaction.options.getString("id");
    logger.debug("Cancelling schedule", { scheduleId });

    // Cancel the schedule
    const cancelResult = await cancelScheduleById(scheduleId);
    if (!cancelResult.success) {
      return await sendResponse(
        interaction,
        cancelResult.errorResponse,
        deferred,
      );
    }

    const schedule = cancelResult.data;
    const roleName =
      interaction.guild.roles.cache.get(schedule.roleId)?.name ||
      "Unknown Role";

    // Create success response
    const { EmbedBuilder } = await import("discord.js");
    const successResponse = {
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Schedule Cancelled")
          .setDescription(
            `Successfully cancelled the schedule for **${roleName}**`,
          )
          .addFields(
            {
              name: "Schedule ID",
              value: `\`${formatDisplayId(schedule.scheduleId)}\``,
              inline: true,
            },
            { name: "Status", value: "🚫 **Cancelled**", inline: true },
            {
              name: "Users",
              value: `${schedule.userIds.length} user(s)`,
              inline: true,
            },
          )
          .setColor(THEME.SUCCESS)
          .setTimestamp(),
      ],
      ephemeral: false,
    };

    await sendResponse(interaction, successResponse, deferred);

    logger.debug("Schedule cancellation completed successfully", {
      scheduleId,
      originalScheduleId: schedule.scheduleId,
    });
  } catch (error) {
    await handleCommandError(
      interaction,
      error,
      "schedule cancellation",
      deferred,
    );
  }
}

// ============================================================================
// VIEW HANDLERS
// ============================================================================

export async function handleView(interaction, deferred = false) {
  const logger = getLogger();

  try {
    // Note: Deferral is now skipped for schedule-role commands due to Discord API slowness
    // This handler works without deferral

    const scheduleId = interaction.options.getString("id");
    logger.debug("Viewing schedule", { scheduleId });

    // Get the schedule
    const scheduleResult = await getScheduleById(scheduleId);
    if (!scheduleResult.success) {
      return await sendResponse(
        interaction,
        scheduleResult.errorResponse,
        deferred,
      );
    }

    const schedule = scheduleResult.data;

    // Create detail embed
    const { createScheduleDetailEmbed } = await import("./embeds.js");
    const embed = createScheduleDetailEmbed(schedule, interaction.guild);

    await sendResponse(
      interaction,
      {
        embeds: [embed],
        flags: 0, // Not ephemeral
      },
      deferred,
    );

    logger.debug("Schedule view completed successfully", {
      scheduleId,
      originalScheduleId: schedule.scheduleId,
    });
  } catch (error) {
    await handleCommandError(interaction, error, "schedule view", deferred);
  }
}

export async function handleUpdate(interaction, deferred = false) {
  try {
    // Note: Deferral is now skipped for schedule-role commands due to Discord API slowness
    // This handler works without deferral

    const scheduleId = interaction.options.getString("id");
    if (!scheduleId) {
      return await sendResponse(
        interaction,
        errorEmbed(
          "Missing Schedule ID",
          "Please provide a schedule ID to update.",
        ),
        deferred,
      );
    }

    // Extract update options
    const updateOptions = {
      schedule: interaction.options.getString("schedule"),
      duration: interaction.options.getString("duration"),
      users: interaction.options.getString("users"),
      role: interaction.options.getRole("role"),
      reason: interaction.options.getString("reason"),
    };

    // Check if at least one field is being updated
    const hasUpdates = Object.values(updateOptions).some(
      value => value !== null,
    );
    if (!hasUpdates) {
      return await sendResponse(
        interaction,
        errorEmbed(
          "No Updates Provided",
          "Please provide at least one field to update (schedule, duration, users, role, or reason).",
        ),
        deferred,
      );
    }

    const { updateScheduleById } = await import("./scheduleOperations.js");
    const result = await updateScheduleById(
      scheduleId,
      updateOptions,
      interaction,
    );

    if (!result.success) {
      return await sendResponse(interaction, result.errorResponse, deferred);
    }

    const { createScheduleUpdateEmbed } = await import("./embeds.js");
    const embed = createScheduleUpdateEmbed(
      result.data,
      updateOptions,
      interaction.guild,
    );

    await sendResponse(interaction, embed, deferred);
  } catch (error) {
    await handleCommandError(interaction, error, "schedule update", deferred);
  }
}

export async function handleBulkCancel(interaction, deferred = false) {
  try {
    // Note: Deferral is now skipped for schedule-role commands due to Discord API slowness
    // This handler works without deferral

    const idsInput = interaction.options.getString("ids");
    const reason =
      interaction.options.getString("reason") || "Bulk cancellation";

    if (!idsInput) {
      return await sendResponse(
        interaction,
        errorEmbed(
          "Missing Schedule IDs",
          "Please provide schedule IDs to cancel.",
        ),
        deferred,
      );
    }

    // Parse the IDs
    const scheduleIds = idsInput
      .split(",")
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (scheduleIds.length === 0) {
      return await sendResponse(
        interaction,
        errorEmbed(
          "Invalid Schedule IDs",
          "Please provide valid schedule IDs separated by commas.",
        ),
        deferred,
      );
    }

    if (scheduleIds.length > 10) {
      return await sendResponse(
        interaction,
        errorEmbed(
          "Too Many Schedules",
          "You can cancel up to 10 schedules at once.",
        ),
        deferred,
      );
    }

    const { bulkCancelSchedules } = await import("./scheduleOperations.js");
    const result = await bulkCancelSchedules(scheduleIds, reason, interaction);

    if (!result.success) {
      return await sendResponse(interaction, result.errorResponse, deferred);
    }

    const { createBulkCancelEmbed } = await import("./embeds.js");
    const embed = createBulkCancelEmbed(result.data, interaction.guild);

    await sendResponse(interaction, embed, deferred);
  } catch (error) {
    await handleCommandError(
      interaction,
      error,
      "bulk schedule cancellation",
      deferred,
    );
  }
}
