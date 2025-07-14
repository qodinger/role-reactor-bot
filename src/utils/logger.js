import chalk from "chalk";

/**
 * Log levels and their configurations
 */
const LOG_LEVELS = {
  ERROR: { level: 0, color: chalk.red, emoji: "❌" },
  WARN: { level: 1, color: chalk.yellow, emoji: "⚠️" },
  INFO: { level: 2, color: chalk.blue, emoji: "ℹ️" },
  DEBUG: { level: 3, color: chalk.gray, emoji: "🔍" },
  SUCCESS: { level: 4, color: chalk.green, emoji: "✅" },
};

/**
 * Structured Logger Class
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || "INFO";
    this.maxLogLevel = LOG_LEVELS[this.logLevel]?.level || 2;
    this.logFile = process.env.LOG_FILE;
    this.enableConsole = process.env.LOG_CONSOLE !== "false";
    this.enableFile = !!this.logFile;
  }

  /**
   * Format timestamp
   * @returns {string} - Formatted timestamp
   */
  formatTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @returns {string} - Formatted log message
   */
  formatMessage(level, message, data = {}) {
    const timestamp = this.formatTimestamp();
    const levelConfig = LOG_LEVELS[level];
    const emoji = levelConfig?.emoji || "📝";

    const baseMessage = `${emoji} [${timestamp}] [${level}] ${message}`;

    if (Object.keys(data).length > 0) {
      return `${baseMessage}\n${JSON.stringify(data, null, 2)}`;
    }

    return baseMessage;
  }

  /**
   * Write log to file
   * @param {string} message - Log message
   */
  writeToFile(message) {
    if (!this.enableFile || !this.logFile) return;

    try {
      const fs = require("fs");
      const path = require("path");

      // Ensure log directory exists
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      fs.appendFileSync(this.logFile, `${message}\n`);
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Log message with level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const levelConfig = LOG_LEVELS[level];
    if (!levelConfig || levelConfig.level > this.maxLogLevel) return;

    const formattedMessage = this.formatMessage(level, message, data);

    // Console output
    if (this.enableConsole) {
      const color = levelConfig.color;
      console.log(color(formattedMessage));
    }

    // File output
    this.writeToFile(formattedMessage);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or additional data
   */
  error(message, error = {}) {
    const errorData =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error;

    this.log("ERROR", message, errorData);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.log("WARN", message, data);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.log("INFO", message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.log("DEBUG", message, data);
  }

  /**
   * Log success message
   * @param {string} message - Success message
   * @param {Object} data - Additional data
   */
  success(message, data = {}) {
    this.log("SUCCESS", message, data);
  }

  /**
   * Log command execution
   * @param {string} commandName - Command name
   * @param {string} userId - User ID
   * @param {number} duration - Execution duration
   * @param {boolean} success - Whether command succeeded
   */
  logCommand(commandName, userId, duration, success = true) {
    this.log(success ? "SUCCESS" : "ERROR", "Command executed", {
      command: commandName,
      userId,
      duration: `${duration}ms`,
      success,
    });
  }

  /**
   * Log event processing
   * @param {string} eventType - Event type
   * @param {string} userId - User ID (optional)
   * @param {number} duration - Processing duration
   */
  logEvent(eventType, userId = null, duration = null) {
    const data = { eventType };
    if (userId) data.userId = userId;
    if (duration) data.duration = `${duration}ms`;

    this.log("INFO", "Event processed", data);
  }

  /**
   * Log database operation
   * @param {string} operation - Database operation
   * @param {string} collection - Collection name
   * @param {number} duration - Operation duration
   * @param {boolean} success - Whether operation succeeded
   */
  logDatabase(operation, collection, duration, success = true) {
    this.log(success ? "INFO" : "ERROR", "Database operation", {
      operation,
      collection,
      duration: `${duration}ms`,
      success,
    });
  }

  /**
   * Log rate limit hit
   * @param {string} userId - User ID
   * @param {string} eventType - Event type
   * @param {Object} rateLimitInfo - Rate limit information
   */
  logRateLimit(userId, eventType, rateLimitInfo) {
    this.warn("Rate limit hit", {
      userId,
      eventType,
      ...rateLimitInfo,
    });
  }

  /**
   * Log performance metrics
   * @param {Object} metrics - Performance metrics
   */
  logPerformance(metrics) {
    this.info("Performance metrics", metrics);
  }

  /**
   * Log startup information
   * @param {Object} startupData - Startup data
   */
  logStartup(startupData) {
    this.success("Bot started successfully", startupData);
  }

  /**
   * Log shutdown information
   * @param {Object} shutdownData - Shutdown data
   */
  logShutdown(shutdownData) {
    this.info("Bot shutting down", shutdownData);
  }
}

// Singleton instance
let logger = null;

/**
 * Get logger instance
 * @returns {Logger} - Logger instance
 */
export function getLogger() {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}

export default Logger;
