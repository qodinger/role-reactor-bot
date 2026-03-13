import { Collection } from "discord.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Command Rate Limiter - Prevents command abuse and spam
 * Tracks command usage per user and guild with configurable limits
 */
class CommandRateLimiter {
  constructor() {
    // User-based cooldowns: Map<userId, Map<commandName, timestamp>>
    this.userCooldowns = new Collection();

    // Guild-based cooldowns: Map<guildId, Map<commandName, timestamp>>
    this.guildCooldowns = new Collection();

    // Command usage tracking: Map<userId, number>
    this.userCommandCount = new Collection();

    // Rate limit configurations
    this.limits = {
      // Global rate limits
      global: {
        commands: 10, // commands per window
        windowMs: 10000, // 10 seconds
      },
      // Per-command rate limits
      commands: {
        // AI commands - stricter limits due to cost
        avatar: { commands: 2, windowMs: 60000 }, // 2 per minute
        imagine: { commands: 2, windowMs: 60000 }, // 2 per minute
        ask: { commands: 5, windowMs: 60000 }, // 5 per minute

        // Moderation commands
        moderation: { commands: 5, windowMs: 30000 }, // 5 per 30 seconds

        // Role management
        "temp-roles": { commands: 3, windowMs: 30000 }, // 3 per 30 seconds
        "schedule-role": { commands: 3, windowMs: 30000 },

        // General commands - more lenient
        default: { commands: 5, windowMs: 10000 }, // 5 per 10 seconds
      },
      // Bot-wide spam protection
      spam: {
        maxCommands: 20, // max commands in short window
        windowMs: 5000, // 5 seconds
        banDuration: 60000, // 1 minute ban if exceeded
      },
    };

    // Users temporarily banned for spam
    this.bannedUsers = new Collection();

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if a user can execute a command
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {string} guildId - Guild ID
   * @returns {Promise<{allowed: boolean, reason?: string, retryAfter?: number}>}
   */
  async checkLimit(userId, commandName, guildId) {
    const now = Date.now();

    // Check if user is banned for spam FIRST
    if (this.bannedUsers.has(userId)) {
      const banData = this.bannedUsers.get(userId);
      if (now < banData.expiresAt) {
        return {
          allowed: false,
          reason: "spam_ban",
          retryAfter: banData.expiresAt - now,
        };
      }
      // Ban expired, remove it
      this.bannedUsers.delete(userId);
    }

    // Check for spam BEFORE global limit
    await this.checkSpam(userId);

    // If user was just banned for spam, return immediately
    if (this.bannedUsers.has(userId)) {
      const banData = this.bannedUsers.get(userId);
      return {
        allowed: false,
        reason: "spam_ban",
        retryAfter: banData.expiresAt - now,
      };
    }

    // Get recent commands within global window
    const globalLimit = this.limits.global;
    const userCommands = this.userCommandCount.get(userId) || [];
    const recentCommands = userCommands.filter(
      timestamp => now - timestamp < globalLimit.windowMs,
    );

    // Check global rate limit
    if (recentCommands.length >= globalLimit.commands) {
      const oldestCommand = Math.min(...recentCommands);
      const retryAfter = oldestCommand - now + globalLimit.windowMs;
      return {
        allowed: false,
        reason: "global_limit",
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // Check command-specific limit
    const commandLimit =
      this.limits.commands[commandName] || this.limits.commands.default;
    const cooldownKey = `${userId}-${commandName}`;
    const lastUse = this.userCooldowns.get(cooldownKey);

    if (lastUse && Date.now() - lastUse < commandLimit.windowMs) {
      const retryAfter = commandLimit.windowMs - (Date.now() - lastUse);
      return {
        allowed: false,
        reason: "command_cooldown",
        retryAfter,
      };
    }

    // Check guild limit (prevent guild-wide spam)
    const guildLimit = this.limits.commands.default;
    const guildCooldownKey = `${guildId}-${commandName}`;
    const guildLastUse = this.guildCooldowns.get(guildCooldownKey);

    if (guildLastUse && Date.now() - guildLastUse < guildLimit.windowMs / 2) {
      const retryAfter = guildLimit.windowMs / 2 - (Date.now() - guildLastUse);
      return {
        allowed: false,
        reason: "guild_cooldown",
        retryAfter,
      };
    }

    return { allowed: true };
  }

  /**
   * Record command usage
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {string} guildId - Guild ID
   */
  async recordUsage(userId, commandName, guildId) {
    const now = Date.now();
    const globalLimit = this.limits.global;

    // Record user-command cooldown
    const cooldownKey = `${userId}-${commandName}`;
    this.userCooldowns.set(cooldownKey, now);

    // Record guild-command cooldown
    const guildCooldownKey = `${guildId}-${commandName}`;
    this.guildCooldowns.set(guildCooldownKey, now);

    // Track command count for global limit (filter to recent commands)
    const userCommands = this.userCommandCount.get(userId) || [];
    const recentCommands = userCommands.filter(
      timestamp => now - timestamp < globalLimit.windowMs,
    );
    recentCommands.push(now);
    this.userCommandCount.set(userId, recentCommands);

    // Check for spam
    await this.checkSpam(userId);

    logger.debug(`Rate limit: ${userId} used ${commandName}`);
  }

  /**
   * Check if user is spamming
   * @param {string} userId - User ID
   */
  async checkSpam(userId) {
    const spamLimit = this.limits.spam;
    const userCommands = this.userCommandCount.get(userId) || [];

    // Filter to recent commands
    const recentCommands = userCommands.filter(
      timestamp => Date.now() - timestamp < spamLimit.windowMs,
    );

    this.userCommandCount.set(userId, recentCommands);

    if (recentCommands.length > spamLimit.maxCommands) {
      // User is spamming, add temporary ban
      this.bannedUsers.set(userId, {
        expiresAt: Date.now() + spamLimit.banDuration,
        count: recentCommands.length,
      });

      logger.warn(
        `🚫 User ${userId} banned for spam (${recentCommands.length} commands in ${spamLimit.windowMs}ms)`,
      );
    }
  }

  /**
   * Get the oldest command timestamp for a user
   * @param {string} userId - User ID
   * @returns {number|null}
   */
  getOldestCommand(userId) {
    const userCommands = this.userCommandCount.get(userId) || [];
    if (userCommands.length === 0) return null;
    return Math.min(...userCommands);
  }

  /**
   * Start cleanup interval to remove old entries
   */
  startCleanup() {
    // Cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    logger.debug("Rate limiter cleanup started");
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = Math.max(
      this.limits.global.windowMs,
      ...Object.values(this.limits.commands).map(l => l.windowMs),
    );

    // Cleanup user cooldowns
    for (const [key, timestamp] of this.userCooldowns) {
      if (now - timestamp > maxAge) {
        this.userCooldowns.delete(key);
      }
    }

    // Cleanup guild cooldowns
    for (const [key, timestamp] of this.guildCooldowns) {
      if (now - timestamp > maxAge) {
        this.guildCooldowns.delete(key);
      }
    }

    // Cleanup command counts
    for (const [userId, commands] of this.userCommandCount) {
      const recentCommands = commands.filter(
        timestamp => now - timestamp < maxAge,
      );
      if (recentCommands.length === 0) {
        this.userCommandCount.delete(userId);
      } else {
        this.userCommandCount.set(userId, recentCommands);
      }
    }

    // Cleanup expired bans
    for (const [userId, banData] of this.bannedUsers) {
      if (now > banData.expiresAt) {
        this.bannedUsers.delete(userId);
      }
    }
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Object}
   */
  getStats() {
    return {
      userCooldowns: this.userCooldowns.size,
      guildCooldowns: this.guildCooldowns.size,
      trackedUsers: this.userCommandCount.size,
      bannedUsers: this.bannedUsers.size,
    };
  }
}

// Singleton instance
let rateLimiter = null;

/**
 * Get the command rate limiter instance
 * @returns {CommandRateLimiter}
 */
export function getCommandRateLimiter() {
  if (!rateLimiter) {
    rateLimiter = new CommandRateLimiter();
  }
  return rateLimiter;
}

export default getCommandRateLimiter;
