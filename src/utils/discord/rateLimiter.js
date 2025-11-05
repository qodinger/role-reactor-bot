import { getLogger } from "../logger.js";

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
      voice: {
        limit: 8, // Discord allows ~10 voice operations per 10 seconds per user
        windowMs: 10000, // 10 second window
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

export function isRateLimited(userId, commandName) {
  const userLimit = rateLimiter.get(`user:${userId}`);
  const commandLimit = rateLimiter.get(`command:${userId}:${commandName}`);
  const globalLimit = rateLimiter.get("global:all");

  if (
    userLimit.isExceeded() ||
    commandLimit.isExceeded() ||
    globalLimit.isExceeded()
  ) {
    return true;
  }

  userLimit.record();
  commandLimit.record();
  globalLimit.record();

  return false;
}

export function isInteractionRateLimited(userId) {
  const interactionLimit = rateLimiter.get(`interaction:${userId}`);
  const globalLimit = rateLimiter.get("global:all");

  if (interactionLimit.isExceeded() || globalLimit.isExceeded()) {
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

/**
 * Check if voice operation is rate limited
 * Discord allows ~10 voice operations per 10 seconds per user
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID (optional, for per-guild limits)
 * @returns {boolean} True if rate limited
 */
export function isVoiceOperationRateLimited(userId, guildId = null) {
  const voiceLimit = rateLimiter.get(`voice:${userId}`);
  const guildVoiceLimit = guildId
    ? rateLimiter.get(`voice:guild:${guildId}`)
    : null;

  if (voiceLimit.isExceeded()) {
    return true;
  }

  if (guildVoiceLimit && guildVoiceLimit.isExceeded()) {
    return true;
  }

  voiceLimit.record();
  if (guildVoiceLimit) {
    guildVoiceLimit.record();
  }

  return false;
}

/**
 * Get remaining time until voice operation rate limit resets
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID (optional)
 * @returns {number} Remaining time in milliseconds
 */
export function getVoiceOperationRemainingTime(userId, guildId = null) {
  const voiceRemaining = rateLimiter.get(`voice:${userId}`).getRemainingTime();
  const guildVoiceRemaining = guildId
    ? rateLimiter.get(`voice:guild:${guildId}`).getRemainingTime()
    : 0;

  return Math.max(voiceRemaining, guildVoiceRemaining);
}
