import { BaseRepository } from "./BaseRepository.js";

export class StarboardSettingsRepository extends BaseRepository {
  constructor(db, cacheManager, logger) {
    super(db, "starboard_settings", cacheManager, logger);
  }

  async getSettings(guildId) {
    const cacheKey = `starboard_settings:${guildId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.collection.findOne({ guildId });
    const settings = result || {
      guildId,
      channelId: null,
      emoji: "⭐",
      threshold: 3,
      enabled: false,
    };

    this.cache.set(cacheKey, settings);
    return settings;
  }

  async updateSettings(guildId, settings) {
    const result = await this.collection.findOneAndUpdate(
      { guildId },
      {
        $set: {
          ...settings,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    this.cache.delete(`starboard_settings:${guildId}`);
    return result;
  }
}
