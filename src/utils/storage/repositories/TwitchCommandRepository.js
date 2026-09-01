import { BaseRepository } from "./BaseRepository.js";

export class TwitchCommandRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "twitch_commands", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex(
        { guildId: 1, name: 1 },
        { unique: true },
      );
      await this.collection.createIndex({ guildId: 1 });
      this.logger.debug("TwitchCommandRepository indexes ensured");
    } catch (error) {
      this.logger.warn(
        "Failed to ensure TwitchCommandRepository indexes",
        error,
      );
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
        `Failed to get Twitch command ${name} for guild ${guildId}`,
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
      this.logger.error(
        `Failed to list Twitch commands for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async create(guildId, command) {
    try {
      const doc = {
        guildId,
        name: command.name.toLowerCase(),
        response: command.response,
        description: command.description || null,
        userlevel: command.userlevel || "everyone",
        enabled: command.enabled !== false,
        cooldownMs: command.cooldownMs || 0,
        createdBy: command.createdBy || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(doc);
      this.cache.clear();
      return doc;
    } catch (error) {
      this.logger.error(
        `Failed to create Twitch command for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async update(guildId, name, updates) {
    try {
      const set = { updatedAt: new Date() };
      if (updates.response !== undefined) set.response = updates.response;
      if (updates.description !== undefined)
        set.description = updates.description;
      if (updates.userlevel !== undefined) set.userlevel = updates.userlevel;
      if (updates.enabled !== undefined) set.enabled = updates.enabled;
      if (updates.cooldownMs !== undefined) set.cooldownMs = updates.cooldownMs;

      const result = await this.collection.updateOne(
        { guildId, name: name.toLowerCase() },
        { $set: set },
      );
      this.cache.clear();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update Twitch command ${name} for guild ${guildId}`,
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
        `Failed to remove Twitch command ${name} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }
}
