/**
 * @fileoverview Centralized Error Handler for Role Reactor Bot
 *
 * Provides comprehensive error handling for Discord API errors, database errors,
 * command execution errors, and validation errors. Includes user-friendly error
 * messages and retry mechanisms for transient errors.
 *
 * @author Tyecode
 * @version Dynamic (see package.json)
 * @license MIT
 */

import { getLogger } from "../logger.js";

/**
 * Centralized Error Handler Class
 *
 * Handles all types of errors that can occur in a Discord bot application,
 * including Discord API errors, database errors, command errors, and validation
 * errors. Provides appropriate logging and user-friendly error messages.
 *
 * @class ErrorHandler
 * @example
 * const errorHandler = new ErrorHandler();
 * errorHandler.handleDiscordError(error, 'command execution');
 */
class ErrorHandler {
  /**
   * Creates a new ErrorHandler instance
   *
   * Initializes the logger for error reporting and debugging.
   *
   * @constructor
   */
  constructor() {
    this.logger = getLogger();
  }

  /**
   * Handles Discord API errors with specific error code handling
   *
   * Maps Discord API error codes to appropriate handling strategies
   * and provides detailed logging for debugging. Common error codes
   * include permission issues, rate limiting, and missing resources.
   *
   * @param {Error} error - The Discord API error object
   * @param {string} context - Context where the error occurred (e.g., 'command execution')
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   await interaction.reply('Hello!');
   * } catch (error) {
   *   errorHandler.handleDiscordError(error, 'reply to interaction', {
   *     userId: interaction.user.id,
   *     channelId: interaction.channelId
   *   });
   * }
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
   * Handles database-related errors
   *
   * Provides specific handling for MongoDB errors including connection
   * issues, timeouts, and duplicate key errors. Useful for debugging
   * database problems and ensuring data integrity.
   *
   * @param {Error} error - The database error object
   * @param {string} operation - Database operation that failed (e.g., 'insert user')
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   await db.collection('users').insertOne(userData);
   * } catch (error) {
   *   errorHandler.handleDatabaseError(error, 'insert user', {
   *     userId: userData.id,
   *     collection: 'users'
   *   });
   * }
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
   * Handles command execution errors
   *
   * Provides detailed logging for command failures including user
   * information and command context for debugging and monitoring.
   *
   * @param {Error} error - The error that occurred during command execution
   * @param {string} commandName - Name of the command that failed
   * @param {string} userId - ID of the user who executed the command
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   await command.execute(interaction, client);
   * } catch (error) {
   *   errorHandler.handleCommandError(error, 'role-reactions', interaction.user.id, {
   *     guildId: interaction.guildId,
   *     channelId: interaction.channelId
   *   });
   * }
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
   * Handles event processing errors
   *
   * Logs errors that occur during Discord event processing such as
   * message reactions, member joins, or other Discord events.
   *
   * @param {Error} error - The error that occurred during event processing
   * @param {string} eventName - Name of the Discord event that failed
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   await eventHandler.processEvent('messageReactionAdd', handler, reaction, user);
   * } catch (error) {
   *   errorHandler.handleEventError(error, 'messageReactionAdd', {
   *     messageId: reaction.message.id,
   *     userId: user.id
   *   });
   * }
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
   * Handles validation errors
   *
   * Logs validation failures for user input, configuration, or
   * other data validation with field-specific information.
   *
   * @param {Error} error - The validation error object
   * @param {string} field - Field that failed validation
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   validateRoleId(roleId);
   * } catch (error) {
   *   errorHandler.handleValidationError(error, 'roleId', {
   *     providedValue: roleId,
   *     expectedFormat: 'Discord Role ID'
   *   });
   * }
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
   * Handles permission-related errors
   *
   * Logs permission failures with user and permission information
   * for security monitoring and debugging access control issues.
   *
   * @param {Error} error - The permission error object
   * @param {string} userId - ID of the user who lacks permissions
   * @param {string} requiredPermission - Required permission that was missing
   * @param {Object} additionalData - Additional data for logging (optional)
   * @example
   * try {
   *   if (!member.permissions.has('ManageRoles')) {
   *     throw new Error('Insufficient permissions');
   *   }
   * } catch (error) {
   *   errorHandler.handlePermissionError(error, member.id, 'ManageRoles', {
   *     guildId: member.guild.id,
   *     channelId: interaction.channelId
   *   });
   * }
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
   * Creates user-friendly error messages
   *
   * Converts technical error codes and messages into user-friendly
   * messages that can be displayed to Discord users without exposing
   * internal system details.
   *
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred (e.g., 'role assignment')
   * @returns {string} User-friendly error message
   * @example
   * const userMessage = errorHandler.createUserFriendlyMessage(error, 'role assignment');
   * await interaction.reply({ content: userMessage, ephemeral: true });
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
   * Determines if an error is retryable
   *
   * Checks if an error is transient and can be safely retried,
   * such as network timeouts or temporary Discord API issues.
   *
   * @param {Error} error - The error object to check
   * @returns {boolean} True if the error is retryable, false otherwise
   * @example
   * if (errorHandler.isRetryableError(error)) {
   *   // Retry the operation after a delay
   *   await new Promise(resolve => setTimeout(resolve, 1000));
   *   return await retryOperation();
   * }
   */
  isRetryableError(error) {
    // Discord API errors that are retryable
    const retryableCodes = [40002, 500, 502, 503, 504];

    // Database errors that are retryable
    const retryableDatabaseErrors = [
      "MongoNetworkError",
      "MongoTimeoutError",
      "ECONNRESET",
      "ETIMEDOUT",
    ];

    if (error.code && retryableCodes.includes(error.code)) {
      return true;
    }

    if (error.name && retryableDatabaseErrors.includes(error.name)) {
      return true;
    }

    return false;
  }

  /**
   * Calculates appropriate retry delay for an error
   *
   * Determines how long to wait before retrying an operation based
   * on the error type and Discord API rate limiting information.
   *
   * @param {Error} error - The error object
   * @returns {number} Retry delay in milliseconds
   * @example
   * const delay = errorHandler.getRetryDelay(error);
   * await new Promise(resolve => setTimeout(resolve, delay));
   * return await retryOperation();
   */
  getRetryDelay(error) {
    // Discord rate limit retry delay
    if (error.code === 40002 && error.retry_after) {
      return error.retry_after * 1000;
    }

    // Default retry delays based on error type
    if (error.code === 500) return 5000; // Server error
    if (error.code === 502 || error.code === 503 || error.code === 504)
      return 3000; // Gateway errors

    // Database connection errors
    if (error.name === "MongoNetworkError") return 2000;
    if (error.name === "MongoTimeoutError") return 1000;

    // Default delay
    return 1000;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
export default errorHandler;
