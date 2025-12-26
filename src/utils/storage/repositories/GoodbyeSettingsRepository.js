import { BaseRepository } from "./BaseRepository.js";

export class GoodbyeSettingsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "goodbye_settings", cache, logger);
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          enabled: false,
          channelId: null,
          message:
            "**{user}** left the server\nThanks for being part of **{server}**! 👋",
          embedEnabled: true,
          embedColor: 0x7f7bf5,
          embedTitle: "👋 Goodbye from {server}!",
          embedDescription: "Thanks for being part of our community!",
          embedThumbnail: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get goodbye settings for guild ${guildId}`,
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
        `Failed to set goodbye settings for guild ${guildId}`,
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
        `Failed to delete goodbye settings for guild ${guildId}`,
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
      this.logger.error("Failed to get all enabled goodbye settings", error);
      throw error;
    }
  }
}
