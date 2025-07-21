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
    this.config = {
      user: { limit: 5, windowMs: 60000 },
      command: { limit: 3, windowMs: 60000 },
      global: { limit: 100, windowMs: 60000 },
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

export function getRateLimitRemainingTime(userId, commandName) {
  const userRemaining = rateLimiter.get(`user:${userId}`).getRemainingTime();
  const commandRemaining = rateLimiter
    .get(`command:${userId}:${commandName}`)
    .getRemainingTime();
  const globalRemaining = rateLimiter.get("global:all").getRemainingTime();

  return Math.max(userRemaining, commandRemaining, globalRemaining);
}
