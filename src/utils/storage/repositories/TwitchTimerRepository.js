import { BaseRepository } from "./BaseRepository.js";

export class TwitchTimerRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "twitch_timers", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex(
        { guildId: 1, name: 1 },
        { unique: true },
      );
      await this.collection.createIndex({ guildId: 1, enabled: 1 });
      this.logger.debug("TwitchTimerRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure TwitchTimerRepository indexes", error);
    }
  }

  async create(guildId, timer) {
    try {
      const doc = {
        guildId,
        name: timer.name.toLowerCase(),
        message: timer.message,
        intervalMs: timer.intervalMs || 300000, // default 5 minutes
        enabled: timer.enabled !== false,
        lastSentAt: null,
        createdBy: timer.createdBy || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(doc);
      this.cache.clear();
      return doc;
    } catch (error) {
      this.logger.error(`Failed to create timer for guild ${guildId}`, error);
      throw error;
    }
  }

  async getByName(guildId, name) {
    try {
      return await this.collection.findOne({
        guildId,
        name: name.toLowerCase(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to get timer ${name} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async listByGuild(guildId) {
    try {
      return await this.collection
        .find({ guildId })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      this.logger.error(`Failed to list timers for guild ${guildId}`, error);
      throw error;
    }
  }

  async getEnabled(guildId) {
    try {
      return await this.collection.find({ guildId, enabled: true }).toArray();
    } catch (error) {
      this.logger.error(
        `Failed to get enabled timers for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async updateLastSent(guildId, name) {
    try {
      await this.collection.updateOne(
        { guildId, name: name.toLowerCase() },
        { $set: { lastSentAt: new Date(), updatedAt: new Date() } },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to update timer lastSentAt for ${name} in guild ${guildId}`,
        error,
      );
    }
  }

  async setEnabled(guildId, name, enabled) {
    try {
      const result = await this.collection.updateOne(
        { guildId, name: name.toLowerCase() },
        { $set: { enabled, updatedAt: new Date() } },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to set timer enabled for ${name} in guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async remove(guildId, name) {
    try {
      const result = await this.collection.deleteOne({
        guildId,
        name: name.toLowerCase(),
      });
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove timer ${name} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }
}
