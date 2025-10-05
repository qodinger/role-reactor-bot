import { getLogger } from "../../../utils/logger.js";
import {
  scheduleTemporaryRole,
  createRecurringRoleSchedule,
  findScheduleById,
  cancelSchedule,
} from "../../../utils/discord/temporaryRoles.js";
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
