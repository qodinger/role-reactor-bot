import { getLogger } from "./logger.js";
import { errorHandler } from "./errorHandler.js";

/**
 * Rate limiting utility following Discord API best practices
 */
class RateLimiter {
  constructor() {
    this.logger = getLogger();
    this.userLimits = new Map();
    this.commandLimits = new Map();
    this.globalLimits = new Map();

    // Default rate limit settings
    this.defaultUserLimit = 5; // commands per minute per user
    this.defaultCommandLimit = 3; // commands per minute per command per user
    this.defaultGlobalLimit = 100; // commands per minute globally

    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if user is rate limited
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @returns {boolean} True if user is rate limited
   */
  isUserRateLimited(userId, commandName = null) {
    const now = Date.now();
    const userKey = `user:${userId}`;
    const commandKey = commandName ? `command:${userId}:${commandName}` : null;

    // Check global user limit
    const userLimit = this.userLimits.get(userKey);
    if (
      userLimit &&
      this._isWithinLimit(userLimit, this.defaultUserLimit, now)
    ) {
      return true;
    }

    // Check command-specific limit
    if (commandKey) {
      const commandLimit = this.commandLimits.get(commandKey);
      if (
        commandLimit &&
        this._isWithinLimit(commandLimit, this.defaultCommandLimit, now)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if global rate limit is exceeded
   * @returns {boolean} True if global rate limit is exceeded
   */
  isGlobalRateLimited() {
    const now = Date.now();
    const globalKey = "global";
    const globalLimit = this.globalLimits.get(globalKey);

    return (
      globalLimit &&
      this._isWithinLimit(globalLimit, this.defaultGlobalLimit, now)
    );
  }

  /**
   * Record a command execution
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   */
  recordCommand(userId, commandName = null) {
    const now = Date.now();
    const userKey = `user:${userId}`;
    const commandKey = commandName ? `command:${userId}:${commandName}` : null;
    const globalKey = "global";

    // Record user limit
    this._recordLimit(this.userLimits, userKey, now);

    // Record command-specific limit
    if (commandKey) {
      this._recordLimit(this.commandLimits, commandKey, now);
    }

    // Record global limit
    this._recordLimit(this.globalLimits, globalKey, now);
  }

  /**
   * Get remaining time until rate limit resets
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @returns {number} Remaining time in milliseconds
   */
  getRemainingTime(userId, commandName = null) {
    const now = Date.now();
    const userKey = `user:${userId}`;
    const commandKey = commandName ? `command:${userId}:${commandName}` : null;

    let maxRemaining = 0;

    // Check user limit
    const userLimit = this.userLimits.get(userKey);
    if (userLimit) {
      const remaining = this._getRemainingTime(
        userLimit,
        this.defaultUserLimit,
        now,
      );
      maxRemaining = Math.max(maxRemaining, remaining);
    }

    // Check command-specific limit
    if (commandKey) {
      const commandLimit = this.commandLimits.get(commandKey);
      if (commandLimit) {
        const remaining = this._getRemainingTime(
          commandLimit,
          this.defaultCommandLimit,
          now,
        );
        maxRemaining = Math.max(maxRemaining, remaining);
      }
    }

    return maxRemaining;
  }

  /**
   * Handle Discord API rate limits
   * @param {Error} error - Discord API error
   * @param {Function} retryFunction - Function to retry
   * @param {Object} context - Context for logging
   * @returns {Promise} Promise that resolves when retry is complete
   */
  async handleDiscordRateLimit(error, retryFunction, context = {}) {
    if (error.code !== 40002) {
      throw error; // Not a rate limit error
    }

    const retryAfter = errorHandler.getRetryDelay(error);

    this.logger.warn("Discord API rate limit hit", {
      retryAfter: `${retryAfter}ms`,
      context,
    });

    // Wait for the specified time
    await new Promise(resolve => {
      setTimeout(resolve, retryAfter);
    });

    // Retry the function
    try {
      return await retryFunction();
    } catch (retryError) {
      if (retryError.code === 40002) {
        // Still rate limited, wait longer
        const longerDelay = retryError.retry_after * 1000;
        this.logger.warn("Still rate limited, waiting longer", {
          retryAfter: `${longerDelay}ms`,
          context,
        });
        await new Promise(resolve => {
          setTimeout(resolve, longerDelay);
        });
        return await retryFunction();
      }
      throw retryError;
    }
  }

  /**
   * Set custom rate limits
   * @param {Object} limits - Custom rate limit settings
   */
  setCustomLimits(limits) {
    if (limits.userLimit) {
      this.defaultUserLimit = limits.userLimit;
    }
    if (limits.commandLimit) {
      this.defaultCommandLimit = limits.commandLimit;
    }
    if (limits.globalLimit) {
      this.defaultGlobalLimit = limits.globalLimit;
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Object} Rate limit statistics
   */
  getStats() {
    const now = Date.now();
    const stats = {
      userLimits: this.userLimits.size,
      commandLimits: this.commandLimits.size,
      globalLimits: this.globalLimits.size,
      activeUsers: 0,
      activeCommands: 0,
    };

    // Count active limits
    for (const [, timestamps] of this.userLimits) {
      const active = timestamps.filter(time => now - time < 60000).length;
      if (active > 0) stats.activeUsers++;
    }

    for (const [, timestamps] of this.commandLimits) {
      const active = timestamps.filter(time => now - time < 60000).length;
      if (active > 0) stats.activeCommands++;
    }

    return stats;
  }

  /**
   * Clean up old rate limit entries
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - 60000; // 1 minute ago

    // Clean up user limits
    for (const [key, timestamps] of this.userLimits) {
      const filtered = timestamps.filter(time => time > cutoff);
      if (filtered.length === 0) {
        this.userLimits.delete(key);
      } else {
        this.userLimits.set(key, filtered);
      }
    }

    // Clean up command limits
    for (const [key, timestamps] of this.commandLimits) {
      const filtered = timestamps.filter(time => time > cutoff);
      if (filtered.length === 0) {
        this.commandLimits.delete(key);
      } else {
        this.commandLimits.set(key, filtered);
      }
    }

    // Clean up global limits
    for (const [key, timestamps] of this.globalLimits) {
      const filtered = timestamps.filter(time => time > cutoff);
      if (filtered.length === 0) {
        this.globalLimits.delete(key);
      } else {
        this.globalLimits.set(key, filtered);
      }
    }
  }

  /**
   * Check if timestamps are within rate limit
   * @param {Array} timestamps - Array of timestamps
   * @param {number} limit - Rate limit
   * @param {number} now - Current time
   * @returns {boolean} True if within limit
   * @private
   */
  _isWithinLimit(timestamps, limit, now) {
    const cutoff = now - 60000; // 1 minute ago
    const recent = timestamps.filter(time => time > cutoff);
    return recent.length >= limit;
  }

  /**
   * Get remaining time until rate limit resets
   * @param {Array} timestamps - Array of timestamps
   * @param {number} limit - Rate limit
   * @param {number} now - Current time
   * @returns {number} Remaining time in milliseconds
   * @private
   */
  _getRemainingTime(timestamps, limit, now) {
    const cutoff = now - 60000; // 1 minute ago
    const recent = timestamps.filter(time => time > cutoff);

    if (recent.length < limit) {
      return 0; // Not rate limited
    }

    // Find the oldest timestamp within the window
    const oldest = Math.min(...recent);
    return oldest + 60000 - now; // Time until window expires
  }

  /**
   * Record a timestamp for rate limiting
   * @param {Map} limitMap - Map to store timestamps
   * @param {string} key - Key for the map
   * @param {number} timestamp - Timestamp to record
   * @private
   */
  _recordLimit(limitMap, key, timestamp) {
    const existing = limitMap.get(key) || [];
    existing.push(timestamp);
    limitMap.set(key, existing);
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
export default rateLimiter;
