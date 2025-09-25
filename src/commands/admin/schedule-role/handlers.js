import { getLogger } from "../../../utils/logger.js";
import {
  createOneTimeScheduleEmbed,
  createRecurringScheduleEmbed,
} from "./embeds.js";
import { extractScheduleOptions, formatDisplayId } from "./utils.js";
import { THEME } from "../../../config/theme.js";

// Import refactored utility modules
import { validateInteraction, validateScheduleOptions } from "./validation.js";
import { handleDeferral, sendResponse } from "./deferral.js";
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

export async function handleScheduleRole(interaction, deferred = true) {
  const logger = getLogger();

  try {
    // Validate interaction only if not already deferred
    if (!deferred) {
      const validation = validateInteraction(interaction);
      if (!validation.success) {
        return;
      }
    }

    // Handle deferral if not already deferred
    if (!deferred) {
      const deferResult = await handleDeferral(interaction);
      if (!deferResult.success) {
        if (deferResult.isExpired) {
          logger.warn("Interaction expired during deferral");
        }
        return;
      }
      deferred = true; // Update deferred status
    }

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
        ephemeral: false,
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

export async function handleCancel(interaction, deferred = true) {
  const logger = getLogger();

  try {
    // Validate interaction only if not already deferred
    if (!deferred) {
      const validation = validateInteraction(interaction);
      if (!validation.success) {
        return;
      }
    }

    // Handle deferral if not already deferred
    if (!deferred) {
      const deferResult = await handleDeferral(interaction);
      if (!deferResult.success) {
        if (deferResult.isExpired) {
          logger.warn("Interaction expired during deferral");
        }
        return;
      }
      deferred = true; // Update deferred status
    }

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

export async function handleView(interaction, deferred = true) {
  const logger = getLogger();

  try {
    // Validate interaction only if not already deferred
    if (!deferred) {
      const validation = validateInteraction(interaction);
      if (!validation.success) {
        return;
      }
    }

    // Handle deferral if not already deferred
    if (!deferred) {
      const deferResult = await handleDeferral(interaction);
      if (!deferResult.success) {
        if (deferResult.isExpired) {
          logger.warn("Interaction expired during deferral");
        }
        return;
      }
      deferred = true; // Update deferred status
    }

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
        ephemeral: false,
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
