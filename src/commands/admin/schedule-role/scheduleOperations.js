import { getLogger } from "../../../utils/logger.js";
import {
  scheduleTemporaryRole,
  createRecurringRoleSchedule,
  findScheduleById,
  cancelSchedule,
} from "../../../utils/discord/scheduleRoles.js";
import {
  parseOneTimeSchedule,
  parseRecurringSchedule,
  getScheduleHelpText,
} from "../../../utils/scheduleParser.js";
import { createErrorResponse } from "./errorHandling.js";

/**
 * Creates a one-time schedule
 * @param {Object} interaction - Discord interaction object
 * @param {Object} options - Schedule options
 * @returns {Object} Result with success boolean and data/error
 */
export async function createOneTimeSchedule(interaction, options) {
  const logger = getLogger();

  logger.debug("Creating one-time schedule", {
    roleId: options.role.id,
    userIds: options.userIds,
    schedule: options.schedule,
    duration: options.duration,
  });

  try {
    const scheduleTime = parseOneTimeSchedule(options.schedule);
    if (!scheduleTime) {
      logger.warn("Invalid one-time schedule format", {
        schedule: options.schedule,
      });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Invalid Schedule Format",
          "Please provide a valid time format (e.g., 'tomorrow 9am', '9am', 'monday 6pm').",
          getScheduleHelpText("one-time"),
        ),
      };
    }

    const result = await scheduleTemporaryRole(
      interaction.guild.id,
      options.userIds,
      options.role.id,
      scheduleTime,
      options.duration,
      options.reason,
      interaction.user.id,
    );

    if (!result) {
      logger.error("Failed to create one-time schedule", { options });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Creation Failed",
          "Failed to create the one-time schedule. Please try again.",
        ),
      };
    }

    logger.debug("One-time schedule created successfully", {
      scheduleId: result.scheduleId,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error("Error creating one-time schedule", {
      error: error.message,
      options,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Creation Error",
        "An error occurred while creating the one-time schedule.",
      ),
    };
  }
}

/**
 * Creates a recurring schedule
 * @param {Object} interaction - Discord interaction object
 * @param {Object} options - Schedule options
 * @returns {Object} Result with success boolean and data/error
 */
export async function createRecurringSchedule(interaction, options) {
  const logger = getLogger();

  logger.debug("Creating recurring schedule", {
    type: options.type,
    roleId: options.role.id,
    userIds: options.userIds,
    schedule: options.schedule,
    duration: options.duration,
  });

  try {
    const schedule = parseRecurringSchedule(options.type, options.schedule);
    if (!schedule) {
      logger.warn("Invalid recurring schedule format", {
        type: options.type,
        schedule: options.schedule,
      });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Invalid Schedule Format",
          "Please provide a valid recurring schedule format.",
          getScheduleHelpText(options.type),
        ),
      };
    }

    const result = await createRecurringRoleSchedule(
      interaction.guild.id,
      options.userIds,
      options.role.id,
      schedule,
      options.duration,
      options.reason,
      interaction.user.id,
    );

    if (!result) {
      logger.error("Failed to create recurring schedule", { options });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Creation Failed",
          "Failed to create the recurring schedule. Please try again.",
        ),
      };
    }

    logger.debug("Recurring schedule created successfully", {
      scheduleId: result.scheduleId,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error("Error creating recurring schedule", {
      error: error.message,
      options,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Creation Error",
        "An error occurred while creating the recurring schedule.",
      ),
    };
  }
}

/**
 * Cancels a schedule by ID
 * @param {string} scheduleId - Schedule ID to cancel
 * @returns {Object} Result with success boolean and data/error
 */
export async function cancelScheduleById(scheduleId) {
  const logger = getLogger();

  logger.debug("Cancelling schedule", { scheduleId });

  try {
    const schedule = await findScheduleById(scheduleId);
    if (!schedule) {
      logger.warn("Schedule not found for cancellation", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Schedule Not Found",
          `Could not find a schedule with ID \`${scheduleId}\`.`,
          "Use `/schedule-role list` to see all available schedules and their IDs.",
        ),
      };
    }

    const success = await cancelSchedule(schedule.scheduleId);
    if (!success) {
      logger.error("Failed to cancel schedule", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Cancellation Failed",
          "Failed to cancel the schedule. Please try again.",
        ),
      };
    }

    logger.debug("Schedule cancelled successfully", {
      scheduleId,
      originalScheduleId: schedule.scheduleId,
    });

    return {
      success: true,
      data: schedule,
    };
  } catch (error) {
    logger.error("Error cancelling schedule", {
      error: error.message,
      scheduleId,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Cancellation Error",
        "An error occurred while trying to cancel the schedule.",
      ),
    };
  }
}

/**
 * Retrieves a schedule by ID
 * @param {string} scheduleId - Schedule ID to retrieve
 * @returns {Object} Result with success boolean and data/error
 */
export async function getScheduleById(scheduleId) {
  const logger = getLogger();

  logger.debug("Retrieving schedule", { scheduleId });

  try {
    const schedule = await findScheduleById(scheduleId);
    if (!schedule) {
      logger.warn("Schedule not found", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Schedule Not Found",
          `Could not find a schedule with ID \`${scheduleId}\`.`,
          "Use `/schedule-role list` to see all available schedules and their IDs.",
        ),
      };
    }

    logger.debug("Schedule retrieved successfully", {
      scheduleId,
      originalScheduleId: schedule.scheduleId,
    });

    return {
      success: true,
      data: schedule,
    };
  } catch (error) {
    logger.error("Error retrieving schedule", {
      error: error.message,
      scheduleId,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Retrieval Error",
        "An error occurred while trying to retrieve the schedule.",
      ),
    };
  }
}

/**
 * Updates a schedule by ID
 * @param {string} scheduleId - Schedule ID to update
 * @param {Object} updateOptions - Fields to update
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Result with success boolean and data/error
 */
export async function updateScheduleById(
  scheduleId,
  updateOptions,
  interaction,
) {
  const logger = getLogger();

  logger.debug("Updating schedule", { scheduleId, updateOptions });

  try {
    // First, get the existing schedule
    const existingSchedule = await findScheduleById(scheduleId);
    if (!existingSchedule) {
      logger.warn("Schedule not found for update", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Schedule Not Found",
          `Could not find a schedule with ID \`${scheduleId}\`.`,
          "Use `/schedule-role list` to see all available schedules and their IDs.",
        ),
      };
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date().toISOString(),
      updatedBy: interaction.user.id,
    };

    // Handle schedule time update
    if (updateOptions.schedule) {
      const { parseOneTimeSchedule, parseRecurringSchedule } = await import(
        "../../../utils/scheduleParser.js"
      );

      let newScheduleTime = null;
      if (existingSchedule.type === "one-time") {
        newScheduleTime = parseOneTimeSchedule(updateOptions.schedule);
        if (!newScheduleTime) {
          return {
            success: false,
            errorResponse: createErrorResponse(
              "Invalid Schedule Format",
              "Please provide a valid time format for one-time schedules.",
              "Examples: 'tomorrow 9am', 'friday 2pm', 'in 2 hours'",
            ),
          };
        }
        updateData.scheduleTime = newScheduleTime.toISOString();
      } else {
        // For recurring schedules, parse the recurring format
        const parsedSchedule = parseRecurringSchedule(
          existingSchedule.type,
          updateOptions.schedule,
        );
        if (!parsedSchedule) {
          return {
            success: false,
            errorResponse: createErrorResponse(
              "Invalid Schedule Format",
              `Please provide a valid ${existingSchedule.type} schedule format.`,
              "Examples: '9am' (daily), 'monday 6pm' (weekly), '15 2pm' (monthly)",
            ),
          };
        }
        updateData.schedule = parsedSchedule;
        // Recalculate next run time
        const { calculateNextRun } = await import(
          "../../../utils/discord/scheduleRoles.js"
        );
        updateData.nextRun = calculateNextRun(parsedSchedule);
      }
    }

    // Handle duration update
    if (updateOptions.duration) {
      const { isValidDuration } = await import(
        "../../../utils/discord/inputUtils.js"
      );
      if (!isValidDuration(updateOptions.duration)) {
        return {
          success: false,
          errorResponse: createErrorResponse(
            "Invalid Duration Format",
            "Please provide a valid duration format.",
            "Examples: '1h', '2d', '1w', '30m'",
          ),
        };
      }
      updateData.duration = updateOptions.duration;
    }

    // Handle users update
    if (updateOptions.users) {
      const { parseUserInput } = await import("./utils.js");
      const userIds = parseUserInput(updateOptions.users);
      if (userIds.length === 0) {
        return {
          success: false,
          errorResponse: createErrorResponse(
            "Invalid Users",
            "Please provide valid user IDs or mentions.",
            "Examples: '123456789', '@User', '123,456,@User'",
          ),
        };
      }
      updateData.userIds = userIds;
    }

    // Handle role update
    if (updateOptions.role) {
      updateData.roleId = updateOptions.role.id;
    }

    // Handle reason update
    if (updateOptions.reason !== null) {
      updateData.reason = updateOptions.reason;
    }

    // Update the schedule in the database
    const { updateSchedule } = await import(
      "../../../utils/discord/scheduleRoles.js"
    );
    const success = await updateSchedule(
      existingSchedule.scheduleId,
      updateData,
    );

    if (!success) {
      logger.error("Failed to update schedule in database", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Update Failed",
          "Failed to update the schedule in the database. Please try again.",
        ),
      };
    }

    // Get the updated schedule
    const updatedSchedule = await findScheduleById(scheduleId);
    if (!updatedSchedule) {
      logger.error("Failed to retrieve updated schedule", { scheduleId });
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Update Verification Failed",
          "Schedule was updated but could not be retrieved for confirmation.",
        ),
      };
    }

    logger.debug("Schedule updated successfully", {
      scheduleId,
      originalScheduleId: existingSchedule.scheduleId,
      updatedFields: Object.keys(updateData),
    });

    return {
      success: true,
      data: {
        original: existingSchedule,
        updated: updatedSchedule,
        changes: updateOptions,
      },
    };
  } catch (error) {
    logger.error("Error updating schedule", {
      error: error.message,
      scheduleId,
      updateOptions,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Update Error",
        "An error occurred while trying to update the schedule.",
      ),
    };
  }
}

/**
 * Cancels multiple schedules by IDs
 * @param {string[]} scheduleIds - Array of schedule IDs to cancel
 * @param {string} reason - Reason for bulk cancellation
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Result with success boolean and data/error
 */
export async function bulkCancelSchedules(scheduleIds, reason, interaction) {
  const logger = getLogger();

  logger.debug("Bulk cancelling schedules", { scheduleIds, reason });

  try {
    const results = {
      successful: [],
      failed: [],
      notFound: [],
    };

    // Process each schedule ID
    for (const scheduleId of scheduleIds) {
      try {
        const result = await cancelScheduleById(scheduleId);

        if (result.success) {
          results.successful.push({
            scheduleId,
            data: result.data,
          });
        } else {
          if (result.errorResponse.title === "Schedule Not Found") {
            results.notFound.push(scheduleId);
          } else {
            results.failed.push({
              scheduleId,
              error: result.errorResponse.description,
            });
          }
        }
      } catch (error) {
        logger.error("Error cancelling schedule in bulk operation", {
          scheduleId,
          error: error.message,
        });
        results.failed.push({
          scheduleId,
          error: error.message,
        });
      }
    }

    // Determine overall success
    const hasSuccessful = results.successful.length > 0;
    const hasFailures =
      results.failed.length > 0 || results.notFound.length > 0;

    if (!hasSuccessful && hasFailures) {
      // All failed
      return {
        success: false,
        errorResponse: createErrorResponse(
          "Bulk Cancellation Failed",
          `Failed to cancel any of the ${scheduleIds.length} schedules.`,
          `Successful: 0, Failed: ${results.failed.length}, Not Found: ${results.notFound.length}`,
        ),
      };
    }

    logger.debug("Bulk cancellation completed", {
      total: scheduleIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      notFound: results.notFound.length,
    });

    return {
      success: true,
      data: {
        results,
        summary: {
          total: scheduleIds.length,
          successful: results.successful.length,
          failed: results.failed.length,
          notFound: results.notFound.length,
        },
        reason,
        cancelledBy: interaction.user.id,
      },
    };
  } catch (error) {
    logger.error("Error in bulk cancellation", {
      error: error.message,
      scheduleIds,
    });
    return {
      success: false,
      errorResponse: createErrorResponse(
        "Bulk Cancellation Error",
        "An error occurred while trying to cancel the schedules.",
      ),
    };
  }
}
