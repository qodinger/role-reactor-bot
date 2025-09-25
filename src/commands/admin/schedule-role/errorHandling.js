import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";

/**
 * Creates a standardized error response for schedule operations
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @param {string} solution - Solution suggestion
 * @param {Array} fields - Additional fields
 * @returns {Object} Error response object
 */
export function createErrorResponse(
  title,
  description,
  solution = null,
  fields = [],
) {
  const logger = getLogger();

  logger.debug("Creating error response", { title, description });

  const errorData = {
    title,
    description,
  };

  if (solution) {
    errorData.solution = solution;
  }

  if (fields.length > 0) {
    errorData.fields = fields;
  }

  return errorEmbed(errorData);
}

/**
 * Creates a "not found" error response for schedules
 * @param {string} scheduleId - Schedule ID that was not found
 * @returns {Object} Error response object
 */
export function createScheduleNotFoundError(scheduleId) {
  return createErrorResponse(
    "Schedule Not Found",
    `Could not find a schedule with ID \`${scheduleId}\`.`,
    "Use `/schedule-role list` to see all available schedules and their IDs.",
  );
}

/**
 * Creates a "creation failed" error response
 * @param {string} reason - Reason for failure
 * @returns {Object} Error response object
 */
export function createCreationFailedError(
  reason = "Failed to create the schedule. Please try again.",
) {
  return createErrorResponse("Creation Failed", reason);
}

/**
 * Creates a "cancellation failed" error response
 * @param {string} reason - Reason for failure
 * @returns {Object} Error response object
 */
export function createCancellationFailedError(
  reason = "Failed to cancel the schedule. Please try again.",
) {
  return createErrorResponse("Cancellation Failed", reason);
}

/**
 * Creates a "validation failed" error response
 * @param {string} field - Field that failed validation
 * @param {string} reason - Reason for validation failure
 * @returns {Object} Error response object
 */
export function createValidationError(field, reason) {
  return createErrorResponse(
    "Invalid Input",
    `Invalid ${field}: ${reason}`,
    "Please check your input and try again.",
  );
}

/**
 * Creates a "permission denied" error response
 * @param {string} permission - Required permission
 * @returns {Object} Error response object
 */
export function createPermissionError(permission) {
  return createErrorResponse(
    "Permission Denied",
    `You need the **${permission}** permission to use this command.`,
    "Please contact a server administrator to grant you the required permissions.",
  );
}

/**
 * Creates a "unexpected error" response
 * @param {string} operation - Operation that failed
 * @returns {Object} Error response object
 */
export function createUnexpectedError(operation) {
  return createErrorResponse(
    "Unexpected Error",
    `An unexpected error occurred while ${operation}. Please try again.`,
  );
}

/**
 * Handles command errors with proper logging and response
 * @param {Object} interaction - Discord interaction object
 * @param {Error} error - Error object
 * @param {string} operation - Operation that failed
 * @param {boolean} deferred - Whether interaction was deferred
 * @returns {Promise<void>}
 */
export async function handleCommandError(
  interaction,
  error,
  operation,
  deferred,
) {
  const logger = getLogger();

  logger.error(`Error in ${operation}`, {
    error: error.message,
    stack: error.stack,
    interactionId: interaction.id,
  });

  const errorResponse = createUnexpectedError(operation);

  try {
    if (deferred) {
      await interaction.editReply({ embeds: [errorResponse] });
    } else {
      await interaction.reply({ embeds: [errorResponse], flags: 64 });
    }
  } catch (replyError) {
    logger.error("Failed to send error response", {
      error: replyError.message,
      originalError: error.message,
    });
  }
}
