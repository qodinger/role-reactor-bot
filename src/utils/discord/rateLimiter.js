import { getLogger } from "../logger.js";
import {
  getCoreRateLimitMultiplier,
  getUserCorePriority,
} from "../../commands/general/core/utils.js";

class RateLimit {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  isExceeded() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(ts => ts > now - this.windowMs);
    return this.timestamps.length >= this.limit;
  }

  record() {
    this.timestamps.push(Date.now());
  }

  getRemainingTime() {
    if (!this.isExceeded()) {
      return 0;
    }
    const oldest = this.timestamps[0];
    return oldest + this.windowMs - Date.now();
  }

  /**
   * Check if exceeded with Core tier multiplier
   * @param {number} multiplier - Rate limit multiplier for Core members
   * @returns {boolean} True if exceeded
   */
  isExceededWithMultiplier(multiplier = 1.0) {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(ts => ts > now - this.windowMs);
    const effectiveLimit = Math.floor(this.limit * multiplier);
    return this.timestamps.length >= effectiveLimit;
  }
}

export class RateLimitManager {
  constructor(options = {}) {
    this.logger = getLogger();
    this.limits = new Map();

    // Environment-based rate limit configuration
    const isProduction = process.env.NODE_ENV === "production";

    this.config = {
      user: {
        limit: isProduction ? 10 : 5, // Higher limits for production
        windowMs: 60000,
      },
      command: {
        limit: isProduction ? 8 : 3, // Higher command limits for production
        windowMs: 60000,
      },
      global: {
        limit: isProduction ? 200 : 100, // Higher global limits for production
        windowMs: 60000,
      },
      // Add new rate limit types
      interaction: {
        limit: isProduction ? 15 : 10, // Interaction rate limits
        windowMs: 60000,
      },
      api: {
        limit: isProduction ? 50 : 25, // API call rate limits
        windowMs: 30000,
      },
      ...options,
    };

    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  get(key) {
    if (!this.limits.has(key)) {
      const [, type] = key.split(":");
      const config = this.config[type] || { limit: 5, windowMs: 60000 };
      this.limits.set(key, new RateLimit(config.limit, config.windowMs));
    }
    return this.limits.get(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, limit] of this.limits.entries()) {
      limit.timestamps = limit.timestamps.filter(
        ts => ts > now - limit.windowMs,
      );
      if (limit.timestamps.length === 0) {
        this.limits.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimitManager();

/**
 * Check if user is rate limited with Core member benefits
 * @param {string} userId - User ID
 * @param {string} commandName - Command name
 * @param {Object} coreUserData - Optional Core user data (for performance, avoids async lookup)
 * @returns {Promise<boolean>} True if rate limited
 */
export async function isRateLimited(userId, commandName, coreUserData = null) {
  // Get Core tier multiplier if not provided
  let multiplier = 1.0;
  if (coreUserData) {
    multiplier = getCoreRateLimitMultiplier(coreUserData.coreTier || null);
  } else {
    try {
      const userPriority = await getUserCorePriority(userId);
      if (userPriority.hasCore) {
        multiplier = getCoreRateLimitMultiplier(userPriority.tier);
      }
    } catch {
      // If lookup fails, use default multiplier (1.0)
    }
  }

  const userLimit = rateLimiter.get(`user:${userId}`);
  const commandLimit = rateLimiter.get(`command:${userId}:${commandName}`);
  const globalLimit = rateLimiter.get("global:all");

  if (
    userLimit.isExceededWithMultiplier(multiplier) ||
    commandLimit.isExceededWithMultiplier(multiplier) ||
    globalLimit.isExceeded()
  ) {
    return true;
  }

  userLimit.record();
  commandLimit.record();
  globalLimit.record();

  return false;
}

/**
 * Check if user is interaction rate limited with Core member benefits
 * @param {string} userId - User ID
 * @param {Object} coreUserData - Optional Core user data (for performance, avoids async lookup)
 * @returns {Promise<boolean>} True if rate limited
 */
export async function isInteractionRateLimited(userId, coreUserData = null) {
  // Get Core tier multiplier if not provided
  let multiplier = 1.0;
  if (coreUserData) {
    multiplier = getCoreRateLimitMultiplier(coreUserData.coreTier || null);
  } else {
    try {
      const userPriority = await getUserCorePriority(userId);
      if (userPriority.hasCore) {
        multiplier = getCoreRateLimitMultiplier(userPriority.tier);
      }
    } catch {
      // If lookup fails, use default multiplier (1.0)
    }
  }

  const interactionLimit = rateLimiter.get(`interaction:${userId}`);
  const globalLimit = rateLimiter.get("global:all");

  if (
    interactionLimit.isExceededWithMultiplier(multiplier) ||
    globalLimit.isExceeded()
  ) {
    return true;
  }

  interactionLimit.record();
  globalLimit.record();

  return false;
}

export function isApiRateLimited(endpoint) {
  const apiLimit = rateLimiter.get(`api:${endpoint}`);
  const globalLimit = rateLimiter.get("global:all");

  if (apiLimit.isExceeded() || globalLimit.isExceeded()) {
    return true;
  }

  apiLimit.record();
  globalLimit.record();

  return false;
}

export function getRateLimitRemainingTime(userId, commandName) {
  const userRemaining = rateLimiter.get(`user:${userId}`).getRemainingTime();
  const commandRemaining = rateLimiter
    .get(`command:${userId}:${commandName}`)
    .getRemainingTime();
  const globalRemaining = rateLimiter.get("global:all").getRemainingTime();

  return Math.max(userRemaining, commandRemaining, globalRemaining);
}
