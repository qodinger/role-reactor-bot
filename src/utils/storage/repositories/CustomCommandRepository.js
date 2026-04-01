import { BaseRepository } from "./BaseRepository.js";

export class CustomCommandRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "custom_commands", cache, logger);
  }

  async getByGuild(guildId) {
    const cacheKey = `custom_commands:guild:${guildId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const documents = await this.collection
      .find({ guildId })
      .sort({ createdAt: -1 })
      .toArray();

    this.cache.set(cacheKey, documents);
    return documents;
  }

  async getByGuildPaginated(guildId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const totalCount = await this.collection.countDocuments({ guildId });

    const documents = await this.collection
      .find({ guildId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      commands: documents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  async getByName(guildId, name) {
    const cacheKey = `custom_commands:guild:${guildId}:name:${name}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const doc = await this.collection.findOne({ guildId, name });
    if (doc) this.cache.set(cacheKey, doc);
    return doc;
  }

  async getByAlias(guildId, alias) {
    const cacheKey = `custom_commands:guild:${guildId}:alias:${alias}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const doc = await this.collection.findOne({ guildId, aliases: alias });
    if (doc) this.cache.set(cacheKey, doc);
    return doc;
  }

  async findByNameOrAlias(guildId, name) {
    const command = await this.getByName(guildId, name);
    if (command) return command;
    return this.getByAlias(guildId, name);
  }

  async getById(guildId, commandId) {
    return this.collection.findOne({ guildId, commandId });
  }

  async create(data) {
    await this.collection.insertOne(data);
    this._clearGuildCache(data.guildId);
    return data;
  }

  async update(guildId, commandId, data) {
    await this.collection.updateOne(
      { guildId, commandId },
      { $set: { ...data, updatedAt: new Date() } },
    );
    this._clearGuildCache(guildId);
  }

  async delete(guildId, commandId) {
    await this.collection.deleteOne({ guildId, commandId });
    this._clearGuildCache(guildId);
  }

  async deleteAllForGuild(guildId) {
    await this.collection.deleteMany({ guildId });
    this._clearGuildCache(guildId);
  }

  async countByGuild(guildId) {
    return this.collection.countDocuments({ guildId });
  }

  _clearGuildCache(_guildId) {
    this.cache.clear();
  }
}
