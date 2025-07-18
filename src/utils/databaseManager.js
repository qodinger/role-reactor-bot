import { MongoClient } from "mongodb";
import { getLogger } from "./logger.js";
import config from "../config/config.js";

class DatabaseManager {
  constructor() {
    this.logger = getLogger();
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
      const { uri, name, options } = config.database;

      this.logger.info("🔌 Attempting to connect to MongoDB...");
      this.logger.info(
        `📍 Connection URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`,
      ); // Hide credentials
      this.logger.info(`📊 Database name: ${name}`);

      const isAtlas =
        uri.includes("mongodb+srv://") || uri.includes(".mongodb.net");

      if (isAtlas) {
        this.logger.info("🔐 Using MongoDB Atlas connection");
      } else {
        this.logger.info("🔓 Using local MongoDB connection");
      }

      // Use optimized options for MongoClient
      this.client = new MongoClient(uri, options);

      this.logger.info("⏳ Connecting to MongoDB...");

      // Add timeout to prevent hanging
      const connectionPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("MongoDB connection timeout after 15 seconds"));
        }, 15000); // 15 second timeout
      });

      await Promise.race([connectionPromise, timeoutPromise]);
      this.logger.success("✅ MongoDB connection established");

      this.db = this.client.db(name);
      this.isConnected = true;

      // Create indexes for better performance (non-blocking)
      this.logger.info("🔧 Creating database indexes...");
      this._createIndexes().catch(error => {
        this.logger.warn("⚠️ Index creation failed (non-critical)", {
          error: error.message,
        });
      });

      this.logger.success(`✅ Connected to MongoDB database: ${name}`);
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to connect to MongoDB database", error);
      this.logger.warn("⚠️ Continuing without database connection");
      this.logger.info(
        "💡 To enable database features, ensure MongoDB is running or set a valid MONGODB_URI",
      );
      this.isConnected = false;
      return true; // Don't throw error, continue without database
    }
  }

  async _createIndexes() {
    const roleMappingsCollection = this.db.collection("role_mappings");
    const temporaryRolesCollection = this.db.collection("temporary_roles");

    this.logger.info("📋 Creating role_mappings indexes...");
    // Role mappings indexes
    await roleMappingsCollection.createIndex(
      { messageId: 1 },
      { unique: true },
    );
    await roleMappingsCollection.createIndex({ guildId: 1 });
    await roleMappingsCollection.createIndex({ updatedAt: 1 });

    this.logger.info("📋 Creating temporary_roles indexes...");
    // Temporary roles indexes
    await temporaryRolesCollection.createIndex({ guildId: 1, userId: 1 });
    await temporaryRolesCollection.createIndex({ expiresAt: 1 });
    await temporaryRolesCollection.createIndex(
      { guildId: 1, userId: 1, roleId: 1 },
      { unique: true },
    );
    await temporaryRolesCollection.createIndex({ createdAt: 1 });

    this.logger.success("✅ Database indexes created successfully");
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
    if (!this.isConnected) {
      this.logger.warn("⚠️ Database not connected, returning empty mappings");
      return {};
    }

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
      this.logger.error("❌ Failed to get role mappings", error);
      return {};
    }
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    if (!this.isConnected) {
      this.logger.warn("⚠️ Database not connected, skipping role mapping save");
      return false;
    }

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
      this.logger.info(`💾 Saved role mapping for message ${messageId}`);
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to save role mapping", error);
      return false;
    }
  }

  async deleteRoleMapping(messageId) {
    if (!this.isConnected) {
      this.logger.warn(
        "⚠️ Database not connected, skipping role mapping deletion",
      );
      return false;
    }

    try {
      const collection = this.db.collection("role_mappings");
      await collection.deleteOne({ messageId });

      // Clear cache for role mappings
      this._clearCache();
      this.logger.info(`🗑️ Deleted role mapping for message ${messageId}`);
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to delete role mapping", error);
      return false;
    }
  }

  // Temporary roles methods
  async getTemporaryRoles() {
    if (!this.isConnected) {
      this.logger.warn(
        "⚠️ Database not connected, returning empty temporary roles",
      );
      return {};
    }

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
      this.logger.error("❌ Failed to get temporary roles", error);
      return {};
    }
  }

  async addTemporaryRole(guildId, userId, roleId, expiresAt) {
    if (!this.isConnected) {
      this.logger.warn(
        "⚠️ Database not connected, skipping temporary role addition",
      );
      return false;
    }

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
      this.logger.info(
        `💾 Added temporary role ${roleId} for user ${userId} in guild ${guildId}`,
      );
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to add temporary role", error);
      return false;
    }
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    if (!this.isConnected) {
      this.logger.warn(
        "⚠️ Database not connected, skipping temporary role removal",
      );
      return false;
    }

    try {
      const collection = this.db.collection("temporary_roles");
      await collection.deleteOne({ guildId, userId, roleId });

      // Clear cache for temporary roles
      this._clearCache();
      this.logger.info(
        `🗑️ Removed temporary role ${roleId} for user ${userId} in guild ${guildId}`,
      );
      return true;
    } catch (error) {
      this.logger.error("❌ Failed to remove temporary role", error);
      return false;
    }
  }

  async cleanupExpiredRoles() {
    if (!this.isConnected) {
      this.logger.warn(
        "⚠️ Database not connected, skipping expired roles cleanup",
      );
      return 0;
    }

    try {
      const collection = this.db.collection("temporary_roles");
      const result = await collection.deleteMany({
        expiresAt: { $lte: new Date() },
      });

      const deletedCount = result.deletedCount;
      if (deletedCount > 0) {
        this.logger.info(
          `🧹 Cleaned up ${deletedCount} expired temporary roles`,
        );
        this._clearCache(); // Clear cache when data changes
      }

      return deletedCount;
    } catch (error) {
      this.logger.error("❌ Failed to cleanup expired roles", error);
      return 0;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info("🔌 MongoDB database connection closed");
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) {
        this.logger.warn("⚠️ Database not connected, health check failed");
        return false;
      }
      await this.db.admin().ping();
      return true;
    } catch (error) {
      this.logger.error("❌ Database health check failed", error);
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
