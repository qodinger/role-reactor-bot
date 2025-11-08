import { getLogger } from "../logger.js";
import { delay } from "../delay.js";
import { enforceVoiceRestrictions } from "./voiceRestrictions.js";
import {
  wouldVoiceOperationBeRateLimited,
  getVoiceOperationRemainingTime,
} from "./rateLimiter.js";
import { getUserCorePriority } from "../../commands/general/core/utils.js";

const logger = getLogger();

/**
 * Global voice operation queue manager
 * Handles voice operations across all guilds with prioritization and rate limiting
 */
class VoiceOperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 25; // Increased for high concurrency (many servers/members)
    this.activeOperations = new Set();
    this.pendingOperations = new Set(); // Track pending operations to prevent duplicates
    this.pendingOperationTimestamps = new Map(); // Track when operations were added for cleanup
    this.batchSize = 20; // Increased batch size for faster processing
    this.batchDelay = 25; // Reduced delay for faster response
    this.maxQueueSize = 10000; // Prevent memory issues
    this.baseOperationTimeout = 30000; // Base timeout: 30 seconds for normal operations
    this.maxOperationTimeout = 300000; // Max timeout: 5 minutes for rate-limited operations
    this.cleanupInterval = 60000; // Clean up stale entries every minute
    this.queueCheckDelay = 50; // Reduced delay when waiting for queue capacity

    // Start processing queue
    this.startProcessing();
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Add voice operation to queue
   * @param {Object} operation - Operation data
   * @param {import('discord.js').GuildMember} operation.member - Member to process
   * @param {import('discord.js').Role} [operation.role] - Role related to operation (optional)
   * @param {string} operation.reason - Reason for operation
   * @param {string} [operation.type] - Operation type: 'enforce' (default), 'mute', 'unmute', 'disconnect'
   * @param {boolean} [operation.forceMute] - Force mute (for restrictive roles)
   * @param {number} [operation.priority] - Priority (higher = first, Core members get higher priority)
   * @returns {Promise<Object>} Result of the operation
   */
  async queueOperation(operation) {
    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn(
        `Voice operation queue full (${this.maxQueueSize}), rejecting operation for ${operation.member.user.tag}`,
      );
      return {
        success: false,
        error: "Queue full",
      };
    }

    // Create unique key for this user in this guild
    // Include operation type to allow different types for same user
    const operationType =
      operation.type || (operation.forceMute ? "mute" : "enforce");
    const operationKey = `${operation.member.guild.id}:${operation.member.id}:${operationType}`;

    // Check if there's already a pending operation for this user with same type
    if (this.pendingOperations.has(operationKey)) {
      logger.debug(
        `Skipping duplicate voice operation for ${operation.member.user.tag} (type: ${operationType}) - already queued or processing`,
      );
      return {
        success: false,
        error: "Already queued",
        skipped: true,
      };
    }

    // Get priority if not provided
    let priority = operation.priority || 0;
    if (!operation.priority) {
      try {
        const userPriority = await getUserCorePriority(operation.member.id);
        priority = userPriority.priority || 0;
      } catch (error) {
        logger.debug(
          `Failed to get priority for ${operation.member.user.tag}:`,
          error.message,
        );
      }
    }

    // Add to queue with priority and timestamp
    const queueItem = {
      ...operation,
      priority,
      timestamp: Date.now(),
      id: `${operation.member.guild.id}:${operation.member.id}:${Date.now()}`,
      operationKey, // Store key for cleanup
      operationType, // Store type for processing
    };

    // Mark as pending with timestamp
    this.pendingOperations.add(operationKey);
    this.pendingOperationTimestamps.set(operationKey, Date.now());

    this.queue.push(queueItem);
    this.sortQueue();

    logger.debug(
      `Queued voice operation for ${operation.member.user.tag} (priority: ${priority}, queue size: ${this.queue.length})`,
    );

    // Return promise that resolves when operation completes
    return new Promise((resolve, reject) => {
      queueItem.resolve = resolve;
      queueItem.reject = reject;
    });
  }

  /**
   * Sort queue by priority (higher first), then by timestamp (earlier first)
   */
  sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Earlier timestamp first
    });
  }

  /**
   * Start processing queue
   */
  startProcessing() {
    if (this.processing) return;
    this.processing = true;
    this.processQueue();
  }

  /**
   * Process queue continuously
   */
  async processQueue() {
    while (this.processing) {
      // Check if we can process more operations
      if (
        this.activeOperations.size >= this.maxConcurrent ||
        this.queue.length === 0
      ) {
        await delay(this.queueCheckDelay); // Reduced delay for faster checking
        continue;
      }

      // Get next batch of operations (up to available capacity)
      const availableCapacity = this.maxConcurrent - this.activeOperations.size;
      const batchSize = Math.min(
        this.batchSize,
        availableCapacity,
        this.queue.length,
      );
      const batch = this.queue.splice(0, batchSize);

      // Process batch in parallel for faster execution
      // This allows multiple operations to run simultaneously
      const operations = batch.map(operation =>
        this.processOperation(operation).catch(error => {
          logger.error(
            `Error processing voice operation for ${operation.member.user.tag}:`,
            error,
          );
          if (operation.reject) {
            operation.reject(error);
          }
        }),
      );

      // Don't await all operations - let them run in parallel
      // This allows the queue to continue processing while operations execute
      Promise.all(operations).catch(() => {
        // Errors are already handled in individual operations
      });

      // Minimal delay between batches to allow operations to start
      // Only delay if we have more operations to process
      if (this.queue.length > 0) {
        await delay(this.batchDelay);
      }
    }
  }

  /**
   * Process a single voice operation
   * @param {Object} operation - Operation to process
   */
  async processOperation(operation) {
    const { member, role } = operation;
    const operationId = operation.id;
    const operationType =
      operation.operationType ||
      operation.type ||
      (operation.forceMute ? "mute" : "enforce");

    // Check if still needed based on operation type
    if (!member.voice?.channel) {
      logger.debug(
        `Skipping voice operation for ${member.user.tag} - not in voice channel`,
      );
      this.pendingOperations.delete(operation.operationKey);
      this.pendingOperationTimestamps.delete(operation.operationKey);
      if (operation.resolve) {
        operation.resolve({ success: true, skipped: true });
      }
      return;
    }

    // For unmute operations, check if user is muted
    // Only skip if it's specifically an "unmute" operation (not "enforce")
    if (operationType === "unmute") {
      if (!member.voice.mute || member.voice.selfMute) {
        logger.debug(
          `Skipping unmute operation for ${member.user.tag} - not muted or self-muted`,
        );
        this.pendingOperations.delete(operation.operationKey);
        this.pendingOperationTimestamps.delete(operation.operationKey);
        if (operation.resolve) {
          operation.resolve({ success: true, skipped: true });
        }
        return;
      }
    }

    // For mute operations, check if user is already muted
    // Only skip if it's specifically a "mute" operation (not "enforce")
    if (operationType === "mute" && operation.forceMute) {
      if (member.voice.mute && !member.voice.selfMute) {
        logger.debug(
          `Skipping mute operation for ${member.user.tag} - already muted`,
        );
        this.pendingOperations.delete(operation.operationKey);
        this.pendingOperationTimestamps.delete(operation.operationKey);
        if (operation.resolve) {
          operation.resolve({ success: true, skipped: true });
        }
        return;
      }
    }

    // For "enforce" operations, we should always process them
    // to check if the user needs to be muted/disconnected based on their roles
    // Don't skip "enforce" operations - let enforceVoiceRestrictions decide

    // OPTIMIZATION: Check rate limit WITHOUT recording (only record when actually executing)
    // This prevents rate limit checks from counting toward the limit
    if (await wouldVoiceOperationBeRateLimited(member.id, member.guild.id)) {
      const remainingTime = getVoiceOperationRemainingTime(
        member.id,
        member.guild.id,
      );

      // Re-queue with delay (keep in pendingOperations since we're re-queuing)
      logger.debug(
        `Rate limited for ${member.user.tag}, re-queuing after ${remainingTime}ms`,
      );

      // Use helper method for re-queuing
      const shouldRequeue = m => {
        if (!m.voice?.channel) return false;
        // Check based on operation type
        if (
          operationType === "unmute" ||
          (!operation.forceMute && operationType === "enforce")
        ) {
          return m.voice.mute && !m.voice.selfMute;
        } else if (operationType === "mute" || operation.forceMute) {
          return !m.voice.mute && !m.voice.selfMute;
        }
        return true; // For disconnect or other types
      };

      await this.requeueAfterDelay(
        operation,
        remainingTime + 1000,
        shouldRequeue,
      );
      return;
    }

    // Mark as active
    this.activeOperations.add(operationId);

    // Calculate dynamic timeout based on rate limit status
    // If operation is rate limited, use longer timeout
    let operationTimeout = this.baseOperationTimeout;
    try {
      const remainingTime = getVoiceOperationRemainingTime(
        member.id,
        member.guild.id,
      );
      // If rate limited, set timeout to remaining time + buffer (min 30s, max 5min)
      if (remainingTime > 0) {
        operationTimeout = Math.min(
          Math.max(remainingTime + 10000, this.baseOperationTimeout),
          this.maxOperationTimeout,
        );
        logger.debug(
          `Using extended timeout ${operationTimeout}ms for ${member.user.tag} due to rate limit (${remainingTime}ms remaining)`,
        );
      }
    } catch (error) {
      // If we can't check rate limit, use base timeout
      logger.debug(
        `Failed to check rate limit for timeout calculation: ${error.message}`,
      );
    }

    // Set operation timeout with dynamic duration
    const timeoutId = setTimeout(() => {
      logger.warn(
        `Voice operation timeout for ${member.user.tag} (operation: ${operationId}, timeout: ${operationTimeout}ms)`,
      );
      this.activeOperations.delete(operationId);
      this.pendingOperations.delete(operation.operationKey);
      this.pendingOperationTimestamps.delete(operation.operationKey);
      if (operation.reject) {
        operation.reject(new Error("Operation timeout"));
      }
    }, operationTimeout);

    try {
      // Refresh member to get latest state
      // Note: member.fetch() automatically updates the voice state, so we don't need to fetch it separately
      try {
        await member.fetch();
      } catch (error) {
        logger.debug(
          `Failed to refresh member ${member.user.tag}:`,
          error.message,
        );
      }

      // Execute voice operation based on type
      let result;

      if (operationType === "mute" || operation.forceMute) {
        // Direct mute operation (rate limit already checked above)

        try {
          await member.voice.setMute(
            true,
            operation.reason || "Voice restriction",
          );
          result = { muted: true };
          logger.info(
            `🔇 Muted ${member.user.tag} in voice channel - ${operation.reason || "Voice restriction"}`,
          );
        } catch (error) {
          result = { muted: false, error: error.message };
          logger.warn(`Failed to mute ${member.user.tag}:`, error.message);
        }
      } else if (operationType === "disconnect") {
        // Direct disconnect operation (rate limit already checked above)

        try {
          await member.voice.disconnect(
            operation.reason || "Voice restriction",
          );
          result = { disconnected: true };
          logger.info(
            `🚫 Disconnected ${member.user.tag} from voice channel - ${operation.reason || "Voice restriction"}`,
          );
        } catch (error) {
          result = { disconnected: false, error: error.message };
          logger.warn(
            `Failed to disconnect ${member.user.tag}:`,
            error.message,
          );
        }
      } else {
        // Use enforceVoiceRestrictions for automatic enforcement
        result = await enforceVoiceRestrictions(
          member,
          operation.reason ||
            (role
              ? `Temporary role removal: ${role.name}`
              : "Voice restriction"),
        );

        if (result.unmuted) {
          logger.info(
            `🔊 Unmuted ${member.user.tag} in voice channel - ${operation.reason || (role ? `temporary role "${role.name}" was removed` : "no longer has restrictive role")}`,
          );
        } else if (result.muted) {
          logger.info(
            `🔇 Muted ${member.user.tag} in voice channel - ${operation.reason || "restrictive role applied"}`,
          );
        } else if (result.disconnected) {
          logger.info(
            `🚫 Disconnected ${member.user.tag} from voice channel - ${operation.reason || "restrictive role applied"}`,
          );
        } else if (result.error) {
          if (result.needsWait) {
            // Re-queue if rate limited
            const remainingTime = getVoiceOperationRemainingTime(
              member.id,
              member.guild.id,
            );
            logger.debug(
              `Rate limited for ${member.user.tag}, re-queuing enforce after ${remainingTime}ms`,
            );

            // Clear the current timeout since we're re-queuing
            clearTimeout(timeoutId);

            // Use helper method for re-queuing
            const shouldRequeue = m => {
              if (!m.voice?.channel) return false;
              if (
                operationType === "unmute" ||
                (!operation.forceMute && operationType === "enforce")
              ) {
                return m.voice.mute && !m.voice.selfMute;
              } else if (operationType === "mute" || operation.forceMute) {
                return !m.voice.mute && !m.voice.selfMute;
              }
              return true; // For disconnect or other types
            };

            // Re-queue with delay - the operation will get a new timeout when processed again
            await this.requeueAfterDelay(
              operation,
              remainingTime + 1000,
              shouldRequeue,
            );
            // Don't remove from activeOperations here - it will be removed when re-processed
            // But we need to remove it now since we're not processing it
            this.activeOperations.delete(operationId);
            return;
          } else {
            logger.debug(
              `Voice operation failed for ${member.user.tag}: ${result.error}`,
            );
          }
        }
      }

      if (operation.resolve) {
        operation.resolve({
          success:
            result.unmuted || result.muted || result.disconnected || false,
          result,
        });
      }
    } catch (error) {
      logger.error(
        `Error processing voice operation for ${member.user.tag}:`,
        error,
      );
      if (operation.reject) {
        operation.reject(error);
      }
    } finally {
      clearTimeout(timeoutId); // Clear timeout
      this.activeOperations.delete(operationId);
      // Remove from pending operations
      this.pendingOperations.delete(operation.operationKey);
      this.pendingOperationTimestamps.delete(operation.operationKey);
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue stats
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      activeOperations: this.activeOperations.size,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Start cleanup interval for stale operations
   */
  startCleanup() {
    if (this.cleanupIntervalId) return;

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleOperations();
    }, this.cleanupInterval);
  }

  /**
   * Clean up stale pending operations
   */
  cleanupStaleOperations() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const staleKeys = [];

    for (const [key, timestamp] of this.pendingOperationTimestamps.entries()) {
      if (now - timestamp > staleThreshold) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length > 0) {
      logger.debug(`Cleaning up ${staleKeys.length} stale pending operations`);
      for (const key of staleKeys) {
        this.pendingOperations.delete(key);
        this.pendingOperationTimestamps.delete(key);
      }
    }
  }

  /**
   * Re-queue operation with delay after rate limit
   * Uses exponential backoff for retries
   * @param {Object} operation - Operation to re-queue
   * @param {number} delayMs - Delay in milliseconds
   * @param {Function} shouldRequeue - Function to check if operation should be re-queued
   */
  async requeueAfterDelay(operation, delayMs, shouldRequeue) {
    return new Promise(resolve => {
      // Track retry count for exponential backoff
      const retryCount = (operation.retryCount || 0) + 1;
      operation.retryCount = retryCount;

      // Calculate delay with exponential backoff (max 2 minutes)
      // First retry: delayMs, second: delayMs * 1.5, third: delayMs * 2, etc.
      const backoffMultiplier = Math.min(1 + retryCount * 0.5, 3);
      const adjustedDelay = Math.min(
        Math.floor(delayMs * backoffMultiplier),
        120000, // Max 2 minutes
      );

      logger.debug(
        `Re-queuing operation for ${operation.member.user.tag} after ${adjustedDelay}ms (retry ${retryCount}, original delay: ${delayMs}ms)`,
      );

      const timeoutId = setTimeout(async () => {
        try {
          // Refresh member to get latest state before re-queuing
          try {
            await operation.member.fetch();
          } catch (error) {
            logger.debug(
              `Failed to refresh member ${operation.member.user.tag} before re-queue:`,
              error.message,
            );
          }

          // Check if still needed
          if (shouldRequeue(operation.member)) {
            // Update timestamp for fresh timeout calculation
            operation.timestamp = Date.now();
            this.queue.push(operation);
            this.sortQueue();
            logger.debug(
              `Re-queued voice operation for ${operation.member.user.tag} after rate limit (retry ${retryCount})`,
            );
            resolve(true);
          } else {
            // No longer needed, remove from pending
            this.pendingOperations.delete(operation.operationKey);
            this.pendingOperationTimestamps.delete(operation.operationKey);
            if (operation.resolve) {
              operation.resolve({ success: true, skipped: true });
            }
            logger.debug(
              `Skipped re-queue for ${operation.member.user.tag} - no longer needed`,
            );
            resolve(false);
          }
        } catch (error) {
          logger.warn(
            `Error during re-queue for ${operation.member.user.tag}:`,
            error.message,
          );
          // Clean up on error
          this.pendingOperations.delete(operation.operationKey);
          this.pendingOperationTimestamps.delete(operation.operationKey);
          if (operation.resolve) {
            operation.resolve({ success: false, error: error.message });
          }
          resolve(false);
        }
      }, adjustedDelay);

      // Store timeout ID for potential cleanup
      operation.timeoutId = timeoutId;
    });
  }

  /**
   * Stop processing queue
   */
  stop() {
    this.processing = false;
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}

// Export singleton instance
let voiceQueue = null;

export function getVoiceOperationQueue() {
  if (!voiceQueue) {
    voiceQueue = new VoiceOperationQueue();
  }
  return voiceQueue;
}
