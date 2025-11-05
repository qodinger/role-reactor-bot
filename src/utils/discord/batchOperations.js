import { getLogger } from "../logger.js";
import { getUserCorePriority } from "../../commands/general/core/utils.js";
import { delay } from "../delay.js";

/**
 * Batch operation manager for Discord API calls
 * Reduces API calls by grouping operations and implementing rate limiting
 */
class BatchOperationManager {
  constructor() {
    this.logger = getLogger();
    this.queues = new Map();
    this.processing = new Map();
    this.batchSizes = {
      roleAdd: 5,
      roleRemove: 5,
      memberFetch: 10,
      messageSend: 3,
      reactionAdd: 10,
    };
    this.batchDelays = {
      roleAdd: 100, // 100ms between role batches
      roleRemove: 100,
      memberFetch: 50,
      messageSend: 200,
      reactionAdd: 50,
    };
  }

  /**
   * Queue a role addition operation
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @param {Function} operation - The operation to perform
   * @returns {Promise<boolean>} Success status
   */
  async queueRoleAdd(guildId, userId, roleId, operation) {
    const key = `roleAdd:${guildId}`;
    return this.queueOperation(
      key,
      { guildId, userId, roleId, operation },
      "roleAdd",
      { userId },
    );
  }

  /**
   * Queue a role removal operation
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {string} roleId - Role ID
   * @param {Function} operation - The operation to perform
   * @returns {Promise<boolean>} Success status
   */
  async queueRoleRemove(guildId, userId, roleId, operation) {
    const key = `roleRemove:${guildId}`;
    return this.queueOperation(
      key,
      { guildId, userId, roleId, operation },
      "roleRemove",
      { userId },
    );
  }

  /**
   * Queue a member fetch operation
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {Function} operation - The operation to perform
   * @returns {Promise<boolean>} Success status
   */
  async queueMemberFetch(guildId, userId, operation) {
    const key = `memberFetch:${guildId}`;
    return this.queueOperation(
      key,
      { guildId, userId, operation },
      "memberFetch",
      { userId },
    );
  }

  /**
   * Generic operation queuing
   * @param {string} key - Queue key
   * @param {object} data - Operation data
   * @param {string} type - Operation type
   * @returns {Promise<boolean>} Success status
   */
  async queueOperation(key, data, type, options = {}) {
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    // Add priority to data if userId is provided
    let priority = 0;
    if (options.userId) {
      try {
        const userPriority = await getUserCorePriority(
          options.userId,
          this.logger,
        );
        priority = userPriority.priority;
      } catch {
        // Error already logged by getUserCorePriority
        priority = 0;
      }
    }

    // Add priority and timestamp to data
    const operationData = {
      ...data,
      priority,
      timestamp: Date.now(),
    };

    this.queues.get(key).push(operationData);

    // Sort queue by priority before processing
    this.sortQueueByPriority(key);

    // Process queue if not already processing
    if (!this.processing.get(key)) {
      this.processQueue(key, type);
    }

    return true;
  }

  /**
   * Sort queue by Core member priority
   * @param {string} key - Queue key
   */
  sortQueueByPriority(key) {
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      return;
    }

    // Sort by priority (descending), then by timestamp (ascending)
    queue.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return (a.timestamp || 0) - (b.timestamp || 0); // Earlier timestamp first
    });
  }

  /**
   * Process a queue of operations
   * @param {string} key - Queue key
   * @param {string} type - Operation type
   */
  async processQueue(key, type) {
    if (this.processing.get(key)) return;

    this.processing.set(key, true);
    const queue = this.queues.get(key) || [];

    try {
      while (queue.length > 0) {
        const batch = queue.splice(0, this.batchSizes[type]);

        if (batch.length > 0) {
          await this.processBatch(batch, type);

          // Delay between batches to respect rate limits
          if (queue.length > 0) {
            await delay(this.batchDelays[type]);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing ${type} queue:`, error);
    } finally {
      this.processing.set(key, false);
    }
  }

  /**
   * Process a batch of operations
   * @param {Array} batch - Batch of operations
   * @param {string} type - Operation type
   */
  async processBatch(batch, type) {
    const logger = this.logger;

    try {
      switch (type) {
        case "roleAdd":
          await this.processRoleAddBatch(batch);
          break;
        case "roleRemove":
          await this.processRoleRemoveBatch(batch);
          break;
        case "memberFetch":
          await this.processMemberFetchBatch(batch);
          break;
        default:
          logger.warn(`Unknown batch type: ${type}`);
      }
    } catch (error) {
      logger.error(`Error processing ${type} batch:`, error);
    }
  }

  /**
   * Process a batch of role additions
   * @param {Array} batch - Batch of role addition operations
   */
  async processRoleAddBatch(batch) {
    const results = [];

    for (const { guildId, userId, roleId, operation } of batch) {
      try {
        const result = await operation();
        results.push({ success: true, guildId, userId, roleId, result });
      } catch (error) {
        results.push({
          success: false,
          guildId,
          userId,
          roleId,
          error: error.message,
        });
        this.logger.error(
          `Failed to add role ${roleId} to user ${userId}:`,
          error,
        );
      }
    }

    // Log batch results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      this.logger.debug(
        `✅ Successfully processed ${successCount} role additions`,
      );
    }

    if (failureCount > 0) {
      this.logger.warn(`⚠️ Failed to process ${failureCount} role additions`);
    }

    return results;
  }

  /**
   * Process a batch of role removals
   * @param {Array} batch - Batch of role removal operations
   */
  async processRoleRemoveBatch(batch) {
    const results = [];

    for (const { guildId, userId, roleId, operation } of batch) {
      try {
        const result = await operation();
        results.push({ success: true, guildId, userId, roleId, result });
      } catch (error) {
        results.push({
          success: false,
          guildId,
          userId,
          roleId,
          error: error.message,
        });
        this.logger.error(
          `Failed to remove role ${roleId} from user ${userId}:`,
          error,
        );
      }
    }

    // Log batch results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      this.logger.debug(
        `✅ Successfully processed ${successCount} role removals`,
      );
    }

    if (failureCount > 0) {
      this.logger.warn(`⚠️ Failed to process ${failureCount} role removals`);
    }

    return results;
  }

  /**
   * Process a batch of member fetches
   * @param {Array} batch - Batch of member fetch operations
   */
  async processMemberFetchBatch(batch) {
    const results = [];

    for (const { guildId, userId, operation } of batch) {
      try {
        const result = await operation();
        results.push({ success: true, guildId, userId, result });
      } catch (error) {
        results.push({ success: false, guildId, userId, error: error.message });
        this.logger.debug(`Failed to fetch member ${userId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get queue statistics
   * @returns {object} Queue statistics
   */
  getStats() {
    const stats = {};
    for (const [key, queue] of this.queues.entries()) {
      stats[key] = {
        queued: queue.length,
        processing: this.processing.get(key) || false,
      };
    }
    return stats;
  }

  /**
   * Clear all queues
   */
  clear() {
    this.queues.clear();
    this.processing.clear();
  }
}

// Export singleton instance
const batchOperationManager = new BatchOperationManager();
export default batchOperationManager;

// Export utility functions for common operations
export async function batchAddRole(guild, userId, roleId) {
  return batchOperationManager.queueRoleAdd(
    guild.id,
    userId,
    roleId,
    async () => {
      const member = await guild.members.fetch(userId);
      return await member.roles.add(roleId);
    },
  );
}

export async function batchRemoveRole(guild, userId, roleId) {
  return batchOperationManager.queueRoleRemove(
    guild.id,
    userId,
    roleId,
    async () => {
      const member = await guild.members.fetch(userId);
      return await member.roles.remove(roleId);
    },
  );
}

export async function batchFetchMember(guild, userId) {
  return batchOperationManager.queueMemberFetch(guild.id, userId, async () => {
    return await guild.members.fetch(userId);
  });
}
