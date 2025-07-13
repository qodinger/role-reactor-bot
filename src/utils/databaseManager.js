import { MongoClient } from "mongodb";

class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionPromise = null;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async connect() {
    // Prevent multiple connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
      const dbName = process.env.MONGODB_DB || "role-reactor-bot";

      const isAtlas =
        mongoUri.includes("mongodb+srv://") ||
        mongoUri.includes(".mongodb.net");

      // Optimized connection options for faster startup
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000, // Faster timeout
        connectTimeoutMS: 10000, // Faster connection timeout
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
        w: "majority",
      };

      if (isAtlas) {
        console.log("🔐 Using MongoDB Atlas connection");
      } else {
        console.log("🔓 Using local MongoDB connection");
      }

      // Use optimized options for MongoClient
      this.client = new MongoClient(mongoUri, options);
      await this.client.connect();

      this.db = this.client.db(dbName);
      this.isConnected = true;

      // Create indexes for better performance (non-blocking)
      this._createIndexes().catch(error => {
        console.warn("⚠️ Index creation failed (non-critical):", error.message);
      });

      console.log(`✅ Connected to MongoDB database: ${dbName}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB database:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async _createIndexes() {
    const roleMappingsCollection = this.db.collection("role_mappings");
    const temporaryRolesCollection = this.db.collection("temporary_roles");

    // Role mappings indexes
    await roleMappingsCollection.createIndex(
      { messageId: 1 },
      { unique: true },
    );
    await roleMappingsCollection.createIndex({ guildId: 1 });
    await roleMappingsCollection.createIndex({ updatedAt: 1 });

    // Temporary roles indexes
    await temporaryRolesCollection.createIndex({ guildId: 1, userId: 1 });
    await temporaryRolesCollection.createIndex({ expiresAt: 1 });
    await temporaryRolesCollection.createIndex(
      { guildId: 1, userId: 1, roleId: 1 },
      { unique: true },
    );
    await temporaryRolesCollection.createIndex({ createdAt: 1 });
  }

  // Cache management
  _getCacheKey(collection, query) {
    return `${collection}:${JSON.stringify(query)}`;
  }

  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  _getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  _clearCache() {
    this.cache.clear();
  }

  // Role mappings methods
  async getRoleMappings() {
    const cacheKey = this._getCacheKey("role_mappings", {});
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      const collection = this.db.collection("role_mappings");
      const documents = await collection.find({}).toArray();

      const mappings = {};
      for (const doc of documents) {
        mappings[doc.messageId] = {
          guildId: doc.guildId,
          channelId: doc.channelId,
          roles: doc.roles,
        };
      }

      this._setCache(cacheKey, mappings);
      return mappings;
    } catch (error) {
      console.error("❌ Failed to get role mappings:", error);
      return {};
    }
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    try {
      const collection = this.db.collection("role_mappings");
      await collection.updateOne(
        { messageId },
        {
          $set: {
            messageId,
            guildId,
            channelId,
            roles,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Clear cache for role mappings
      this._clearCache();
      console.log(`💾 Saved role mapping for message ${messageId}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to save role mapping:", error);
      return false;
    }
  }

  async deleteRoleMapping(messageId) {
    try {
      const collection = this.db.collection("role_mappings");
      await collection.deleteOne({ messageId });

      // Clear cache for role mappings
      this._clearCache();
      console.log(`🗑️ Deleted role mapping for message ${messageId}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to delete role mapping:", error);
      return false;
    }
  }

  // Temporary roles methods
  async getTemporaryRoles() {
    const cacheKey = this._getCacheKey("temporary_roles", {});
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    try {
      // Clean up expired roles first
      await this.cleanupExpiredRoles();

      const collection = this.db.collection("temporary_roles");
      const documents = await collection.find({}).toArray();

      const tempRoles = {};
      for (const doc of documents) {
        if (!tempRoles[doc.guildId]) tempRoles[doc.guildId] = {};
        if (!tempRoles[doc.guildId][doc.userId])
          tempRoles[doc.guildId][doc.userId] = {};
        tempRoles[doc.guildId][doc.userId][doc.roleId] = {
          expiresAt: doc.expiresAt,
        };
      }

      this._setCache(cacheKey, tempRoles);
      return tempRoles;
    } catch (error) {
      console.error("❌ Failed to get temporary roles:", error);
      return {};
    }
  }

  async addTemporaryRole(guildId, userId, roleId, expiresAt) {
    try {
      const collection = this.db.collection("temporary_roles");
      await collection.updateOne(
        { guildId, userId, roleId },
        {
          $set: {
            guildId,
            userId,
            roleId,
            expiresAt,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Clear cache for temporary roles
      this._clearCache();
      console.log(
        `💾 Added temporary role ${roleId} for user ${userId} in guild ${guildId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to add temporary role:", error);
      return false;
    }
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    try {
      const collection = this.db.collection("temporary_roles");
      await collection.deleteOne({ guildId, userId, roleId });

      // Clear cache for temporary roles
      this._clearCache();
      console.log(
        `🗑️ Removed temporary role ${roleId} for user ${userId} in guild ${guildId}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to remove temporary role:", error);
      return false;
    }
  }

  async cleanupExpiredRoles() {
    try {
      const collection = this.db.collection("temporary_roles");
      const result = await collection.deleteMany({
        expiresAt: { $lte: new Date() },
      });

      const deletedCount = result.deletedCount;
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired temporary roles`);
        this._clearCache(); // Clear cache when data changes
      }

      return deletedCount;
    } catch (error) {
      console.error("❌ Failed to cleanup expired roles:", error);
      return 0;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log("🔌 MongoDB database connection closed");
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) return false;
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error("❌ Database health check failed:", error);
      return false;
    }
  }
}

// Singleton instance
let databaseManager = null;

export async function getDatabaseManager() {
  if (!databaseManager) {
    databaseManager = new DatabaseManager();
    await databaseManager.connect();
  }
  return databaseManager;
}

export { DatabaseManager };
