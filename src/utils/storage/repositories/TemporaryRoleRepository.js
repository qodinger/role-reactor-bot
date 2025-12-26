import { BaseRepository } from "./BaseRepository.js";

export class TemporaryRoleRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "temporary_roles", cache, logger);
  }

  async getAll() {
    const cacheKey = "temporary_roles_all";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const documents = await this.collection.find({}).toArray();
    const tempRoles = {};
    for (const doc of documents) {
      if (!tempRoles[doc.guildId]) tempRoles[doc.guildId] = {};

      // Handle new format with userIds array
      if (doc.userIds && Array.isArray(doc.userIds)) {
        for (const userId of doc.userIds) {
          if (!tempRoles[doc.guildId][userId])
            tempRoles[doc.guildId][userId] = {};
          tempRoles[doc.guildId][userId][doc.roleId] = {
            expiresAt: doc.expiresAt,
            notifyExpiry: doc.notifyExpiry || false,
          };
        }
      } else {
        // Handle old format with single userId
        if (!tempRoles[doc.guildId][doc.userId])
          tempRoles[doc.guildId][doc.userId] = {};
        tempRoles[doc.guildId][doc.userId][doc.roleId] = {
          expiresAt: doc.expiresAt,
          notifyExpiry: doc.notifyExpiry || false,
        };
      }
    }
    this.cache.set(cacheKey, tempRoles);
    return tempRoles;
  }

  async add(guildId, userId, roleId, expiresAt, notifyExpiry = false) {
    await this.collection.updateOne(
      { guildId, userId, roleId },
      { $set: { expiresAt, notifyExpiry, updatedAt: new Date() } },
      { upsert: true },
    );
    this.cache.clear();
  }

  async addMultiple(guildId, userIds, roleId, expiresAt, notifyExpiry = false) {
    // Create a single document with userIds array for efficiency
    await this.collection.insertOne({
      guildId,
      userIds, // Array of user IDs
      roleId,
      expiresAt,
      notifyExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.cache.clear();
  }

  async findExpired() {
    return this.collection.find({ expiresAt: { $lte: new Date() } }).toArray();
  }

  async delete(guildId, userId, roleId) {
    const result = await this.collection.deleteOne({ guildId, userId, roleId });
    if (result.deletedCount > 0) {
      this.cache.clear();
    }
    return result.deletedCount > 0;
  }

  // Supporter management methods
  async addSupporter(guildId, userId, roleId, assignedAt, reason) {
    try {
      await this.collection.updateOne(
        { guildId, userId, roleId, type: "supporter" },
        {
          $set: {
            assignedAt,
            reason,
            isActive: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to add supporter role", error);
      return false;
    }
  }

  async removeSupporter(guildId, userId) {
    try {
      const result = await this.collection.deleteOne({
        guildId,
        userId,
        type: "supporter",
      });
      if (result.deletedCount > 0) {
        this.cache.clear();
      }
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error("Failed to remove supporter role", error);
      return false;
    }
  }

  async getSupporters(guildId) {
    try {
      const documents = await this.collection
        .find({
          guildId,
          type: "supporter",
        })
        .toArray();
      return documents;
    } catch (error) {
      this.logger.error("Failed to get supporters", error);
      return [];
    }
  }
}
