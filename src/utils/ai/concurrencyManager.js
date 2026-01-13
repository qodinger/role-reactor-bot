import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * AI Concurrency Manager - Simplified Version
 * Manages rate limiting and request queuing for AI operations
 * Simplified to work with Core package system (no subscription tiers)
 */
export class AIConcurrencyManager {
  constructor() {
    // Global rate limiting
    this.globalRateLimit = parseInt(process.env.AI_GLOBAL_RATE_LIMIT) || 50;
    this.globalRateWindow = parseInt(process.env.AI_GLOBAL_RATE_WINDOW) || 60000;
    this.globalRequests = [];

    // User rate limiting
    this.userRequests = new Map();
    this.userRateLimit = parseInt(process.env.AI_USER_RATE_LIMIT) || 10;
    this.userRateWindow = parseInt(process.env.AI_USER_RATE_WINDOW) || 300000;

    // Simplified rate limiting - users with credits get slight priority
    this.creditUserMultiplier = 1.2; // 20% higher rate limit for users with credits

    this.maxQueueSize = parseInt(process.env.AI_MAX_QUEUE_SIZE) || 1000;
    this.queueTimeout = parseInt(process.env.AI_QUEUE_TIMEOUT) || 600000;
  }

  /**
   * Atomically check and reserve rate limit (increments counter if not rate limited)
   * This prevents race conditions where multiple requests pass the check before any increment
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including credit info
   * @returns {Object} { rateLimited: boolean, effectiveRateLimit: number }
   */
  checkAndReserveRateLimit(userId, coreUserData = null) {
    if (!userId) {
      return { rateLimited: false, effectiveRateLimit: this.userRateLimit };
    }

    const now = Date.now();
    const userData = this.userRequests.get(userId);

    // Calculate effective rate limit based on credit balance
    let effectiveRateLimit = this.userRateLimit;
    if (coreUserData && coreUserData.hasCredits) {
      effectiveRateLimit = Math.floor(this.userRateLimit * this.creditUserMultiplier);
    }

    if (!userData) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        hasCredits: coreUserData?.hasCredits || false,
        credits: coreUserData?.credits || 0,
      });
      return { rateLimited: false, effectiveRateLimit };
    }

    if (now - userData.lastRequest > this.userRateWindow) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        hasCredits: coreUserData?.hasCredits || false,
        credits: coreUserData?.credits || 0,
      });
      return { rateLimited: false, effectiveRateLimit };
    }

    if (userData.count >= effectiveRateLimit) {
      return { rateLimited: true, effectiveRateLimit };
    }

    userData.count++;
    userData.lastRequest = now;
    if (coreUserData) {
      userData.hasCredits = coreUserData.hasCredits || false;
      userData.credits = coreUserData.credits || 0;
    }
    this.userRequests.set(userId, userData);
    return { rateLimited: false, effectiveRateLimit };
  }

  /**
   * Check if user has exceeded rate limit (increments counter if not rate limited)
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including credit info
   * @returns {boolean} True if rate limited
   */
  isUserRateLimited(userId, coreUserData = null) {
    if (!userId) return false;

    const now = Date.now();
    const userData = this.userRequests.get(userId);

    let effectiveRateLimit = this.userRateLimit;
    if (coreUserData && coreUserData.hasCredits) {
      effectiveRateLimit = Math.floor(this.userRateLimit * this.creditUserMultiplier);
    }

    if (!userData) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        hasCredits: coreUserData?.hasCredits || false,
        credits: coreUserData?.credits || 0,
      });
      return false;
    }

    if (now - userData.lastRequest > this.userRateWindow) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        hasCredits: coreUserData?.hasCredits || false,
        credits: coreUserData?.credits || 0,
      });
      return false;
    }

    if (userData.count >= effectiveRateLimit) {
      return true;
    }

    userData.count++;
    userData.lastRequest = now;
    if (coreUserData) {
      userData.hasCredits = coreUserData.hasCredits || false;
      userData.credits = coreUserData.credits || 0;
    }
    this.userRequests.set(userId, userData);
    return false;
  }

  /**
   * Check global rate limit
   * @returns {boolean} True if globally rate limited
   */
  isGloballyRateLimited() {
    const now = Date.now();
    this.globalRequests = this.globalRequests.filter(
      timestamp => now - timestamp < this.globalRateWindow,
    );

    if (this.globalRequests.length >= this.globalRateLimit) {
      return true;
    }

    this.globalRequests.push(now);
    return false;
  }

  /**
   * Get current rate limit status for a user
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including credit info
   * @returns {Object} Rate limit status
   */
  getRateLimitStatus(userId, coreUserData = null) {
    if (!userId) {
      return {
        rateLimited: false,
        remaining: this.userRateLimit,
        resetTime: null,
        effectiveLimit: this.userRateLimit,
      };
    }

    const now = Date.now();
    const userData = this.userRequests.get(userId);

    let effectiveRateLimit = this.userRateLimit;
    if (coreUserData && coreUserData.hasCredits) {
      effectiveRateLimit = Math.floor(this.userRateLimit * this.creditUserMultiplier);
    }

    if (!userData) {
      return {
        rateLimited: false,
        remaining: effectiveRateLimit,
        resetTime: null,
        effectiveLimit: effectiveRateLimit,
      };
    }

    if (now - userData.lastRequest > this.userRateWindow) {
      return {
        rateLimited: false,
        remaining: effectiveRateLimit,
        resetTime: null,
        effectiveLimit: effectiveRateLimit,
      };
    }

    const remaining = Math.max(0, effectiveRateLimit - userData.count);
    const resetTime = new Date(userData.lastRequest + this.userRateWindow);

    return {
      rateLimited: userData.count >= effectiveRateLimit,
      remaining,
      resetTime,
      effectiveLimit: effectiveRateLimit,
    };
  }

  /**
   * Clear rate limit data for a user (admin function)
   * @param {string} userId - User ID to clear
   */
  clearUserRateLimit(userId) {
    if (userId) {
      this.userRequests.delete(userId);
      logger.info(`Cleared rate limit data for user ${userId}`);
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const now = Date.now();
    const activeUsers = Array.from(this.userRequests.entries()).filter(
      ([, userData]) => now - userData.lastRequest < this.userRateWindow,
    );

    const creditUsers = activeUsers.filter(([, userData]) => userData.hasCredits);

    return {
      activeUsers: activeUsers.length,
      creditUsers: creditUsers.length,
      globalRequests: this.globalRequests.length,
      totalTrackedUsers: this.userRequests.size,
    };
  }

  /**
   * Add request to priority queue
   * @param {Object} request - Request object
   * @param {Object} coreUserData - User data including credit info
   * @returns {Object} Queue entry
   */
  addToQueue(request, coreUserData = null) {
    const queueEntry = {
      ...request,
      timestamp: Date.now(),
      userId: request.userId,
      priority: coreUserData?.hasCredits ? 1 : 0, // Simple priority: has credits or not
    };

    return queueEntry;
  }

  /**
   * Clean up old rate limit data
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.userRateWindow;

    for (const [userId, userData] of this.userRequests.entries()) {
      if (userData.lastRequest < cutoff) {
        this.userRequests.delete(userId);
      }
    }

    // Clean up global requests
    this.globalRequests = this.globalRequests.filter(
      timestamp => now - timestamp < this.globalRateWindow,
    );

    logger.debug(`Cleaned up rate limit data. Active users: ${this.userRequests.size}`);
  }
}

// Export singleton instance
export const aiConcurrencyManager = new AIConcurrencyManager();

// Clean up every 5 minutes
setInterval(() => {
  aiConcurrencyManager.cleanup();
}, 300000);

export default aiConcurrencyManager;