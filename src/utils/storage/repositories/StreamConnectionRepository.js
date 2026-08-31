import { BaseRepository } from "./BaseRepository.js";

export class StreamConnectionRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "stream_connections", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex(
        { discordUserId: 1, platform: 1 },
        { unique: true },
      );
      await this.collection.createIndex({ guildId: 1 });
      await this.collection.createIndex({ platformUserId: 1, platform: 1 });
      this.logger.debug("StreamConnectionRepository indexes ensured");
    } catch (error) {
      this.logger.warn(
        "Failed to ensure StreamConnectionRepository indexes",
        error,
      );
    }
  }

  async getByDiscordUser(discordUserId, platform) {
    try {
      return await this.collection.findOne({ discordUserId, platform });
    } catch (error) {
      this.logger.error(
        `Failed to get stream connection for user ${discordUserId}`,
        error,
      );
      throw error;
    }
  }

  async getByGuild(guildId) {
    try {
      return await this.collection.find({ guildId }).toArray();
    } catch (error) {
      this.logger.error(
        `Failed to get stream connections for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getByPlatformUser(platformUserId, platform) {
    try {
      return await this.collection.findOne({ platformUserId, platform });
    } catch (error) {
      this.logger.error(
        `Failed to get stream connection for platform user ${platformUserId}`,
        error,
      );
      throw error;
    }
  }

  async upsert(connection) {
    try {
      const { discordUserId, platform } = connection;
      const result = await this.collection.updateOne(
        { discordUserId, platform },
        { $set: { ...connection, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to upsert stream connection for user ${connection.discordUserId}`,
        error,
      );
      throw error;
    }
  }

  async remove(discordUserId, platform) {
    try {
      const result = await this.collection.deleteOne({
        discordUserId,
        platform,
      });
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove stream connection for user ${discordUserId}`,
        error,
      );
      throw error;
    }
  }

  async updateSettings(discordUserId, platform, settings) {
    try {
      const result = await this.collection.updateOne(
        { discordUserId, platform },
        { $set: { ...settings, updatedAt: new Date() } },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update stream connection settings for user ${discordUserId}`,
        error,
      );
      throw error;
    }
  }
}
