import { BaseRepository } from "./BaseRepository.js";

export class AutomodRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "guild_automod", cache, logger);
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ guildId: 1 }, { unique: true });
      this.logger.debug("AutomodRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure AutomodRepository indexes", error);
    }
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return settings || this.getDefaultSettings(guildId);
    } catch (error) {
      this.logger.error(
        `Failed to get automod settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  getDefaultSettings(guildId) {
    return {
      guildId,
      enabled: false,
      badWords: {
        enabled: false,
        words: [],
        action: "delete",
        timeoutDuration: 5,
        ignoreAdmins: false,
      },
      links: {
        enabled: false,
        blockUrls: true,
        allowedDomains: [],
        action: "delete",
        ignoreAdmins: false,
      },
      spam: {
        enabled: false,
        repeatedMessages: 3,
        rateThreshold: 5,
        action: "timeout",
        timeoutDuration: 5,
        ignoreAdmins: false,
      },
      mentionSpam: {
        enabled: false,
        mentionCount: 5,
        action: "delete",
        timeoutDuration: 5,
        ignoreAdmins: false,
      },
      inviteLink: {
        enabled: false,
        action: "delete",
        timeoutDuration: 5,
        ignoreAdmins: false,
      },
      capsLock: {
        enabled: false,
        threshold: 70,
        minLength: 10,
        action: "delete",
        timeoutDuration: 5,
        ignoreAdmins: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async set(guildId, settings) {
    try {
      await this.collection.updateOne(
        { guildId },
        { $set: { ...settings, guildId, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to set automod settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async enable(guildId, enabled) {
    try {
      await this.collection.updateOne(
        { guildId },
        { $set: { enabled, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to ${enabled ? "enable" : "disable"} automod for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async delete(guildId) {
    try {
      await this.collection.deleteOne({ guildId });
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to delete automod settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }
}
