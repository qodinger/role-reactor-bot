import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking command usage statistics
 * @extends BaseRepository
 */
export class CommandUsageRepository extends BaseRepository {
  /**
   * @param {Db} db - MongoDB database instance
   * @param {CacheManager} cache - Cache manager instance
   * @param {Logger} logger - Logger instance
   */
  constructor(db, cache, logger) {
    super(db, "command_usage", cache, logger);
  }

  /**
   * Records a command execution
   * @param {string} commandName - Name of the command
   * @param {string} userId - ID of the user
   * @param {string} guildId - ID of the guild
   * @param {number} duration - Execution time in milliseconds
   * @returns {Promise<void>}
   */
  async recordUsage(commandName, userId, guildId, duration) {
    try {
      await this.collection.updateOne(
        { commandName },
        {
          $inc: { count: 1, totalDuration: duration },
          $set: { lastUsed: new Date() },
          $addToSet: { users: userId },
          $push: {
            recentUsage: {
              $each: [{ userId, guildId, duration, timestamp: new Date() }],
              $slice: -10, // Keep last 10 usages for quick lookup
            },
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Error recording usage for command ${commandName}:`,
        error,
      );
    }
  }

  /**
   * Gets statistics for all commands
   * @returns {Promise<Array>}
   */
  async getAllStats() {
    try {
      const stats = await this.collection.find({}).toArray();
      return stats.map(s => ({
        name: s.commandName,
        count: s.count,
        avgDuration: s.count > 0 ? s.totalDuration / s.count : 0,
        lastUsed: s.lastUsed,
        uniqueUsers: s.users ? s.users.length : 0,
      }));
    } catch (error) {
      this.logger.error("Error getting all command stats:", error);
      return [];
    }
  }

  /**
   * Gets statistics for a specific command
   * @param {string} commandName - Name of the command
   * @returns {Promise<Object|null>}
   */
  async getCommandStats(commandName) {
    try {
      const stats = await this.collection.findOne({ commandName });
      if (!stats) return null;

      return {
        name: stats.commandName,
        count: stats.count,
        avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
        lastUsed: stats.lastUsed,
        uniqueUsers: stats.users ? stats.users.length : 0,
        recentUsage: stats.recentUsage || [],
      };
    } catch (error) {
      this.logger.error(
        `Error getting stats for command ${commandName}:`,
        error,
      );
      return null;
    }
  }
}
