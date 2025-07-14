import { Collection } from "discord.js";
import { getLogger } from "./logger.js";

class EventHandler {
  constructor() {
    this.logger = getLogger();
    this.rateLimitMap = new Collection();
    this.rateLimitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 10;
    this.eventStats = new Map();
  }

  // Rate limiting
  isRateLimited(userId, eventType) {
    const key = `${userId}:${eventType}`;
    const now = Date.now();
    const userRequests = this.rateLimitMap.get(key) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      time => now - time < this.rateLimitWindow,
    );

    if (validRequests.length >= this.maxRequestsPerWindow) {
      return true;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitMap.set(key, validRequests);

    return false;
  }

  // Event statistics
  recordEvent(eventType) {
    const stats = this.eventStats.get(eventType) || { count: 0, lastSeen: 0 };
    stats.count++;
    stats.lastSeen = Date.now();
    this.eventStats.set(eventType, stats);
  }

  getEventStats() {
    const stats = {};
    for (const [eventType, data] of this.eventStats) {
      stats[eventType] = {
        count: data.count,
        lastSeen: new Date(data.lastSeen).toISOString(),
      };
    }
    return stats;
  }

  // Optimized event processing
  async processEvent(eventType, handler, ...args) {
    try {
      // Record event for statistics
      this.recordEvent(eventType);

      // Check rate limiting for user events
      if (args[0]?.user?.id) {
        const userId = args[0].user.id;
        if (this.isRateLimited(userId, eventType)) {
          this.logger.logRateLimit(
            userId,
            eventType,
            this.getRateLimitInfo(userId, eventType),
          );
          return;
        }
      }

      // Execute handler with performance monitoring
      const startTime = Date.now();
      await handler(...args);
      const duration = Date.now() - startTime;

      // Log slow events
      if (duration > 1000) {
        this.logger.warn(`🐌 Slow event: ${eventType} took ${duration}ms`);
      }
    } catch (error) {
      this.logger.error(`❌ Error processing event ${eventType}`, error);

      // Don't throw - let the bot continue running
      // but log the error for debugging
    }
  }

  // Cleanup old rate limit entries
  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.rateLimitMap) {
      const validRequests = requests.filter(
        time => now - time < this.rateLimitWindow,
      );
      if (validRequests.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, validRequests);
      }
    }
  }

  // Get rate limit info
  getRateLimitInfo(userId, eventType) {
    const key = `${userId}:${eventType}`;
    const requests = this.rateLimitMap.get(key) || [];
    const now = Date.now();
    const validRequests = requests.filter(
      time => now - time < this.rateLimitWindow,
    );

    return {
      current: validRequests.length,
      limit: this.maxRequestsPerWindow,
      remaining: Math.max(0, this.maxRequestsPerWindow - validRequests.length),
      resetTime:
        validRequests.length > 0
          ? validRequests[0] + this.rateLimitWindow
          : now,
    };
  }
}

// Singleton instance
let eventHandler = null;

export function getEventHandler() {
  if (!eventHandler) {
    eventHandler = new EventHandler();

    // Cleanup old entries every 5 minutes
    setInterval(
      () => {
        eventHandler.cleanup();
      },
      5 * 60 * 1000,
    ).unref();
  }
  return eventHandler;
}

export { EventHandler };
