import { BaseRepository } from "./BaseRepository.js";

export class RoleMappingRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "role_mappings", cache, logger);
  }

  async getAll() {
    const cacheKey = "role_mappings:all";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const documents = await this.collection.find({}).toArray();
    const mappings = {};
    for (const doc of documents) {
      mappings[doc.messageId] = {
        guildId: doc.guildId,
        channelId: doc.channelId,
        roles: doc.roles,
      };
    }
    this.cache.set(cacheKey, mappings);
    return mappings;
  }

  async set(messageId, guildId, channelId, roles) {
    await this.collection.updateOne(
      { messageId },
      { $set: { guildId, channelId, roles, updatedAt: new Date() } },
      { upsert: true },
    );
    this.cache.clear();
  }

  async delete(messageId) {
    await this.collection.deleteOne({ messageId });
    this.cache.clear();
  }

  async getByGuildPaginated(guildId, page = 1, limit = 4) {
    const cacheKey = `role_mappings:guild:${guildId}:page:${page}:limit:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;

    // Get total count for this guild
    const totalCount = await this.collection.countDocuments({ guildId });

    // Get paginated results
    const documents = await this.collection
      .find({ guildId })
      .skip(skip)
      .limit(limit)
      .toArray();

    const mappings = {};
    for (const doc of documents) {
      mappings[doc.messageId] = {
        guildId: doc.guildId,
        channelId: doc.channelId,
        roles: doc.roles,
      };
    }

    const result = {
      mappings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    };

    this.cache.set(cacheKey, result);
    return result;
  }
}
