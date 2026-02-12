import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking guild growth and activity analytics
 * @extends BaseRepository
 */
export class GuildAnalyticsRepository extends BaseRepository {
  /**
   * @param {Db} db - MongoDB database instance
   * @param {CacheManager} cache - Cache manager instance
   * @param {Logger} logger - Logger instance
   */
  constructor(db, cache, logger) {
    super(db, "guild_analytics", cache, logger);
  }

  /**
   * Updates an analytics counter for a specific guild and date
   * @param {string} guildId - Discord Guild ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} type - Counter type ('joins', 'leaves', 'members')
   * @param {number} amount - Amount to increment by
   * @returns {Promise<void>}
   */
  async updateCounter(guildId, date, type, amount) {
    try {
      // Create setOnInsert object for fields not being incremented to avoid path collision
      const setOnInsert = {};
      const fields = ["joins", "leaves", "members"];
      fields.forEach(field => {
        if (field !== type) {
          setOnInsert[field] = 0;
        }
      });

      await this.collection.updateOne(
        { guildId, date },
        {
          $inc: { [type]: amount },
          $setOnInsert: setOnInsert,
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Error updating analytics counter for guild ${guildId}:`,
        error,
      );
    }
  }

  /**
   * Gets historical analytics for a guild within a date range
   * @param {string} guildId - Discord Guild ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getHistory(guildId, startDate, endDate) {
    try {
      return await this.collection
        .find({
          guildId,
          date: { $gte: startDate, $lte: endDate },
        })
        .sort({ date: 1 })
        .toArray();
    } catch (error) {
      this.logger.error(
        `Error getting analytics history for guild ${guildId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Deletes analytics data older than a certain date
   * @param {string} cutoffDate - Cutoff date (YYYY-MM-DD)
   * @returns {Promise<number>} Number of documents deleted
   */
  async deleteOlderThan(cutoffDate) {
    try {
      const result = await this.collection.deleteMany({
        date: { $lt: cutoffDate },
      });
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error cleaning up old analytics data:`, error);
      return 0;
    }
  }

  /**
   * Migrates data from the old JSON format
   * @param {Object} data - The nested object from guild_analytics.json
   * @returns {Promise<number>} Number of records migrated
   */
  async migrateFromJson(data) {
    let count = 0;
    try {
      const operations = [];
      for (const [guildId, dates] of Object.entries(data)) {
        for (const [date, stats] of Object.entries(dates)) {
          operations.push({
            updateOne: {
              filter: { guildId, date },
              update: { $set: { ...stats, guildId, date } },
              upsert: true,
            },
          });
        }
      }

      if (operations.length > 0) {
        const result = await this.collection.bulkWrite(operations);
        count = result.upsertedCount + result.modifiedCount;
      }
    } catch (error) {
      this.logger.error("Error migrating analytics from JSON:", error);
    }
    return count;
  }
}
