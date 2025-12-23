import { getLogger } from "../../utils/logger.js";
import { delay } from "../../utils/delay.js";
import {
  bulkAddRoles,
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";

/**
 * Role executor for large-scale operations
 * Handles rate limiting, batching, and error recovery for large servers
 */
export class RoleExecutor {
  constructor() {
    this.logger = getLogger();
    this.batchSize = 10; // Smaller batches for better rate limit handling
    this.batchDelay = 150; // 150ms delay between batches
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second initial retry delay
    this.rateLimitBackoff = 5000; // 5 seconds for rate limit backoff
  }

  /**
   * Execute role assignment/removal for large user lists with optimization
   * @param {import("discord.js").Guild} guild - The guild
   * @param {Array<string>} userIds - Array of user IDs
   * @param {import("discord.js").Role} role - The role to assign/remove
   * @param {string} action - "assign" or "remove"
   * @param {string} reason - Reason for the operation
   * @returns {Promise<Object>} Execution results with statistics
   */
  async executeRoleOperation(
    guild,
    userIds,
    role,
    action,
    reason = "Scheduled role operation",
  ) {
    const totalUsers = userIds.length;

    this.logger.info(
      `Starting optimized ${action} operation for ${totalUsers} users in guild ${guild.name}`,
    );

    // For very large operations (>1000 users), process in chunks
    if (totalUsers > 1000) {
      return this.executeLargeOperation(guild, userIds, role, action, reason);
    }

    // For smaller operations, use standard batch processing
    return this.executeBatchOperation(guild, userIds, role, action, reason);
  }

  /**
   * Execute large operations in chunks to avoid memory/rate limit issues
   */
  async executeLargeOperation(guild, userIds, role, action, reason) {
    const chunkSize = 500; // Process 500 users at a time
    const totalChunks = Math.ceil(userIds.length / chunkSize);
    const totalUsers = userIds.length;
    let totalSuccess = 0;
    let totalFailed = 0;
    const errors = [];

    this.logger.info(
      `Large operation detected: Processing ${totalUsers} users in ${totalChunks} chunks`,
    );

    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;

      this.logger.info(
        `Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} users)`,
      );

      try {
        const result = await this.executeBatchOperation(
          guild,
          chunk,
          role,
          action,
          reason,
        );

        totalSuccess += result.successCount;
        totalFailed += result.failedCount;
        errors.push(...result.errors);

        // Longer delay between chunks for very large operations
        if (i + chunkSize < userIds.length) {
          const delayMs = Math.min(2000, 500 + chunk.length * 2); // Adaptive delay
          await delay(delayMs);
        }
      } catch (error) {
        this.logger.error(`Error processing chunk ${chunkNumber}:`, error);
        totalFailed += chunk.length;
        errors.push({
          chunk: chunkNumber,
          error: error.message,
          userCount: chunk.length,
        });

        // Longer backoff on chunk errors
        await delay(this.rateLimitBackoff);
      }
    }

    return {
      successCount: totalSuccess,
      failedCount: totalFailed,
      totalUsers: userIds.length,
      errors,
      processed: totalSuccess + totalFailed,
    };
  }

  /**
   * Execute batch operation with rate limiting
   */
  async executeBatchOperation(guild, userIds, role, action, reason) {
    // Prepare operations in batches
    const operations = [];
    let processed = 0;

    // Fetch members in smaller batches to avoid overwhelming the API
    const fetchBatchSize = 20;
    for (let i = 0; i < userIds.length; i += fetchBatchSize) {
      const fetchBatch = userIds.slice(i, i + fetchBatchSize);

      // Fetch members with caching
      const memberPromises = fetchBatch.map(async userId => {
        try {
          const member = await getCachedMember(guild, userId);
          if (!member) {
            return null;
          }

          // Check if operation is needed
          if (action === "assign") {
            if (!member.roles.cache.has(role.id)) {
              return { member, role, action: "add" };
            }
          } else if (action === "remove") {
            if (member.roles.cache.has(role.id)) {
              return { member, role, action: "remove" };
            }
          }

          return null; // Already has/doesn't have role
        } catch (error) {
          this.logger.debug(
            `Failed to fetch/prepare member ${userId}:`,
            error.message,
          );
          return null;
        }
      });

      const batchOperations = await Promise.allSettled(memberPromises);
      for (const result of batchOperations) {
        if (result.status === "fulfilled" && result.value) {
          operations.push(result.value);
        }
      }

      processed += fetchBatch.length;

      // Small delay between fetch batches
      if (i + fetchBatchSize < userIds.length) {
        await delay(100);
      }

      // Log progress every 100 users
      if (processed % 100 === 0) {
        this.logger.debug(
          `Prepared ${processed}/${userIds.length} users, ${operations.length} operations needed`,
        );
      }
    }

    if (operations.length === 0) {
      this.logger.info(
        "No operations needed - all users already have/do not have the role",
      );
      return {
        successCount: 0,
        failedCount: 0,
        totalUsers: userIds.length,
        errors: [],
        processed: userIds.length,
      };
    }

    // Execute operations in optimized batches
    const addOperations = operations.filter(op => op.action === "add");
    const removeOperations = operations.filter(op => op.action === "remove");

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Process add operations with retries
    if (addOperations.length > 0) {
      const addResults = await this.executeWithRetries(
        () =>
          bulkAddRoles(
            addOperations.map(op => ({ member: op.member, role: op.role })),
            reason,
          ),
        addOperations.length,
      );

      successCount += addResults.filter(r => r.success).length;
      failedCount += addResults.filter(r => !r.success).length;
      errors.push(
        ...addResults
          .filter(r => !r.success)
          .map(r => ({
            userId: r.memberId,
            error: r.error,
          })),
      );
    }

    // Delay between add and remove operations
    if (addOperations.length > 0 && removeOperations.length > 0) {
      await delay(this.batchDelay * 2);
    }

    // Process remove operations with retries
    if (removeOperations.length > 0) {
      const removeResults = await this.executeWithRetries(
        () =>
          bulkRemoveRoles(
            removeOperations.map(op => ({ member: op.member, role: op.role })),
            reason,
          ),
        removeOperations.length,
      );

      successCount += removeResults.filter(r => r.success).length;
      failedCount += removeResults.filter(r => !r.success).length;
      errors.push(
        ...removeResults
          .filter(r => !r.success)
          .map(r => ({
            userId: r.memberId,
            error: r.error,
          })),
      );
    }

    return {
      successCount,
      failedCount,
      totalUsers: userIds.length,
      errors: errors.slice(0, 100), // Limit error details to avoid memory issues
      processed: userIds.length,
    };
  }

  /**
   * Execute operation with retry logic and rate limit handling
   */
  async executeWithRetries(operation, expectedCount) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const results = await operation();

        // Check if we got rate limited
        const rateLimited = results.some(
          r => r.error && r.error.toLowerCase().includes("rate limit"),
        );

        if (rateLimited) {
          this.logger.warn(
            `Rate limited on attempt ${attempt}, backing off for ${this.rateLimitBackoff}ms`,
          );
          await delay(this.rateLimitBackoff * attempt);
          continue;
        }

        return results;
      } catch (error) {
        lastError = error;
        const isRateLimit = error.message?.toLowerCase().includes("rate limit");

        if (isRateLimit) {
          this.logger.warn(
            `Rate limit error on attempt ${attempt}, backing off for ${this.rateLimitBackoff * attempt}ms`,
          );
          await delay(this.rateLimitBackoff * attempt);
        } else if (attempt < this.maxRetries) {
          this.logger.warn(
            `Operation failed on attempt ${attempt}, retrying in ${this.retryDelay * attempt}ms`,
          );
          await delay(this.retryDelay * attempt);
        }
      }
    }

    // If all retries failed, return error results
    this.logger.error(
      `Operation failed after ${this.maxRetries} attempts:`,
      lastError,
    );
    return Array(expectedCount).fill({
      success: false,
      error: lastError?.message || "Unknown error",
    });
  }
}

// Export singleton instance
let executor = null;

export function getRoleExecutor() {
  if (!executor) {
    executor = new RoleExecutor();
  }
  return executor;
}
