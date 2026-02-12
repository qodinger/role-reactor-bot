import { BaseRepository } from "./BaseRepository.js";

export class ModerationLogRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "moderation_logs", cache, logger);
  }

  async getByUser(guildId, userId) {
    try {
      const cached = this.cache.get(`moderation_logs_${guildId}_${userId}`);
      if (cached) return cached;

      const documents = await this.collection
        .find({ guildId, userId })
        .sort({ timestamp: -1 })
        .toArray();

      this.cache.set(`moderation_logs_${guildId}_${userId}`, documents);
      return documents;
    } catch (error) {
      this.logger.error(
        `Failed to get moderation logs for user ${userId}`,
        error,
      );
      return [];
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`moderation_logs_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection
        .find({ guildId })
        .sort({ timestamp: -1 })
        .toArray();

      this.cache.set(`moderation_logs_guild_${guildId}`, documents);
      return documents;
    } catch (error) {
      this.logger.error(
        `Failed to get moderation logs for guild ${guildId}`,
        error,
      );
      return [];
    }
  }

  async create(logData) {
    try {
      const document = {
        ...logData,
        timestamp: logData.timestamp ? new Date(logData.timestamp) : new Date(),
      };
      await this.collection.insertOne(document);
      this.cache.delete(`moderation_logs_${logData.guildId}_${logData.userId}`);
      this.cache.delete(`moderation_logs_guild_${logData.guildId}`);
      return true;
    } catch (error) {
      this.logger.error("Failed to create moderation log", error);
      return false;
    }
  }

  async deleteWarning(guildId, userId, caseId) {
    try {
      const result = await this.collection.deleteOne({
        guildId,
        userId,
        caseId,
        action: "warn",
      });
      this.cache.delete(`moderation_logs_${guildId}_${userId}`);
      this.cache.delete(`moderation_logs_guild_${guildId}`);
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete warning ${caseId}`, error);
      return false;
    }
  }

  async getWarnCount(guildId, userId) {
    try {
      return await this.collection.countDocuments({
        guildId,
        userId,
        action: "warn",
      });
    } catch (error) {
      this.logger.error(`Failed to get warn count for user ${userId}`, error);
      return 0;
    }
  }
}
