import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for tracking guild join/leave history
 * @extends BaseRepository
 */
export class GuildHistoryRepository extends BaseRepository {
  /**
   * @param {object} db - MongoDB database instance
   * @param {object} cache - Cache manager instance
   * @param {object} logger - Logger instance
   */
  constructor(db, cache, logger) {
    super(db, "guild_history", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Create indexes for efficient queries
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ guildId: 1 }, { unique: true });
      await this.collection.createIndex({ status: 1 });
    } catch (error) {
      this.logger?.error("Error creating guild_history indexes:", error);
    }
  }

  /**
   * Record a guild join
   * @param {string} guildId - Discord guild ID
   * @param {string} name - Guild name
   * @param {string|null} icon - Guild icon hash
   * @param {string} ownerId - Guild owner ID
   * @param {number} memberCount - Member count
   * @returns {Promise<void>}
   */
  async recordJoin(guildId, name, icon, ownerId, memberCount) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $set: {
            name,
            icon,
            ownerId,
            memberCount,
            status: "active",
            leftAt: null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            guildId,
            joinedAt: new Date(),
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(`Error recording guild join for ${guildId}:`, error);
    }
  }

  /**
   * Record a guild leave
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<void>}
   */
  async recordLeave(guildId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $set: {
            status: "removed",
            leftAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    } catch (error) {
      this.logger.error(`Error recording guild leave for ${guildId}:`, error);
    }
  }

  /**
   * Get all guilds with their status
   * @returns {Promise<Array>}
   */
  async getAll() {
    try {
      return await this.collection
        .find({})
        .sort({ status: 1, name: 1 })
        .toArray();
    } catch (error) {
      this.logger.error("Error getting guild history:", error);
      return [];
    }
  }

  /**
   * Get a single guild record
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object|null>}
   */
  async getByGuild(guildId) {
    try {
      return await this.collection.findOne({ guildId });
    } catch (error) {
      this.logger.error(`Error getting guild history for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Seed initial guild history from Discord client
   * Called on bot startup to ensure all current guilds are tracked
   * @param {object} client - Discord.js client
   * @returns {Promise<number>} Number of guilds seeded
   */
  async seedFromClient(client) {
    try {
      const guilds = client.guilds.cache;
      let seeded = 0;

      for (const [, guild] of guilds) {
        const existing = await this.getByGuild(guild.id);
        if (!existing) {
          await this.recordJoin(
            guild.id,
            guild.name,
            guild.icon,
            guild.ownerId,
            guild.memberCount,
          );
          seeded++;
        } else if (existing.status === "removed") {
          // Guild was previously removed but bot is back
          await this.recordJoin(
            guild.id,
            guild.name,
            guild.icon,
            guild.ownerId,
            guild.memberCount,
          );
          seeded++;
        }
      }

      if (seeded > 0) {
        this.logger.info(`Seeded ${seeded} guilds into guild_history`);
      }
      return seeded;
    } catch (error) {
      this.logger.error("Error seeding guild history:", error);
      return 0;
    }
  }
}
