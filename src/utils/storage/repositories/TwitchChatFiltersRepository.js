import { BaseRepository } from "./BaseRepository.js";

export class TwitchChatFiltersRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "twitch_chat_filters", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ guildId: 1 }, { unique: true });
      this.logger.debug("TwitchChatFiltersRepository indexes ensured");
    } catch (error) {
      this.logger.warn(
        "Failed to ensure TwitchChatFiltersRepository indexes",
        error,
      );
    }
  }

  getDefaultSettings(guildId) {
    return {
      guildId,
      enabled: false,
      caps: { enabled: false, threshold: 70, minLength: 10, action: "timeout" },
      links: { enabled: false, action: "timeout" },
      spam: {
        enabled: false,
        repeatedMessages: 3,
        rateThreshold: 5,
        action: "timeout",
      },
      badWords: { enabled: false, words: [], action: "timeout" },
      timeoutDuration: 5, // minutes
    };
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return settings || this.getDefaultSettings(guildId);
    } catch (error) {
      this.logger.error(
        `Failed to get Twitch chat filters for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async set(guildId, settings) {
    try {
      const doc = {
        ...settings,
        guildId,
        updatedAt: new Date(),
      };
      await this.collection.updateOne(
        { guildId },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
      return doc;
    } catch (error) {
      this.logger.error(
        `Failed to set Twitch chat filters for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async updateFilter(guildId, filterName, filterSettings) {
    try {
      const set = { updatedAt: new Date() };
      set[filterName] = filterSettings;

      const result = await this.collection.updateOne(
        { guildId },
        { $set: set, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update Twitch chat filter ${filterName} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async setEnabled(guildId, enabled) {
    try {
      const result = await this.collection.updateOne(
        { guildId },
        {
          $set: { enabled, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to set Twitch chat filters enabled for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }
}
