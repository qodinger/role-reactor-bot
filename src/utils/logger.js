import chalk from "chalk";
import fs from "fs";
import path from "path";

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
 * A structured logger for the application.
 */
class Logger {
  constructor() {
    // Initialize with environment variables or defaults
    const logLevel = process.env.LOG_LEVEL || "INFO";
    this.maxLogLevel = LOG_LEVELS[logLevel]?.level ?? 2;
    this.logFile = process.env.LOG_FILE || null;
    this.enableConsole = process.env.LOG_CONSOLE !== "false";

    // Try to load config asynchronously and update settings (non-blocking)
    this._loadConfigAsync().catch(() => {
      // Silently fail - we have defaults
    });
  }

  async _loadConfigAsync() {
    try {
      const configModule = await import("../config/config.js");
      const config =
        configModule?.config || configModule?.default || configModule || {};

      if (config.logging) {
        const { level, file, console: enableConsole } = config.logging;
        if (level) {
          this.maxLogLevel = LOG_LEVELS[level]?.level ?? this.maxLogLevel;
        }
        if (file !== undefined) {
          this.logFile = file || null;
        }
        if (enableConsole !== undefined) {
          this.enableConsole = enableConsole;
        }
      }
    } catch {
      // Use defaults already set
    }
  }

  /**
   * Logs a message with a specified level.
   * @param {string} level - The log level.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional data to log.
   */
  log(level, message, data = {}) {
    const levelConfig = LOG_LEVELS[level];
    if (!levelConfig || levelConfig.level > this.maxLogLevel) return;

    const formattedMessage = this.formatMessage(level, message, data);
    if (this.enableConsole) {
      console.log(levelConfig.color(formattedMessage));
    }
    if (this.logFile) {
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * Logs an error message.
   * @param {string} message - The error message.
   * @param {Error|object} [error={}] - The error object or additional data.
   */
  error(message, error = {}) {
    const errorData =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
    this.log("ERROR", message, errorData);
  }

  /**
   * Logs a warning message.
   * @param {string} message - The warning message.
   * @param {object} [data={}] - Additional data.
   */
  warn(message, data = {}) {
    this.log("WARN", message, data);
  }

  /**
   * Logs an info message.
   * @param {string} message - The info message.
   * @param {object} [data={}] - Additional data.
   */
  info(message, data = {}) {
    this.log("INFO", message, data);
  }

  /**
   * Logs a debug message.
   * @param {string} message - The debug message.
   * @param {object} [data={}] - Additional data.
   */
  debug(message, data = {}) {
    this.log("DEBUG", message, data);
  }

  /**
   * Logs a success message.
   * @param {string} message - The success message.
   * @param {object} [data={}] - Additional data.
   */
  success(message, data = {}) {
    this.log("SUCCESS", message, data);
  }

  /**
   * Logs command execution with user tracking.
   * @param {string} commandName - Name of the command.
   * @param {string} userId - ID of the user who executed the command.
   * @param {number} duration - Execution time in milliseconds.
   * @param {boolean} success - Whether the command succeeded.
   */
  logCommand(commandName, userId, duration, success) {
    this.log("INFO", `Command executed: ${commandName}`, {
      userId,
      duration,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs rate limit events.
   * @param {string} userId - ID of the user who was rate limited.
   * @param {string} eventType - Type of event that was rate limited.
   * @param {object} rateLimitInfo - Rate limit information.
   */
  logRateLimit(userId, eventType, rateLimitInfo) {
    this.log("WARN", `Rate limit exceeded: ${eventType}`, {
      userId,
      eventType,
      rateLimitInfo,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Formats a log message.
   * @param {string} level - The log level.
   * @param {string} message - The log message.
   * @param {object} data - Additional data.
   * @returns {string} The formatted log message.
   */
  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const { emoji } = LOG_LEVELS[level];
    let formatted = `${emoji} [${timestamp}] [${level}] ${message}`;
    if (Object.keys(data).length > 0) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }
    return formatted;
  }

  /**
   * Writes a log message to the file.
   * @param {string} message - The log message.
   */
  writeToFile(message) {
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(this.logFile, `${message}\n`);
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }
}

// Singleton instance
let logger = null;

/**
 * Gets the singleton logger instance.
 * @returns {Logger} The logger instance.
 */
export function getLogger() {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}
