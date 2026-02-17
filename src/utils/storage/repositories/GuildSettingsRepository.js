import { BaseRepository } from "./BaseRepository.js";

export class GuildSettingsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "guild_settings", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ guildId: 1 }, { unique: true });
      this.logger.debug("GuildSettingsRepository indexes ensured");
    } catch (error) {
      this.logger.warn(
        "Failed to ensure GuildSettingsRepository indexes",
        error,
      );
    }
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          experienceSystem: {
            enabled: false,
            messageXP: true,
            commandXP: true,
            roleXP: true,
            voiceXP: true,
            messageXPAmount: { min: 15, max: 25 },
            commandXPAmount: {
              base: 8,
            },
            roleXPAmount: 50,
            messageCooldown: 60,
            commandCooldown: 30,
            levelUpMessages: true,
            levelUpChannel: null,
            // Level formula is fixed at 100 * level^1.5 - no longer configurable
          },
          disabledCommands: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get guild settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async set(guildId, settings) {
    try {
      // Strip _id to avoid immutable field error
      const { _id, ...safeSettings } = settings;
      await this.collection.updateOne(
        { guildId },
        { $set: { ...safeSettings, guildId, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to set guild settings for guild ${guildId}`,
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
        `Failed to delete guild settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getAllWithExperienceEnabled() {
    try {
      const settings = await this.collection
        .find({ "experienceSystem.enabled": true })
        .toArray();
      return settings;
    } catch (error) {
      this.logger.error(
        "Failed to get all guilds with experience enabled",
        error,
      );
      throw error;
    }
  }

  // Supporter management methods
  async getSupporters() {
    try {
      const supporters = await this.collection
        .find({}, { projection: { supporters: 1 } })
        .toArray();

      const allSupporters = {};
      supporters.forEach(guild => {
        if (guild.supporters) {
          allSupporters[guild.guildId] = guild.supporters;
        }
      });

      return allSupporters;
    } catch (error) {
      this.logger.error("Failed to get supporters", error);
      return {};
    }
  }

  async setSupporters(supporters) {
    try {
      // Update each guild's supporters
      for (const [guildId, guildSupporters] of Object.entries(supporters)) {
        await this.collection.updateOne(
          { guildId },
          { $set: { supporters: guildSupporters, updatedAt: new Date() } },
          { upsert: true },
        );
      }
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to set supporters", error);
      return false;
    }
  }
}
