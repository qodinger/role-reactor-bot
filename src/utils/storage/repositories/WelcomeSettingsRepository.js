import { BaseRepository } from "./BaseRepository.js";

export class WelcomeSettingsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "welcome_settings", cache, logger);
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          enabled: false,
          channelId: null,
          message: "Welcome **{user}** to **{server}**! 🎉",
          autoRoleId: null,
          embedEnabled: true,
          embedColor: 0x7f7bf5,
          embedTitle: "Welcome to {server}!",
          embedDescription: "We're excited to have you join our community!",
          embedThumbnail: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get welcome settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
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
        `Failed to set welcome settings for guild ${guildId}`,
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
        `Failed to delete welcome settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getAllEnabled() {
    try {
      const settings = await this.collection.find({ enabled: true }).toArray();
      return settings;
    } catch (error) {
      this.logger.error("Failed to get all enabled welcome settings", error);
      throw error;
    }
  }
}
