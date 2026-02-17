import { BaseRepository } from "./BaseRepository.js";

export class UserExperienceRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "user_experience", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      // Ensure unique compound index on guildId + userId
      await this.collection.createIndex(
        { guildId: 1, userId: 1 },
        { unique: true },
      );
      // Index for leaderboard sorting (guildId + totalXP descending)
      await this.collection.createIndex({ guildId: 1, totalXP: -1 });
      this.logger.debug("UserExperienceRepository indexes ensured");
    } catch (error) {
      this.logger.warn(
        "Failed to ensure UserExperienceRepository indexes",
        error,
      );
    }
  }

  async getAll() {
    try {
      const documents = await this.collection.find({}).toArray();
      this.cache.set("user_experience_all", documents);
      return documents;
    } catch (error) {
      this.logger.error("Failed to get all user experience data", error);
      throw error;
    }
  }

  async getByGuild(guildId) {
    try {
      const documents = await this.collection.find({ guildId }).toArray();
      return documents;
    } catch (error) {
      this.logger.error(
        `Failed to get user experience data for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getByUser(guildId, userId) {
    try {
      const userData = await this.collection.findOne({ guildId, userId });
      return (
        userData || { guildId, userId, xp: 0, level: 1, lastMessageAt: null }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async set(guildId, userId, userData) {
    try {
      await this.collection.updateOne(
        { guildId, userId },
        { $set: { ...userData, guildId, userId, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to set user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async delete(guildId, userId) {
    try {
      await this.collection.deleteOne({ guildId, userId });
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to delete user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getLeaderboard(guildId, limit = 10) {
    try {
      const leaderboard = await this.collection
        .find({ guildId })
        // Sort by totalXP (primary) then level (secondary)
        .sort({ totalXP: -1, level: -1 })
        .limit(limit)
        .toArray();
      return leaderboard;
    } catch (error) {
      this.logger.error(
        `Failed to get leaderboard for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getUserRank(guildId, userId) {
    try {
      const userData = await this.collection.findOne({ guildId, userId });
      if (!userData) return 0;

      const count = await this.collection.countDocuments({
        guildId,
        totalXP: { $gt: userData.totalXP || 0 },
      });

      return count + 1;
    } catch (error) {
      this.logger.error(
        `Failed to get user rank for ${userId} in ${guildId}`,
        error,
      );
      return 0;
    }
  }
}
