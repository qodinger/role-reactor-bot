import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking recent command usage per user
 * Used for time-windowed active user statistics (24h, 7d)
 */
export class RecentCommandUsersRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "recent_command_users", cache, logger);
  }

  /**
   * Record a command usage event
   * @param {string} commandName - Name of the command
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Guild ID where command was used
   * @returns {Promise<void>}
   */
  async recordUsage(commandName, userId, guildId) {
    try {
      await this.collection.insertOne({
        commandName,
        userId,
        guildId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.debug(
        `Failed to record recent command user: ${error.message}`,
      );
    }
  }

  /**
   * Get unique active users within a time window
   * @param {number} hours - Number of hours to look back
   * @returns {Promise<number>} Count of unique users
   */
  async getUniqueActiveUsers(hours) {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const result = await this.collection
        .aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          { $group: { _id: "$userId" } },
          { $count: "total" },
        ])
        .toArray();
      return result[0]?.total || 0;
    } catch (error) {
      this.logger.error("Failed to get unique active users", error);
      return 0;
    }
  }

  /**
   * Get active user counts for multiple time windows
   * @returns {Promise<Object>} Object with 24h and 7d counts
   */
  async getActiveUserStats() {
    try {
      const [users24h, users7d] = await Promise.all([
        this.getUniqueActiveUsers(24),
        this.getUniqueActiveUsers(168), // 7 days
      ]);
      return { users24h, users7d };
    } catch (error) {
      this.logger.error("Failed to get active user stats", error);
      return { users24h: 0, users7d: 0 };
    }
  }
}
