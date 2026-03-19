import { getLogger } from "../logger.js";
import {
  DEFAULT_USER_RATE_LIMIT,
  DEFAULT_USER_RATE_WINDOW,
} from "./constants.js";

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
    this.globalRateWindow =
      parseInt(process.env.AI_GLOBAL_RATE_WINDOW) || 60000;
    this.globalRequests = [];

    // User rate limiting
    this.userRequests = new Map();
    this.userRateLimit =
      parseInt(process.env.AI_USER_RATE_LIMIT) || DEFAULT_USER_RATE_LIMIT;
    this.userRateWindow =
      parseInt(process.env.AI_USER_RATE_WINDOW) || DEFAULT_USER_RATE_WINDOW;

    // Simplified rate limiting - users with credits get slight priority
    this.creditUserMultiplier = 1.2; // 20% higher rate limit for users with credits

    this.maxQueueSize = parseInt(process.env.AI_MAX_QUEUE_SIZE) || 1000;
    this.queueTimeout = parseInt(process.env.AI_QUEUE_TIMEOUT) || 600000;

    // Status message tracking for cancellation
    // Map<messageId, { requestId, userId, timestamp }>
    this.statusMessages = new Map();
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
      effectiveRateLimit = Math.floor(
        this.userRateLimit * this.creditUserMultiplier,
      );
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
      effectiveRateLimit = Math.floor(
        this.userRateLimit * this.creditUserMultiplier,
      );
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
      effectiveRateLimit = Math.floor(
        this.userRateLimit * this.creditUserMultiplier,
      );
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
   * Decrement rate limit counter (used when a request fails before completion)
   * @param {string} userId - User ID to decrement
   */
  decrementRateLimit(userId) {
    if (!userId) return;
    const userData = this.userRequests.get(userId);
    if (userData && userData.count > 0) {
      userData.count--;
      this.userRequests.set(userId, userData);
      logger.debug(`Decremented rate limit for user ${userId} due to failure`);
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

    const creditUsers = activeUsers.filter(
      ([, userData]) => userData.hasCredits,
    );

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

    logger.debug(
      `Cleaned up rate limit data. Active users: ${this.userRequests.size}`,
    );
  }

  /**
   * Register a status message for a request
   * Allows users to cancel requests by deleting the status message
   * @param {string} messageId - Discord message ID
   * @param {string} requestId - AI request ID
   * @param {string} userId - User ID
   */
  registerStatusMessage(messageId, requestId, userId) {
    if (!messageId || !requestId) return;

    this.statusMessages.set(messageId, {
      requestId,
      userId,
      timestamp: Date.now(),
    });

    // Cleanup old status messages (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 600000;
    if (this.statusMessages.size > 100) {
      for (const [id, data] of this.statusMessages.entries()) {
        if (data.timestamp < tenMinutesAgo) {
          this.statusMessages.delete(id);
        }
      }
    }
  }

  /**
   * Unregister a status message (request completed)
   * @param {string} messageId - Discord message ID
   */
  unregisterStatusMessage(messageId) {
    if (!messageId) return;
    this.statusMessages.delete(messageId);
  }

  /**
   * Cancel a request by its status message ID
   * @param {string} messageId - Discord message ID
   * @returns {boolean} True if a request was found and cancelled
   */
  cancelRequestByMessageId(messageId) {
    if (!messageId) return false;

    const data = this.statusMessages.get(messageId);
    if (!data) return false;

    const { requestId, userId } = data;
    this.statusMessages.delete(messageId);

    // In this simplified version, we just decrement the rate limit
    // so the user can try again, and log the cancellation.
    // Real cancellation would require AbortController support in chatService.
    if (userId) {
      this.decrementRateLimit(userId);
    }

    logger.info(
      `AI request ${requestId} cancelled for user ${userId} via message deletion`,
    );
    return true;
  }
  /**
   * Queue a request for execution
   * Compatible implementation for ChatService that executes immediately after checks
   * @param {string} requestId - Request ID
   * @param {Function} task - Async task to execute
   * @param {Object} options - Options
   * @returns {Promise<any>} Task result
   */
  async queueRequest(requestId, task, options = {}) {
    const { userId, coreUserData, rateLimitReserved } = options;

    // Check rate limits (skip if already checked and reserved by caller)
    if (!rateLimitReserved) {
      if (this.isGloballyRateLimited()) {
        throw new Error(
          "System is currently under high load. Please try again later.",
        );
      }

      if (this.isUserRateLimited(userId, coreUserData)) {
        const status = this.getRateLimitStatus(userId, coreUserData);
        const minutes = Math.ceil((status.resetTime - Date.now()) / 60000);
        throw new Error(
          `Rate limit exceeded. Please try again in ${minutes} minutes.`,
        );
      }

      // Reserve rate limit count
      this.checkAndReserveRateLimit(userId, coreUserData);
    }

    // Execute immediately (Queue logic removed in simplified version)
    if (options.onQueueStatus) {
      options.onQueueStatus("processing", 1, 0);
    }
    return await task();
  }
}

// Export singleton instance
export const aiConcurrencyManager = new AIConcurrencyManager();
export const concurrencyManager = aiConcurrencyManager; // Alias for backward compatibility

// Clean up every 5 minutes
setInterval(() => {
  aiConcurrencyManager.cleanup();
}, 300000);

export default aiConcurrencyManager;
