import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking daily guild and user count snapshots
 * @extends BaseRepository
 */
export class GuildCountRepository extends BaseRepository {
  /**
   * @param {object} db - MongoDB database instance
   * @param {object} cache - Cache manager instance
   * @param {object} logger - Logger instance
   */
  constructor(db, cache, logger) {
    super(db, "guild_count_history", cache, logger);
  }

  /**
   * Record a daily snapshot of guild and user counts
   * @param {number} guildCount - Total guild count
   * @param {number} userCount - Total user count
   * @returns {Promise<void>}
   */
  async recordSnapshot(guildCount, userCount) {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      await this.collection.updateOne(
        { date: today },
        {
          $set: {
            guildCount,
            userCount,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            date: today,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error("Error recording guild count snapshot:", error);
    }
  }

  /**
   * Get guild count history for the last N days
   * @param {number} days - Number of days to retrieve (default 30)
   * @returns {Promise<Array>}
   */
  async getHistory(days = 30) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDate = cutoff.toISOString().split("T")[0];

      return await this.collection
        .find({ date: { $gte: cutoffDate } })
        .sort({ date: 1 })
        .toArray();
    } catch (error) {
      this.logger.error("Error getting guild count history:", error);
      return [];
    }
  }

  /**
   * Get the latest snapshot
   * @returns {Promise<Object|null>}
   */
  async getLatest() {
    try {
      return await this.collection.findOne({}, { sort: { date: -1 } });
    } catch (error) {
      this.logger.error("Error getting latest guild count:", error);
      return null;
    }
  }

  /**
   * Delete snapshots older than a certain number of days
   * @param {number} daysToKeep - Number of days to retain (default 365)
   * @returns {Promise<number>} Number of documents deleted
   */
  async deleteOlderThan(daysToKeep = 365) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      const cutoffDate = cutoff.toISOString().split("T")[0];

      const result = await this.collection.deleteMany({
        date: { $lt: cutoffDate },
      });
      return result.deletedCount;
    } catch (error) {
      this.logger.error("Error cleaning up old guild count data:", error);
      return 0;
    }
  }
}
