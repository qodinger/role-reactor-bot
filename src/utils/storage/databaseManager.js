import { MongoClient } from "mongodb";
import { getLogger } from "../logger.js";
import config from "../../config/config.js";

// Enhanced cache manager with TTL and size limits
class CacheManager {
  constructor(timeout = 5 * 60 * 1000, maxSize = 1000) {
    this.cache = new Map();
    this.timeout = timeout;
    this.maxSize = maxSize;
    this.accessOrder = []; // Track access order for LRU eviction
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.timestamp > this.timeout) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    return cached.data;
  }

  set(key, data) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    this.updateAccessOrder(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  updateAccessOrder(key) {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  evictOldest() {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.timeout) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }
  }
}

// Query cache for frequently accessed data
class QueryCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 2 * 60 * 1000; // 2 minutes for query results
    this.maxSize = 500;
  }

  get(queryKey) {
    const cached = this.cache.get(queryKey);
    if (!cached || Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(queryKey);
      return null;
    }
    return cached.data;
  }

  set(queryKey, data) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(queryKey, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }

  // Invalidate cache for specific collection
  invalidateCollection(collectionName) {
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(collectionName)) {
        this.cache.delete(key);
      }
    }
  }
}

const queryCache = new QueryCache();

// Cleanup caches every 5 minutes
setInterval(
  () => {
    queryCache.clear();
  },
  5 * 60 * 1000,
).unref();

class ConnectionManager {
  constructor(logger, dbConfig) {
    this.logger = logger;
    this.config = dbConfig;
    this.client = null;
    this.db = null;
    this.connectionPromise = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.healthCheckInterval = null;
    this.connectionPool = new Map(); // Connection pool for different operations
  }

  async connect() {
    if (this.connectionPromise && this.isConnected)
      return this.connectionPromise;
    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    let timeoutId = null;
    try {
      this.logger.info("🔌 Attempting to connect to MongoDB...");
      this.client = new MongoClient(this.config.uri, {
        ...this.config.options,
        // Enhanced connection pooling
        maxPoolSize: Math.max(20, this.config.options.maxPoolSize || 20),
        minPoolSize: Math.max(5, this.config.options.minPoolSize || 5),
        maxIdleTimeMS: Math.max(
          60000,
          this.config.options.maxIdleTimeMS || 60000,
        ),
        serverSelectionTimeoutMS: Math.max(
          15000,
          this.config.options.serverSelectionTimeoutMS || 15000,
        ),
        connectTimeoutMS: Math.max(
          15000,
          this.config.options.connectTimeoutMS || 15000,
        ),
        socketTimeoutMS: Math.max(
          60000,
          this.config.options.socketTimeoutMS || 60000,
        ),
        retryWrites: true,
        retryReads: true,
        w: "majority",
        // Enhanced reconnection options
        heartbeatFrequencyMS: 10000,
        // Add connection optimization
        maxConnecting: Math.max(5, this.config.options.maxConnecting || 5),
        // Connection pool monitoring
        monitorCommands: true,
        serverApi: {
          version: "1",
          strict: false,
          deprecationErrors: false,
        },
      });

      const connection = this.client.connect();
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(new Error("MongoDB connection timeout after 15 seconds")),
          15000,
        );
      });

      await Promise.race([connection, timeout]);
      this.logger.success("✅ MongoDB connection established");
      this.db = this.client.db(this.config.name);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Set up connection monitoring
      this._setupConnectionMonitoring();

      await this._createIndexes();
      return this.db;
    } catch (error) {
      this.logger.error("❌ Failed to connect to MongoDB", error);
      this.isConnected = false;

      // Attempt reconnection if we haven't exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.logger.info(
          `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`,
        );

        setTimeout(() => {
          this.connectionPromise = null; // Reset promise to allow retry
          this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
      } else {
        this.logger.error(
          "❌ Max reconnection attempts reached. Manual restart required.",
        );
        throw error;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  _setupConnectionMonitoring() {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.client && this.db) {
          await this.db.admin().ping();
          if (!this.isConnected) {
            this.logger.success("✅ MongoDB connection restored");
            this.isConnected = true;
            this.reconnectAttempts = 0;
          }
        }
      } catch (_error) {
        if (this.isConnected) {
          this.logger.warn(
            "⚠️ MongoDB connection lost, attempting to reconnect...",
          );
          this.isConnected = false;
          this._attemptReconnect();
        }
      }
    }, 30000).unref(); // Check every 30 seconds and prevent keeping process alive
  }

  async _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        "❌ Max reconnection attempts reached. Manual restart required.",
      );
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(
      `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`,
    );

    setTimeout(async () => {
      try {
        this.connectionPromise = null; // Reset promise
        await this._connect();
      } catch (error) {
        this.logger.error("❌ Reconnection attempt failed", error);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  async _createIndexes() {
    try {
      this.logger.info("🔧 Creating database indexes...");
      await this.db
        .collection("role_mappings")
        .createIndex({ messageId: 1 }, { unique: true });
      await this.db.collection("temporary_roles").createIndex({ expiresAt: 1 });
      await this.db
        .collection("temporary_roles")
        .createIndex({ guildId: 1, userId: 1, roleId: 1 }, { unique: true });
      await this.db
        .collection("welcome_settings")
        .createIndex({ guildId: 1 }, { unique: true });
      await this.db
        .collection("user_experience")
        .createIndex({ guildId: 1, userId: 1 }, { unique: true });
      this.logger.success("✅ Database indexes created successfully");
    } catch (error) {
      this.logger.warn("⚠️ Index creation failed (non-critical)", error);
    }
  }

  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client) {
      await this.client.close();
      this.logger.info("🔌 MongoDB connection closed");
      this.isConnected = false;
    }
  }

  isConnectionHealthy() {
    return this.isConnected && this.client && this.db;
  }
}

class BaseRepository {
  constructor(db, collectionName, cache, logger) {
    this.db = db;
    this.collection = db.collection(collectionName);
    this.cache = cache;
    this.logger = logger;
  }
}

class RoleMappingRepository extends BaseRepository {
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
}

class TemporaryRoleRepository extends BaseRepository {
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
      if (!tempRoles[doc.guildId][doc.userId])
        tempRoles[doc.guildId][doc.userId] = {};
      tempRoles[doc.guildId][doc.userId][doc.roleId] = {
        expiresAt: doc.expiresAt,
      };
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

class UserExperienceRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "user_experience", cache, logger);
  }

  async getAll() {
    try {
      const documents = await this.collection.find({}).toArray();
      this.cache.set("user_experience_all", documents);
      return documents;
    } catch (error) {
      this.logger.error("Failed to get all user experience data", error);
      throw error;
    }
  }

  async getByGuild(guildId) {
    try {
      const documents = await this.collection.find({ guildId }).toArray();
      return documents;
    } catch (error) {
      this.logger.error(
        `Failed to get user experience data for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getByUser(guildId, userId) {
    try {
      const userData = await this.collection.findOne({ guildId, userId });
      return (
        userData || { guildId, userId, xp: 0, level: 1, lastMessageAt: null }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async set(guildId, userId, userData) {
    try {
      await this.collection.updateOne(
        { guildId, userId },
        { $set: { ...userData, guildId, userId, updatedAt: new Date() } },
        { upsert: true },
      );
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to set user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async delete(guildId, userId) {
    try {
      await this.collection.deleteOne({ guildId, userId });
      this.cache.clear();
    } catch (error) {
      this.logger.error(
        `Failed to delete user experience for ${userId} in ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getLeaderboard(guildId, limit = 10) {
    try {
      const leaderboard = await this.collection
        .find({ guildId })
        // Sort by totalXP (primary) then level (secondary)
        .sort({ totalXP: -1, level: -1 })
        .limit(limit)
        .toArray();
      return leaderboard;
    } catch (error) {
      this.logger.error(
        `Failed to get leaderboard for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }
}

class WelcomeSettingsRepository extends BaseRepository {
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
          message: "Welcome {user} to {server}! 🎉",
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

class GuildSettingsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "guild_settings", cache, logger);
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          experienceSystem: {
            enabled: false,
            messageXP: true,
            commandXP: true,
            roleXP: true,
            messageXPAmount: { min: 15, max: 25 },
            commandXPAmount: {
              base: 8,
            },
            roleXPAmount: 50,
            messageCooldown: 60,
            commandCooldown: 30,
            // Level formula is fixed at 100 * level^1.5 - no longer configurable
          },

          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get guild settings for guild ${guildId}`,
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
        `Failed to set guild settings for guild ${guildId}`,
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
        `Failed to delete guild settings for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getAllWithExperienceEnabled() {
    try {
      const settings = await this.collection
        .find({ "experienceSystem.enabled": true })
        .toArray();
      return settings;
    } catch (error) {
      this.logger.error(
        "Failed to get all guilds with experience enabled",
        error,
      );
      throw error;
    }
  }

  // Supporter management methods
  async getSupporters() {
    try {
      const supporters = await this.collection
        .find({}, { projection: { supporters: 1 } })
        .toArray();

      const allSupporters = {};
      supporters.forEach(guild => {
        if (guild.supporters) {
          allSupporters[guild.guildId] = guild.supporters;
        }
      });

      return allSupporters;
    } catch (error) {
      this.logger.error("Failed to get supporters", error);
      return {};
    }
  }

  async setSupporters(supporters) {
    try {
      // Update each guild's supporters
      for (const [guildId, guildSupporters] of Object.entries(supporters)) {
        await this.collection.updateOne(
          { guildId },
          { $set: { supporters: guildSupporters, updatedAt: new Date() } },
          { upsert: true },
        );
      }
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to set supporters", error);
      return false;
    }
  }
}

class DatabaseManager {
  constructor() {
    this.logger = getLogger();
    this.connectionManager = new ConnectionManager(
      this.logger,
      config.database,
    );
    this.cacheManager = new CacheManager();
    this.roleMappings = null;
    this.temporaryRoles = null;
    this.userExperience = null;
    this.welcomeSettings = null;
    this.guildSettings = null;
  }

  async connect() {
    try {
      const db = await this.connectionManager.connect();
      if (db) {
        this.roleMappings = new RoleMappingRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.temporaryRoles = new TemporaryRoleRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.userExperience = new UserExperienceRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.welcomeSettings = new WelcomeSettingsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.guildSettings = new GuildSettingsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.logger.info(
          "✅ All database repositories initialized successfully",
        );
      } else {
        this.logger.error("❌ Failed to connect to database");
        throw new Error("Database connection failed");
      }
    } catch (error) {
      this.logger.error("❌ Failed to initialize database repositories", error);
      throw error;
    }
  }

  async close() {
    await this.connectionManager.close();
  }

  async healthCheck() {
    if (!this.connectionManager.isConnectionHealthy()) return false;
    try {
      await this.connectionManager.db.admin().ping();
      return true;
    } catch (error) {
      this.logger.error("❌ Database health check failed", error);
      return false;
    }
  }
}

let databaseManager = null;

export async function getDatabaseManager() {
  if (!databaseManager) {
    databaseManager = new DatabaseManager();
    try {
      await databaseManager.connect();
    } catch (error) {
      // Log the error but don't throw - let the storage manager fall back to files
      databaseManager.logger.warn(
        "⚠️ Database connection failed, storage manager will use file fallback:",
        error.message,
      );
      return null;
    }
  }

  // Check if repositories are properly initialized
  if (!databaseManager.welcomeSettings) {
    // Try to reconnect if repositories are not initialized
    try {
      await databaseManager.connect();
    } catch (error) {
      databaseManager.logger.warn(
        "⚠️ Database reconnection failed:",
        error.message,
      );
      return null;
    }

    // Check again after reconnection attempt
    if (!databaseManager.welcomeSettings) {
      databaseManager.logger.warn(
        "⚠️ Database repositories not properly initialized",
      );
      return null;
    }
  }

  return databaseManager;
}
