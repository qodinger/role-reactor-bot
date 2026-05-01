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
      channels: {},
      analytics: {
        totalViolations: 0,
        violationsByType: {
          bad_words: 0,
          link: 0,
          spam: 0,
          mention_spam: 0,
          invite_link: 0,
          caps_lock: 0,
        },
        violationsByDay: {},
      },
      logs: [],
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

  async getChannelSettings(guildId, channelId) {
    const settings = await this.getByGuild(guildId);
    return settings.channels?.[channelId] || null;
  }

  async setChannelSettings(guildId, channelId, channelSettings) {
    try {
      const update = {};
      update[`channels.${channelId}`] = channelSettings;
      await this.collection.updateOne(
        { guildId },
        { $set: { ...update, updatedAt: new Date() } },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to set channel settings for ${channelId} in guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async deleteChannelSettings(guildId, channelId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $unset: { [`channels.${channelId}`]: 1 },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to delete channel settings for ${channelId} in guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getChannelSettingsList(guildId) {
    const settings = await this.getByGuild(guildId);
    return settings.channels || {};
  }

  async recordViolation(guildId, violation) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const statsUpdate = {
        "analytics.totalViolations": 1,
        [`analytics.violationsByType.${violation.type}`]: 1,
        [`analytics.violationsByDay.${today}.${violation.type}`]: 1,
      };
      await this.collection.updateOne(
        { guildId },
        {
          $inc: statsUpdate,
          $push: {
            logs: {
              $each: [violation],
              $position: 0,
              $slice: 1000,
            },
          },
          $set: { updatedAt: new Date() },
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to record violation for guild ${guildId}`,
        error,
      );
    }
  }

  async getAnalytics(guildId) {
    const settings = await this.getByGuild(guildId);
    return (
      settings.analytics || {
        totalViolations: 0,
        violationsByType: {},
        violationsByDay: {},
      }
    );
  }

  async getLogs(guildId, limit = 100) {
    const settings = await this.getByGuild(guildId);
    return (settings.logs || []).slice(0, limit);
  }

  async clearLogs(guildId) {
    try {
      await this.collection.updateOne(
        { guildId },
        { $set: { logs: [], updatedAt: new Date() } },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(`Failed to clear logs for guild ${guildId}`, error);
      throw error;
    }
  }
}
