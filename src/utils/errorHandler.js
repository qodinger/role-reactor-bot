import { getLogger } from "./logger.js";

/**
 * Centralized error handling utility following Discord API best practices
 */
class ErrorHandler {
  constructor() {
    this.logger = getLogger();
  }

  /**
   * Handle Discord API errors
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalData - Additional data for logging
   */
  handleDiscordError(error, context = "Unknown", additionalData = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      context,
      ...additionalData,
    };

    // Log the error
    this.logger.error(`Discord API Error in ${context}`, errorInfo);

    // Handle specific Discord error codes
    switch (error.code) {
      case 50001: // Missing Access
        this.logger.warn("Bot lacks required permissions", errorInfo);
        break;
      case 50013: // Missing Permissions
        this.logger.warn("Bot lacks required permissions", errorInfo);
        break;
      case 10008: // Unknown Message/Guild
        this.logger.warn(
          "Message/Guild not found (may have been deleted)",
          errorInfo,
        );
        break;
      case 10013: // Unknown User
        this.logger.warn("User not found", errorInfo);
        break;
      case 10007: // Unknown Channel
        this.logger.warn("Channel not found", errorInfo);
        break;
      case 10062: // Unknown Interaction
        this.logger.warn("Interaction not found or expired", errorInfo);
        break;
      case 40001: // Unauthorized
        this.logger.error("Bot token is invalid", errorInfo);
        break;
      case 40002: // You are being rate limited
        this.logger.warn("Rate limited by Discord API", errorInfo);
        break;
      default:
        this.logger.error("Unhandled Discord API error", errorInfo);
    }
  }

  /**
   * Handle database errors
   * @param {Error} error - The error object
   * @param {string} operation - Database operation that failed
   * @param {Object} additionalData - Additional data for logging
   */
  handleDatabaseError(error, operation = "Unknown", additionalData = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      operation,
      ...additionalData,
    };

    this.logger.error(`Database Error in ${operation}`, errorInfo);

    // Handle specific database errors
    if (error.name === "MongoNetworkError") {
      this.logger.error("Database connection failed", errorInfo);
    } else if (error.name === "MongoTimeoutError") {
      this.logger.error("Database operation timed out", errorInfo);
    } else if (error.code === 11000) {
      this.logger.warn("Duplicate key error", errorInfo);
    }
  }

  /**
   * Handle command execution errors
   * @param {Error} error - The error object
   * @param {string} commandName - Name of the command that failed
   * @param {string} userId - ID of the user who executed the command
   * @param {Object} additionalData - Additional data for logging
   */
  handleCommandError(error, commandName, userId, additionalData = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      commandName,
      userId,
      ...additionalData,
    };

    this.logger.error(`Command Error in ${commandName}`, errorInfo);
  }

  /**
   * Handle event processing errors
   * @param {Error} error - The error object
   * @param {string} eventName - Name of the event that failed
   * @param {Object} additionalData - Additional data for logging
   */
  handleEventError(error, eventName, additionalData = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      eventName,
      ...additionalData,
    };

    this.logger.error(`Event Error in ${eventName}`, errorInfo);
  }

  /**
   * Handle validation errors
   * @param {Error} error - The error object
   * @param {string} field - Field that failed validation
   * @param {Object} additionalData - Additional data for logging
   */
  handleValidationError(error, field, additionalData = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      field,
      ...additionalData,
    };

    this.logger.warn(`Validation Error for ${field}`, errorInfo);
  }

  /**
   * Handle permission errors
   * @param {Error} error - The error object
   * @param {string} userId - ID of the user who lacks permissions
   * @param {string} requiredPermission - Required permission
   * @param {Object} additionalData - Additional data for logging
   */
  handlePermissionError(
    error,
    userId,
    requiredPermission,
    additionalData = {},
  ) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      userId,
      requiredPermission,
      ...additionalData,
    };

    this.logger.warn(`Permission Error for user ${userId}`, errorInfo);
  }

  /**
   * Create user-friendly error messages
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred
   * @returns {string} User-friendly error message
   */
  createUserFriendlyMessage(error, context = "operation") {
    if (error.code) {
      switch (error.code) {
        case 50001:
        case 50013:
          return "I don't have the required permissions to perform this action.";
        case 10008:
          return "The message/server was not found. It may have been deleted.";
        case 10013:
          return "The user was not found.";
        case 10007:
          return "The channel was not found.";
        case 10062:
          return "This interaction has expired. Please try again.";
        case 40002:
          return "I'm being rate limited. Please try again in a moment.";
        default:
          return `An error occurred during ${context}. Please try again.`;
      }
    }

    return `An unexpected error occurred during ${context}. Please try again.`;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - The error object
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [
      40002, // Rate limited
      50001, // Missing Access (temporary)
      50013, // Missing Permissions (temporary)
      10008, // Unknown Message (temporary)
      10013, // Unknown User (temporary)
      10007, // Unknown Channel (temporary)
      10008, // Unknown Guild (temporary)
      10062, // Unknown Interaction (temporary)
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Get retry delay for rate limited requests
   * @param {Error} error - The rate limit error
   * @returns {number} Retry delay in milliseconds
   */
  getRetryDelay(error) {
    if (error.code === 40002 && error.retry_after) {
      return error.retry_after * 1000; // Convert to milliseconds
    }
    return 5000; // Default 5 second delay
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
export default errorHandler;
