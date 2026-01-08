import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Manages concurrent AI generation requests to prevent API overload
 */
export class ConcurrencyManager {
  constructor() {
    this.activeRequests = new Set();
    this.queue = [];
    this.requestTimeouts = new Map();
    this.cleanupIntervals = [];
    this.statusMessages = new Map();

    // Concurrency limits based on provider type:
    // - Local ComfyUI (CPU/MacBook): 1-2 concurrent requests
    // - Local ComfyUI (GPU): 2-4 concurrent requests
    // - Cloud ComfyUI (RunPod/server): 2-4 per GPU
    // Concurrency limits optimized for cloud providers:
    // - RunPod Serverless: 10-15 concurrent (cost management)
    // - Stability AI: 20-30 concurrent (API limits)
    // - OpenRouter/ChatGPT: 30-50 concurrent (fast responses)
    // Default: 25 (balanced for production cloud deployment)
    this.maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT) || 25;
    this.requestTimeout = parseInt(process.env.AI_REQUEST_TIMEOUT) || 300000;
    this.retryAttempts = parseInt(process.env.AI_RETRY_ATTEMPTS) || 2;
    this.retryDelay = parseInt(process.env.AI_RETRY_DELAY) || 1000;

    this.userRequests = new Map();
    this.userRateLimit = parseInt(process.env.AI_USER_RATE_LIMIT) || 10;
    this.userRateWindow = parseInt(process.env.AI_USER_RATE_WINDOW) || 300000;

    this.coreTierLimits = {
      "Core Basic": { multiplier: 1.5, priority: 1 },
      "Core Premium": { multiplier: 2.0, priority: 2 },
      "Core Elite": { multiplier: 3.0, priority: 3 },
    };

    this.maxQueueSize = parseInt(process.env.AI_MAX_QUEUE_SIZE) || 1000;
    this.queueTimeout = parseInt(process.env.AI_QUEUE_TIMEOUT) || 600000;
  }

  /**
   * Atomically check and reserve rate limit (increments counter if not rate limited)
   * This prevents race conditions where multiple requests pass the check before any increment
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including Core tier info
   * @returns {Object} { rateLimited: boolean, effectiveRateLimit: number }
   */
  checkAndReserveRateLimit(userId, coreUserData = null) {
    if (!userId) {
      return { rateLimited: false, effectiveRateLimit: this.userRateLimit };
    }

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
      return { rateLimited: false, effectiveRateLimit };
    }

    if (now - userData.lastRequest > this.userRateWindow) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        isCore: coreUserData?.isCore || false,
        coreTier: coreUserData?.coreTier || null,
      });
      return { rateLimited: false, effectiveRateLimit };
    }

    if (userData.count >= effectiveRateLimit) {
      return { rateLimited: true, effectiveRateLimit };
    }

    userData.count++;
    userData.lastRequest = now;
    if (coreUserData) {
      userData.isCore = coreUserData.isCore || false;
      userData.coreTier = coreUserData.coreTier || null;
    }
    this.userRequests.set(userId, userData);
    return { rateLimited: false, effectiveRateLimit };
  }

  /**
   * Check if user has exceeded rate limit (increments counter if not rate limited)
   * @param {string} userId - User ID to check
   * @param {Object} coreUserData - User data including Core tier info
   * @returns {boolean} True if rate limited
   */
  isUserRateLimited(userId, coreUserData = null) {
    if (!userId) return false;

    const now = Date.now();
    const userData = this.userRequests.get(userId);

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

    if (now - userData.lastRequest > this.userRateWindow) {
      this.userRequests.set(userId, {
        count: 1,
        lastRequest: now,
        isCore: coreUserData?.isCore || false,
        coreTier: coreUserData?.coreTier || null,
      });
      return false;
    }

    if (userData.count >= effectiveRateLimit) {
      return true;
    }

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
   * Get queue position for a request
   * @param {string} requestId - Request ID to check
   * @returns {number|null} Queue position (0 = next to process, null if not in queue or already processing)
   */
  getQueuePosition(requestId) {
    if (this.activeRequests.has(requestId)) {
      return null;
    }

    const sortedQueue = [...this.queue].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    const queueIndex = sortedQueue.findIndex(r => r.id === requestId);
    if (queueIndex === -1) {
      return null;
    }

    return queueIndex;
  }

  /**
   * Get estimated wait time based on queue position and average processing time
   * @param {number} queuePosition - Position in queue (0-based, null if processing)
   * @returns {number} Estimated wait time in seconds
   */
  getEstimatedWaitTime(queuePosition) {
    if (queuePosition === null) {
      return 0;
    }

    const avgProcessingTime = 20;
    const queueWaitTime = queuePosition * avgProcessingTime;
    const activeRequestsRemainingTime = Math.ceil(
      (this.activeRequests.size / this.maxConcurrent) * (avgProcessingTime / 2),
    );

    return Math.max(0, queueWaitTime + activeRequestsRemainingTime);
  }

  /**
   * Cancel a queued request
   * @param {string} requestId - Request ID to cancel
   * @param {string} userId - User ID who owns the request (for verification)
   * @returns {boolean} True if request was cancelled, false if not found or already processing
   */
  cancelRequest(requestId, userId) {
    if (this.activeRequests.has(requestId)) {
      logger.debug(`Cannot cancel request ${requestId}: already processing`);
      return false;
    }

    const queueIndex = this.queue.findIndex(
      r => r.id === requestId && r.userId === userId,
    );

    if (queueIndex === -1) {
      logger.debug(
        `Cannot cancel request ${requestId}: not found in queue or user mismatch`,
      );
      return false;
    }

    const request = this.queue.splice(queueIndex, 1)[0];
    const timeouts = this.requestTimeouts.get(requestId);
    if (timeouts) {
      clearTimeout(timeouts.requestTimeout);
      clearTimeout(timeouts.queueTimeout);
      if (timeouts.queueUpdateInterval) {
        clearInterval(timeouts.queueUpdateInterval);
      }
      this.requestTimeouts.delete(requestId);
    }

    try {
      request.reject(new Error("Request cancelled by user"));
    } catch (_err) {
      logger.debug(
        `Request ${requestId} cancel handler: promise already settled`,
      );
    }

    logger.info(`Request ${requestId} cancelled by user ${userId}`);

    for (const [messageId, status] of this.statusMessages.entries()) {
      if (status.requestId === requestId) {
        this.statusMessages.delete(messageId);
      }
    }

    return true;
  }

  /**
   * Register a status message for a request (so we can cancel if message is deleted)
   * @param {string} messageId - Discord message ID
   * @param {string} requestId - Request ID
   * @param {string} userId - User ID
   */
  registerStatusMessage(messageId, requestId, userId) {
    this.statusMessages.set(messageId, { requestId, userId });
  }

  /**
   * Unregister a status message (when request completes or is cancelled)
   * @param {string} messageId - Discord message ID
   */
  unregisterStatusMessage(messageId) {
    this.statusMessages.delete(messageId);
  }

  /**
   * Cancel request if status message was deleted
   * @param {string} messageId - Discord message ID
   * @returns {boolean} True if request was cancelled, false if not found
   */
  cancelRequestByMessageId(messageId) {
    const status = this.statusMessages.get(messageId);
    if (!status) {
      return false;
    }

    const cancelled = this.cancelRequest(status.requestId, status.userId);
    this.statusMessages.delete(messageId);

    return cancelled;
  }

  /**
   * Handle AI queue cancel button interaction
   * @deprecated Cancel buttons have been removed. Users can cancel by deleting the status message.
   * Kept for backward compatibility with old messages that may still have cancel buttons.
   * This method is not actively used but kept until 2026-03-01 to handle legacy button interactions
   * from messages sent before the cancel button removal.
   * TODO: Remove this method after 2026-03-01 when all old messages with cancel buttons have expired.
   * @param {import('discord.js').ButtonInteraction} interaction - Button interaction
   */
  static async handleAIQueueCancel(interaction) {
    await interaction.deferUpdate();

    const { customId, user, message } = interaction;
    const logger = getLogger();

    const requestId = customId.replace("ai_queue_cancel_", "");

    if (!requestId) {
      await interaction.followUp({
        content: "❌ Invalid cancel request.",
        ephemeral: true,
      });
      return;
    }

    const { concurrencyManager } = await import("./concurrencyManager.js");
    const cancelled = concurrencyManager.cancelRequest(requestId, user.id);

    if (cancelled) {
      try {
        await message.delete();
      } catch (error) {
        logger.debug("Failed to delete message after cancellation:", error);
        try {
          const { EmbedBuilder } = await import("discord.js");
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription("❌ Request cancelled")
                .setFooter({
                  text: `Cancelled by ${user.tag} • Role Reactor`,
                })
                .setTimestamp(),
            ],
            components: [],
          });
        } catch (editError) {
          logger.debug("Failed to edit message after cancellation:", editError);
        }
      }

      await interaction.followUp({
        content: "✅ Your request has been cancelled.",
        ephemeral: true,
      });
    } else {
      await interaction.followUp({
        content:
          "❌ Cannot cancel this request. It may have already started processing or doesn't exist.",
        ephemeral: true,
      });
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
      const userId = options.userId;
      const coreUserData = options.coreUserData;
      const rateLimitReserved = options.rateLimitReserved || false;
      const onQueueStatus = options.onQueueStatus;

      if (userId && !rateLimitReserved) {
        if (this.isUserRateLimited(userId, coreUserData)) {
          const userData = this.userRequests.get(userId);
          let effectiveRateLimit = this.userRateLimit;
          if (userData && userData.isCore && userData.coreTier) {
            const tierConfig = this.coreTierLimits[userData.coreTier];
            if (tierConfig) {
              effectiveRateLimit = Math.floor(
                this.userRateLimit * tierConfig.multiplier,
              );
            }
          }

          reject(
            new Error(
              `Rate limit exceeded. You can make ${effectiveRateLimit} requests per ${Math.ceil(this.userRateWindow / 60000)} minutes. Please wait before making another request.`,
            ),
          );
          return;
        }
      }

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

      if (onQueueStatus) {
        setTimeout(() => {
          const position = this.getQueuePosition(requestId);
          if (position !== null) {
            const waitTime = this.getEstimatedWaitTime(position);
            const totalInSystem = this.queue.length + this.activeRequests.size;
            onQueueStatus(position, totalInSystem, waitTime);
          } else {
            onQueueStatus(null, this.activeRequests.size, 0);
          }
        }, 100);
      }

      let queueUpdateInterval = null;
      if (onQueueStatus) {
        queueUpdateInterval = setInterval(() => {
          const position = this.getQueuePosition(requestId);
          if (position !== null) {
            const waitTime = this.getEstimatedWaitTime(position);
            const totalInSystem = this.queue.length + this.activeRequests.size;
            onQueueStatus(position, totalInSystem, waitTime);
          } else {
            if (queueUpdateInterval) {
              clearInterval(queueUpdateInterval);
            }
          }
        }, 5000);
      }

      this.processQueue();

      const requestTimeout = options.timeout || this.requestTimeout;

      const requestTimeoutId = setTimeout(() => {
        if (this.activeRequests.has(requestId)) {
          this.activeRequests.delete(requestId);
          this.requestTimeouts.delete(requestId);
          try {
            reject(new Error("AI generation request timed out"));
          } catch (_err) {
            logger.debug(
              `Request ${requestId} timeout handler: promise already settled`,
            );
          }
        }
      }, requestTimeout);

      const queueTimeoutId = setTimeout(() => {
        const queueIndex = this.queue.findIndex(r => r.id === requestId);
        if (queueIndex !== -1) {
          this.queue.splice(queueIndex, 1);
          const timeouts = this.requestTimeouts.get(requestId);
          if (timeouts && timeouts.queueUpdateInterval) {
            clearInterval(timeouts.queueUpdateInterval);
          }
          this.requestTimeouts.delete(requestId);
          try {
            reject(new Error("Request timed out in queue"));
          } catch (_err) {
            logger.debug(
              `Request ${requestId} queue timeout handler: promise already settled`,
            );
          }
        }
      }, this.queueTimeout);

      this.requestTimeouts.set(requestId, {
        requestTimeout: requestTimeoutId,
        queueTimeout: queueTimeoutId,
        queueUpdateInterval: queueUpdateInterval || null,
      });
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

    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests.add(request.id);

    try {
      logger.debug(
        `Processing AI request ${request.id} (${this.activeRequests.size}/${this.maxConcurrent} active, ${this.queue.length} queued)`,
      );

      const timeouts = this.requestTimeouts.get(request.id);
      if (timeouts) {
        clearTimeout(timeouts.requestTimeout);
        clearTimeout(timeouts.queueTimeout);
        if (timeouts.queueUpdateInterval) {
          clearInterval(timeouts.queueUpdateInterval);
        }
        this.requestTimeouts.delete(request.id);
      }

      if (request.options?.onQueueStatus) {
        const totalInSystem = this.queue.length + this.activeRequests.size;
        request.options.onQueueStatus(null, totalInSystem, 0);
      }

      const result = await request.function(request.options);
      request.resolve(result);

      logger.debug(`Completed AI request ${request.id}`);
    } catch (error) {
      request.attempts++;

      if (request.attempts < this.retryAttempts && this.shouldRetry(error)) {
        logger.warn(
          `Retrying AI request ${request.id} (attempt ${request.attempts}/${this.retryAttempts})`,
        );

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
    const cleanupInterval = setInterval(() => {
      this.cleanupUserRateLimits();
    }, 300000);
    this.cleanupIntervals.push(cleanupInterval);

    const statsInterval = setInterval(() => {
      const stats = this.getQueueStats();
      if (stats.queuedRequests > 0 || stats.activeRequests > 0) {
        logger.info(
          `Queue stats: ${stats.activeRequests} active, ${stats.queuedRequests} queued`,
        );
      }
    }, 60000);
    this.cleanupIntervals.push(statsInterval);
  }

  /**
   * Stop all cleanup intervals (for testing or graceful shutdown)
   */
  stopCleanup() {
    for (const interval of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals = [];
  }
}

export const concurrencyManager = new ConcurrencyManager();
