import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking image tool usage statistics
 * @extends BaseRepository
 */
export class ImageToolUsageRepository extends BaseRepository {
  /**
   * @param {object} db - MongoDB database instance
   * @param {object} cache - Cache manager instance
   * @param {object} logger - Logger instance
   */
  constructor(db, cache, logger) {
    super(db, "image_tool_usage_logs", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Creates indexes for the collection.
   * - userId + timestamp: for per-user history queries
   * - tool: for aggregation by tool
   * - timestamp TTL: auto-deletes logs older than 90 days to prevent unbounded growth
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ userId: 1, timestamp: -1 });
      await this.collection.createIndex({ tool: 1 });
      await this.collection.createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 60 * 60 * 24 * 90 } // 90 days
      );
      this.logger.debug("ImageToolUsageRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure ImageToolUsageRepository indexes", error);
    }
  }

  /**
   * Records an image tool usage
   * @param {Object} usageData
   * @param {string} usageData.userId - ID of the user
   * @param {string} usageData.tool - The tool used (e.g., resize, upscale)
   * @param {Object} usageData.options - Options used for the tool
   * @param {boolean} usageData.isFree - Whether the usage was from free quota
   * @param {number} usageData.creditsDeducted - Number of credits deducted
   * @param {string} usageData.status - Status of the operation ("success", "failed")
   * @param {string} [usageData.error] - Optional error message if failed
   * @returns {Promise<void>}
   */
  async logUsage({ userId, tool, options, isFree, creditsDeducted, status, error }) {
    try {
      await this.collection.insertOne({
        userId,
        tool,
        options,
        isFree,
        creditsDeducted,
        status,
        error: error || null,
        timestamp: new Date(),
      });
    } catch (insertError) {
      this.logger.error(
        `Error recording image tool usage for user ${userId}, tool ${tool}:`,
        insertError
      );
    }
  }

  /**
   * Gets usage statistics by tool
   * @returns {Promise<Array>}
   */
  async getUsageStatsByTool() {
    try {
      return await this.collection.aggregate([
        {
          $group: {
            _id: "$tool",
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            },
            freeCount: {
              $sum: { $cond: ["$isFree", 1, 0] }
            },
            paidCount: {
              $sum: { $cond: ["$isFree", 0, 1] }
            },
            totalCreditsDeducted: { $sum: "$creditsDeducted" },
            lastUsed: { $max: "$timestamp" }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();
    } catch (error) {
      this.logger.error("Error getting image tool usage stats:", error);
      return [];
    }
  }
}
