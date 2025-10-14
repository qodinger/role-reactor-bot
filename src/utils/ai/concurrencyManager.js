import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Manages concurrent AI generation requests to prevent API overload
 */
export class ConcurrencyManager {
  constructor() {
    this.activeRequests = new Set();
    this.queue = [];
    // Increased limits for better scalability
    this.maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT) || 50;
    this.requestTimeout = parseInt(process.env.AI_REQUEST_TIMEOUT) || 120000; // 2 minutes
    this.retryAttempts = parseInt(process.env.AI_RETRY_ATTEMPTS) || 2;
    this.retryDelay = parseInt(process.env.AI_RETRY_DELAY) || 1000; // 1 second

    // User-specific rate limiting
    this.userRequests = new Map(); // userId -> { count, lastRequest, isCore, coreTier }
    this.userRateLimit = parseInt(process.env.AI_USER_RATE_LIMIT) || 5; // 5 requests per user
    this.userRateWindow = parseInt(process.env.AI_USER_RATE_WINDOW) || 300000; // 5 minutes

    // Core tier rate limiting benefits
    this.coreTierLimits = {
      "Core Basic": { multiplier: 1.5, priority: 1 }, // 7.5 requests per 5 minutes
      "Core Premium": { multiplier: 2.0, priority: 2 }, // 10 requests per 5 minutes
      "Core Elite": { multiplier: 3.0, priority: 3 }, // 15 requests per 5 minutes
    };

    // Queue management
    this.maxQueueSize = parseInt(process.env.AI_MAX_QUEUE_SIZE) || 1000;
    this.queueTimeout = parseInt(process.env.AI_QUEUE_TIMEOUT) || 600000; // 10 minutes
  }

  /**
   * Check if user has exceeded rate limit
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including Core tier info
   * @returns {boolean} True if rate limited
   */
  isUserRateLimited(userId, coreUserData = null) {
    if (!userId) return false;

    const now = Date.now();
    const userData = this.userRequests.get(userId);

    // Calculate effective rate limit based on Core tier
    let effectiveRateLimit = this.userRateLimit;
    if (coreUserData && coreUserData.isCore && coreUserData.coreTier) {
      const tierConfig = this.coreTierLimits[coreUserData.coreTier];
      if (tierConfig) {
        effectiveRateLimit = Math.floor(
          this.userRateLimit * tierConfig.multiplier,
        );
      }
    }

    if (!userData) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        isCore: coreUserData?.isCore || false,
        coreTier: coreUserData?.coreTier || null,
      });
      return false;
    }

    // Reset counter if window has passed
    if (now - userData.lastRequest > this.userRateWindow) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        isCore: coreUserData?.isCore || false,
        coreTier: coreUserData?.coreTier || null,
      });
      return false;
    }

    // Check if user has exceeded their effective limit
    if (userData.count >= effectiveRateLimit) {
      return true;
    }

    // Increment counter
    userData.count++;
    userData.lastRequest = now;
    this.userRequests.set(userId, userData);
    return false;
  }

  /**
   * Clean up old user rate limit data
   */
  cleanupUserRateLimits() {
    const now = Date.now();
    for (const [userId, userData] of this.userRequests.entries()) {
      if (now - userData.lastRequest > this.userRateWindow) {
        this.userRequests.delete(userId);
      }
    }
  }

  /**
   * Queue an AI generation request
   * @param {string} requestId - Unique request identifier
   * @param {Function} generationFunction - Function to execute
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Generation result
   */
  async queueRequest(requestId, generationFunction, options = {}) {
    return new Promise((resolve, reject) => {
      // Check user rate limiting
      const userId = options.userId;
      const coreUserData = options.coreUserData;
      if (userId && this.isUserRateLimited(userId, coreUserData)) {
        const effectiveRateLimit =
          coreUserData?.isCore && coreUserData?.coreTier
            ? Math.floor(
                this.userRateLimit *
                  (this.coreTierLimits[coreUserData.coreTier]?.multiplier || 1),
              )
            : this.userRateLimit;

        reject(
          new Error(
            `Rate limit exceeded. You can make ${effectiveRateLimit} requests per ${Math.ceil(this.userRateWindow / 60000)} minutes. Please wait before making another request.`,
          ),
        );
        return;
      }

      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error("Queue is full. Please try again later."));
        return;
      }

      const request = {
        id: requestId,
        function: generationFunction,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        attempts: 0,
        userId,
        priority:
          coreUserData?.isCore && coreUserData?.coreTier
            ? this.coreTierLimits[coreUserData.coreTier]?.priority || 0
            : 0,
      };

      this.queue.push(request);
      this.processQueue();

      // Set timeout for the request
      setTimeout(() => {
        if (this.activeRequests.has(requestId)) {
          this.activeRequests.delete(requestId);
          reject(new Error("AI generation request timed out"));
        }
      }, this.requestTimeout);

      // Set queue timeout
      setTimeout(() => {
        const queueIndex = this.queue.findIndex(r => r.id === requestId);
        if (queueIndex !== -1) {
          this.queue.splice(queueIndex, 1);
          reject(new Error("Request timed out in queue"));
        }
      }, this.queueTimeout);
    });
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    if (
      this.activeRequests.size >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    // Sort queue by priority (higher priority first), then by timestamp
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Earlier timestamp first
    });

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests.add(request.id);

    try {
      logger.debug(
        `Processing AI request ${request.id} (${this.activeRequests.size}/${this.maxConcurrent} active, ${this.queue.length} queued)`,
      );

      const result = await request.function(request.options);
      request.resolve(result);

      logger.debug(`Completed AI request ${request.id}`);
    } catch (error) {
      request.attempts++;

      if (request.attempts < this.retryAttempts && this.shouldRetry(error)) {
        logger.warn(
          `Retrying AI request ${request.id} (attempt ${request.attempts}/${this.retryAttempts})`,
        );

        // Add back to queue with delay
        setTimeout(() => {
          this.queue.unshift(request);
          this.processQueue();
        }, this.retryDelay * request.attempts);
      } else {
        logger.error(
          `Failed AI request ${request.id} after ${request.attempts} attempts:`,
          error,
        );
        request.reject(error);
      }
    } finally {
      this.activeRequests.delete(request.id);
      // Process next request in queue
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Check if an error should trigger a retry
   * @param {Error} error - Error to check
   * @returns {boolean} Should retry
   */
  shouldRetry(error) {
    const retryableErrors = [
      "Rate limit exceeded",
      "timeout",
      "network",
      "temporary",
      "service unavailable",
      "502",
      "503",
      "504",
    ];

    return retryableErrors.some(keyword =>
      error.message.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  /**
   * Get current queue status
   * @returns {Object} Queue statistics
   */
  getStatus() {
    return {
      active: this.activeRequests.size,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      oldestQueued:
        this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : 0,
    };
  }

  /**
   * Clear all queued requests
   */
  clearQueue() {
    this.queue.forEach(request => {
      request.reject(new Error("Queue cleared"));
    });
    this.queue = [];
    this.activeRequests.clear();
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getQueueStats() {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
      userRateLimit: this.userRateLimit,
      userRateWindow: this.userRateWindow,
    };
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    // Clean up user rate limits every 5 minutes
    setInterval(() => {
      this.cleanupUserRateLimits();
    }, 300000);

    // Log queue stats every minute
    setInterval(() => {
      const stats = this.getQueueStats();
      if (stats.queuedRequests > 0 || stats.activeRequests > 0) {
        logger.info(
          `Queue stats: ${stats.activeRequests} active, ${stats.queuedRequests} queued`,
        );
      }
    }, 60000);
  }
}

export const concurrencyManager = new ConcurrencyManager();
