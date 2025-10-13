import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Manages concurrent AI generation requests to prevent API overload
 */
export class ConcurrencyManager {
  constructor() {
    this.activeRequests = new Set();
    this.queue = [];
    this.maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT) || 3;
    this.requestTimeout = parseInt(process.env.AI_REQUEST_TIMEOUT) || 120000; // 2 minutes
    this.retryAttempts = parseInt(process.env.AI_RETRY_ATTEMPTS) || 2;
    this.retryDelay = parseInt(process.env.AI_RETRY_DELAY) || 1000; // 1 second
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
      const request = {
        id: requestId,
        function: generationFunction,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        attempts: 0,
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

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests.add(request.id);

    try {
      logger.debug(
        `Processing AI request ${request.id} (${this.activeRequests.size}/${this.maxConcurrent} active)`,
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
}

export const concurrencyManager = new ConcurrencyManager();
