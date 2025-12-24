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

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
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
        // Enhanced connection pooling - optimized for cost savings
        // Lower minPoolSize reduces compute usage on MongoDB Atlas Flex tier
        maxPoolSize: Math.max(2, this.config.options.maxPoolSize || 20),
        minPoolSize: Math.max(2, this.config.options.minPoolSize || 2),
        maxIdleTimeMS: Math.max(
          60000,
          this.config.options.maxIdleTimeMS || 60000,
        ),
        serverSelectionTimeoutMS: Math.max(
          30000, // Increased from 15000 for DNS resolution
          this.config.options.serverSelectionTimeoutMS || 30000,
        ),
        connectTimeoutMS: Math.max(
          30000, // Increased from 15000 for DNS resolution
          this.config.options.connectTimeoutMS || 30000,
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
            reject(new Error("MongoDB connection timeout after 30 seconds")),
          30000, // Increased timeout for DNS resolution
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

      // Enhanced error handling for different types of connection issues
      if (error.message.includes("querySrv ETIMEOUT")) {
        this.logger.warn(
          "🌐 DNS resolution timeout - this may be a temporary network issue",
        );
        // Increase delay for DNS-related errors
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      } else if (error.message.includes("ETIMEOUT")) {
        this.logger.warn("⏱️ Connection timeout - network may be slow");
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.2, 20000);
      } else if (error.message.includes("ENOTFOUND")) {
        this.logger.warn(
          "🔍 DNS lookup failed - check MongoDB URI configuration",
        );
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
      }

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

  async _dropOldIndexes() {
    try {
      this.logger.info("🗑️ Dropping old conflicting indexes...");

      // Drop old scheduleId indexes from scheduled_roles and recurring_schedules
      try {
        const scheduledRolesCollection = this.db.collection("scheduled_roles");
        const recurringSchedulesCollection = this.db.collection(
          "recurring_schedules",
        );

        for (const collection of [
          scheduledRolesCollection,
          recurringSchedulesCollection,
        ]) {
          try {
            const indexes = await collection.listIndexes().toArray();
            for (const index of indexes) {
              if (index.name === "scheduleId_1") {
                this.logger.info(
                  `Dropping old index: ${index.name} from ${collection.collectionName}`,
                );
                await collection.dropIndex("scheduleId_1");
              }
            }
          } catch (error) {
            this.logger.debug(
              `No old indexes to drop from ${collection.collectionName}:`,
              error.message,
            );
          }
        }
      } catch (error) {
        this.logger.debug("No old schedule indexes to drop:", error.message);
      }

      // Drop old temporary_roles indexes that conflict with new multi-user format
      try {
        const tempRolesCollection = this.db.collection("temporary_roles");
        const indexes = await tempRolesCollection.listIndexes().toArray();

        for (const index of indexes) {
          if (index.name === "guildId_1_userId_1_roleId_1") {
            this.logger.info(
              `Dropping old index: ${index.name} from temporary_roles`,
            );
            await tempRolesCollection.dropIndex("guildId_1_userId_1_roleId_1");
          }
        }
      } catch (error) {
        this.logger.debug(
          "No old temporary_roles indexes to drop:",
          error.message,
        );
      }

      this.logger.info("✅ Old indexes and data cleanup completed");
    } catch (error) {
      this.logger.warn("⚠️ Old index cleanup failed (non-critical)", error);
    }
  }

  async _createIndexes() {
    try {
      this.logger.info("🔧 Creating database indexes...");

      // Drop old indexes that might conflict
      await this._dropOldIndexes();

      await this.db
        .collection("role_mappings")
        .createIndex({ messageId: 1 }, { unique: true });
      await this.db.collection("temporary_roles").createIndex({ expiresAt: 1 });
      await this.db.collection("temporary_roles").createIndex({ guildId: 1 });
      await this.db.collection("temporary_roles").createIndex({ roleId: 1 });
      await this.db
        .collection("welcome_settings")
        .createIndex({ guildId: 1 }, { unique: true });
      await this.db
        .collection("user_experience")
        .createIndex({ guildId: 1, userId: 1 }, { unique: true });
      await this.db
        .collection("polls")
        .createIndex({ id: 1 }, { unique: true });
      await this.db.collection("polls").createIndex({ guildId: 1 });
      await this.db.collection("polls").createIndex({ createdAt: 1 });
      await this.db
        .collection("core_credits")
        .createIndex({ userId: 1 }, { unique: true });
      await this.db.collection("core_credits").createIndex({ lastUpdated: 1 });
      await this.db
        .collection("scheduled_roles")
        .createIndex({ id: 1 }, { unique: true });
      await this.db.collection("scheduled_roles").createIndex({ guildId: 1 });
      await this.db
        .collection("scheduled_roles")
        .createIndex({ scheduledAt: 1 });
      await this.db.collection("scheduled_roles").createIndex({ executed: 1 });
      await this.db
        .collection("recurring_schedules")
        .createIndex({ id: 1 }, { unique: true });
      await this.db
        .collection("recurring_schedules")
        .createIndex({ guildId: 1 });
      await this.db
        .collection("recurring_schedules")
        .createIndex({ active: 1 });
      await this.db
        .collection("ai_conversations")
        .createIndex({ userId: 1 }, { unique: true });
      await this.db
        .collection("ai_conversations")
        .createIndex({ lastActivity: 1 });
      await this.db
        .collection("avatar_jobs")
        .createIndex({ jobId: 1 }, { unique: true });
      await this.db.collection("avatar_jobs").createIndex({ userId: 1 });
      await this.db.collection("avatar_jobs").createIndex({ createdAt: 1 });
      await this.db.collection("avatar_jobs").createIndex({ expiresAt: 1 });
      await this.db
        .collection("imagine_jobs")
        .createIndex({ jobId: 1 }, { unique: true });
      await this.db.collection("imagine_jobs").createIndex({ userId: 1 });
      await this.db.collection("imagine_jobs").createIndex({ createdAt: 1 });
      await this.db.collection("imagine_jobs").createIndex({ expiresAt: 1 });
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
          message: "Welcome **{user}** to **{server}**! 🎉",
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

class GoodbyeSettingsRepository extends BaseRepository {
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

class VoiceControlRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "voice_control_roles", cache, logger);
  }

  async getByGuild(guildId) {
    try {
      const settings = await this.collection.findOne({ guildId });
      return (
        settings || {
          guildId,
          disconnectRoleIds: [],
          muteRoleIds: [],
          deafenRoleIds: [],
          moveRoleMappings: {}, // roleId -> channelId
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get voice control roles for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addDisconnectRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { disconnectRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice disconnect role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeDisconnectRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { disconnectRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice disconnect role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addMuteRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { muteRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice mute role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeMuteRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { muteRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice mute role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addDeafenRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $addToSet: { deafenRoleIds: roleId },
          $set: { guildId, updatedAt: new Date() },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice deafen role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeDeafenRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $pull: { deafenRoleIds: roleId },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice deafen role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async addMoveRole(guildId, roleId, channelId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $set: {
            [`moveRoleMappings.${roleId}`]: channelId,
            guildId,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add voice move role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async removeMoveRole(guildId, roleId) {
    try {
      await this.collection.updateOne(
        { guildId },
        {
          $unset: { [`moveRoleMappings.${roleId}`]: "" },
          $set: { updatedAt: new Date() },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove voice move role ${roleId} for guild ${guildId}`,
        error,
      );
      throw error;
    }
  }

  async getAll() {
    try {
      return await this.collection.find({}).toArray();
    } catch (error) {
      this.logger.error("Failed to get all voice control roles", error);
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
            voiceXP: true,
            messageXPAmount: { min: 15, max: 25 },
            commandXPAmount: {
              base: 8,
            },
            roleXPAmount: 50,
            messageCooldown: 60,
            commandCooldown: 30,
            levelUpMessages: true,
            levelUpChannel: null,
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

class ConversationRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "ai_conversations", cache, logger);
  }

  async getByUser(userId) {
    try {
      const cached = this.cache.get(`conversation_${userId}`);
      if (cached) return cached;

      const conversation = await this.collection.findOne({ userId });
      if (conversation) {
        this.cache.set(`conversation_${userId}`, conversation);
      }
      return conversation || null;
    } catch (error) {
      this.logger.error(`Failed to get conversation for user ${userId}`, error);
      return null;
    }
  }

  async save(userId, messages, lastActivity) {
    try {
      await this.collection.updateOne(
        { userId },
        {
          $set: {
            messages,
            lastActivity: new Date(lastActivity),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
      this.cache.set(`conversation_${userId}`, {
        userId,
        messages,
        lastActivity,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to save conversation for user ${userId}`,
        error,
      );
      return false;
    }
  }

  async delete(userId) {
    try {
      await this.collection.deleteOne({ userId });
      this.cache.delete(`conversation_${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete conversation for user ${userId}`,
        error,
      );
      return false;
    }
  }

  async deleteExpired(expirationTime) {
    try {
      const result = await this.collection.deleteMany({
        lastActivity: { $lt: new Date(expirationTime) },
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error("Failed to delete expired conversations", error);
      return 0;
    }
  }
}

class ImageJobRepository extends BaseRepository {
  constructor(db, cache, logger, collectionName) {
    super(db, collectionName, cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get(`${this.collection.collectionName}_all`);
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const jobs = {};
      for (const doc of documents) {
        // Use jobId as key, or _id if jobId doesn't exist
        const key = doc.jobId || doc._id.toString();
        // Remove MongoDB _id from the data
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = doc;
        jobs[key] = jobData;
      }

      this.cache.set(`${this.collection.collectionName}_all`, jobs);
      return jobs;
    } catch (error) {
      this.logger.error(
        `Failed to get all jobs from ${this.collection.collectionName}`,
        error,
      );
      return {};
    }
  }

  async getByJobId(jobId) {
    try {
      const cached = this.cache.get(
        `${this.collection.collectionName}_${jobId}`,
      );
      if (cached) return cached;

      const job = await this.collection.findOne({ jobId });
      if (job) {
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = job;
        this.cache.set(`${this.collection.collectionName}_${jobId}`, jobData);
        return jobData;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get job ${jobId} from ${this.collection.collectionName}`,
        error,
      );
      return null;
    }
  }

  async getByUserId(userId, limit = 20) {
    try {
      const cached = this.cache.get(
        `${this.collection.collectionName}_user_${userId}_${limit}`,
      );
      if (cached) return cached;

      const documents = await this.collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const jobs = documents.map(doc => {
        // eslint-disable-next-line no-unused-vars
        const { _id, ...jobData } = doc;
        return { jobId: doc.jobId || doc._id.toString(), ...jobData };
      });

      this.cache.set(
        `${this.collection.collectionName}_user_${userId}_${limit}`,
        jobs,
      );
      return jobs;
    } catch (error) {
      this.logger.error(
        `Failed to get jobs for user ${userId} from ${this.collection.collectionName}`,
        error,
      );
      return [];
    }
  }

  async create(jobId, jobData) {
    try {
      await this.collection.insertOne({
        jobId,
        ...jobData,
        createdAt: new Date(jobData.createdAt || Date.now()),
        expiresAt: new Date(jobData.expiresAt || Date.now()),
      });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create job ${jobId} in ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async update(jobId, jobData) {
    try {
      await this.collection.updateOne(
        { jobId },
        { $set: { ...jobData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update job ${jobId} in ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async delete(jobId) {
    try {
      await this.collection.deleteOne({ jobId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete job ${jobId} from ${this.collection.collectionName}`,
        error,
      );
      return false;
    }
  }

  async deleteExpired() {
    try {
      const result = await this.collection.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete expired jobs from ${this.collection.collectionName}`,
        error,
      );
      return 0;
    }
  }

  async deleteOld(daysToKeep) {
    try {
      const cutoffTime = new Date(
        Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
      );
      // Only delete records without expiresAt or where expiresAt is null/undefined
      // Records with expiresAt should be handled by deleteExpired()
      const result = await this.collection.deleteMany({
        createdAt: { $lt: cutoffTime },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
      });
      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete old jobs from ${this.collection.collectionName}`,
        error,
      );
      return 0;
    }
  }
}

class PollRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "polls", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("polls_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const polls = {};
      for (const doc of documents) {
        polls[doc.id] = doc;
      }

      this.cache.set("polls_all", polls);
      return polls;
    } catch (error) {
      this.logger.error("Failed to get all polls", error);
      return {};
    }
  }

  async getById(pollId) {
    try {
      const cached = this.cache.get(`poll_${pollId}`);
      if (cached) return cached;

      const poll = await this.collection.findOne({ id: pollId });
      if (poll) {
        this.cache.set(`poll_${pollId}`, poll);
      }
      return poll;
    } catch (error) {
      this.logger.error(`Failed to get poll ${pollId}`, error);
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`polls_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const polls = {};
      for (const doc of documents) {
        polls[doc.id] = doc;
      }

      this.cache.set(`polls_guild_${guildId}`, polls);
      return polls;
    } catch (error) {
      this.logger.error(`Failed to get polls for guild ${guildId}`, error);
      return {};
    }
  }

  async getByMessageId(messageId) {
    try {
      const cached = this.cache.get(`poll_message_${messageId}`);
      if (cached) return cached;

      const poll = await this.collection.findOne({ messageId });
      if (poll) {
        this.cache.set(`poll_message_${messageId}`, poll);
      }
      return poll;
    } catch (error) {
      this.logger.error(`Failed to get poll by message ID ${messageId}`, error);
      return null;
    }
  }

  async create(pollData) {
    try {
      await this.collection.insertOne({
        ...pollData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create poll", error);
      return false;
    }
  }

  async update(pollId, pollData) {
    try {
      await this.collection.updateOne(
        { id: pollId },
        { $set: { ...pollData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to update poll ${pollId}`, error);
      return false;
    }
  }

  async delete(pollId) {
    try {
      await this.collection.deleteOne({ id: pollId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete poll ${pollId}`, error);
      return false;
    }
  }

  async cleanupEndedPolls() {
    try {
      const now = new Date();
      const result = await this.collection.deleteMany({
        isActive: false,
        endedAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      }); // Only delete ended polls older than 24 hours

      if (result.deletedCount > 0) {
        this.cache.clear();
        this.logger.info(`Cleaned up ${result.deletedCount} ended polls`);
      }

      return result.deletedCount;
    } catch (error) {
      this.logger.error("Failed to cleanup ended polls", error);
      return 0;
    }
  }
}

class CoreCreditsRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "core_credits", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("core_credits_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const coreCredits = {};
      for (const doc of documents) {
        coreCredits[doc.userId] = doc;
      }

      this.cache.set("core_credits_all", coreCredits);
      return coreCredits;
    } catch (error) {
      this.logger.error("Failed to get all core credits", error);
      return {};
    }
  }

  async getByUserId(userId) {
    try {
      const cached = this.cache.get(`core_credits_${userId}`);
      if (cached) return cached;

      const userData = await this.collection.findOne({ userId });
      if (userData) {
        this.cache.set(`core_credits_${userId}`, userData);
      }
      return userData;
    } catch (error) {
      this.logger.error(`Failed to get core credits for user ${userId}`, error);
      return null;
    }
  }

  async setByUserId(userId, userData) {
    try {
      // Ensure userId is included in the document
      const document = { ...userData, userId };

      const result = await this.collection.replaceOne({ userId }, document, {
        upsert: true,
      });

      // Update cache
      this.cache.set(`core_credits_${userId}`, document);
      this.cache.clear(); // Invalidate all cache

      return result.acknowledged;
    } catch (error) {
      this.logger.error(`Failed to set core credits for user ${userId}`, error);
      return false;
    }
  }

  async updateCredits(userId, creditsChange) {
    try {
      const result = await this.collection.updateOne(
        { userId },
        {
          $inc: { credits: creditsChange },
          $set: { lastUpdated: new Date().toISOString() },
        },
        { upsert: true },
      );

      // Invalidate cache
      this.cache.clear();

      return result.acknowledged;
    } catch (error) {
      this.logger.error(`Failed to update credits for user ${userId}`, error);
      return false;
    }
  }

  async deleteByUserId(userId) {
    try {
      const result = await this.collection.deleteOne({ userId });

      // Invalidate cache
      this.cache.clear();

      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete core credits for user ${userId}`,
        error,
      );
      return false;
    }
  }
}

class ScheduledRoleRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "scheduled_roles", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("scheduled_roles_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set("scheduled_roles_all", schedules);
      return schedules;
    } catch (error) {
      this.logger.error("Failed to get all scheduled roles", error);
      return {};
    }
  }

  async getById(scheduleId) {
    try {
      const cached = this.cache.get(`scheduled_role_${scheduleId}`);
      if (cached) return cached;

      const schedule = await this.collection.findOne({ id: scheduleId });
      if (schedule) {
        this.cache.set(`scheduled_role_${scheduleId}`, schedule);
      }
      return schedule;
    } catch (error) {
      this.logger.error(`Failed to get scheduled role ${scheduleId}`, error);
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`scheduled_roles_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set(`scheduled_roles_guild_${guildId}`, schedules);
      return schedules;
    } catch (error) {
      this.logger.error(
        `Failed to get scheduled roles for guild ${guildId}`,
        error,
      );
      return {};
    }
  }

  async findDue() {
    try {
      const now = new Date();
      const documents = await this.collection
        .find({
          scheduledAt: { $lte: now },
          executed: { $ne: true },
          cancelled: { $ne: true },
        })
        .toArray();

      // Ensure scheduledAt is a Date object, not a string
      const processedDocuments = documents.map(doc => {
        if (doc.scheduledAt && typeof doc.scheduledAt === "string") {
          doc.scheduledAt = new Date(doc.scheduledAt);
        }
        return doc;
      });

      return processedDocuments;
    } catch (error) {
      this.logger.error("Failed to find due scheduled roles", error);
      return [];
    }
  }

  async create(scheduleData) {
    try {
      const document = {
        ...scheduleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(document);
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create scheduled role", error);
      return false;
    }
  }

  async update(scheduleId, scheduleData) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        { $set: { ...scheduleData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to update scheduled role ${scheduleId}`, error);
      return false;
    }
  }

  async delete(scheduleId) {
    try {
      await this.collection.deleteOne({ id: scheduleId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete scheduled role ${scheduleId}`, error);
      return false;
    }
  }

  async markExecuted(scheduleId) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            executed: true,
            executedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to mark scheduled role ${scheduleId} as executed`,
        error,
      );
      return false;
    }
  }

  async cancel(scheduleId) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            cancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled role ${scheduleId}`, error);
      return false;
    }
  }
}

class RecurringScheduleRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "recurring_schedules", cache, logger);
  }

  async getAll() {
    try {
      const cached = this.cache.get("recurring_schedules_all");
      if (cached) return cached;

      const documents = await this.collection.find({}).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set("recurring_schedules_all", schedules);
      return schedules;
    } catch (error) {
      this.logger.error("Failed to get all recurring schedules", error);
      return {};
    }
  }

  async getById(scheduleId) {
    try {
      const cached = this.cache.get(`recurring_schedule_${scheduleId}`);
      if (cached) return cached;

      const schedule = await this.collection.findOne({ id: scheduleId });
      if (schedule) {
        this.cache.set(`recurring_schedule_${scheduleId}`, schedule);
      }
      return schedule;
    } catch (error) {
      this.logger.error(
        `Failed to get recurring schedule ${scheduleId}`,
        error,
      );
      return null;
    }
  }

  async getByGuild(guildId) {
    try {
      const cached = this.cache.get(`recurring_schedules_guild_${guildId}`);
      if (cached) return cached;

      const documents = await this.collection.find({ guildId }).toArray();
      const schedules = {};
      for (const doc of documents) {
        schedules[doc.id] = doc;
      }

      this.cache.set(`recurring_schedules_guild_${guildId}`, schedules);
      return schedules;
    } catch (error) {
      this.logger.error(
        `Failed to get recurring schedules for guild ${guildId}`,
        error,
      );
      return {};
    }
  }

  async findActive() {
    try {
      const documents = await this.collection
        .find({
          active: true,
          cancelled: { $ne: true },
        })
        .toArray();
      return documents;
    } catch (error) {
      this.logger.error("Failed to find active recurring schedules", error);
      return [];
    }
  }

  async create(scheduleData) {
    try {
      const document = {
        ...scheduleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.collection.insertOne(document);
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error("Failed to create recurring schedule", error);
      return false;
    }
  }

  async update(scheduleId, scheduleData) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        { $set: { ...scheduleData, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async delete(scheduleId) {
    try {
      await this.collection.deleteOne({ id: scheduleId });
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async cancel(scheduleId) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        {
          $set: {
            active: false,
            cancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to cancel recurring schedule ${scheduleId}`,
        error,
      );
      return false;
    }
  }

  async updateLastExecuted(scheduleId, lastExecutedAt) {
    try {
      await this.collection.updateOne(
        { id: scheduleId },
        { $set: { lastExecutedAt, updatedAt: new Date() } },
      );
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update last executed time for schedule ${scheduleId}`,
        error,
      );
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
    this.polls = null;
    this.coreCredits = null;
    this.voiceControlRoles = null;
    this.recurringSchedules = null;
    this.scheduledRoles = null;
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
        this.goodbyeSettings = new GoodbyeSettingsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.guildSettings = new GuildSettingsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.voiceControlRoles = new VoiceControlRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.polls = new PollRepository(db, this.cacheManager, this.logger);
        this.conversations = new ConversationRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.coreCredits = new CoreCreditsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.scheduledRoles = new ScheduledRoleRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.recurringSchedules = new RecurringScheduleRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.avatarJobs = new ImageJobRepository(
          db,
          this.cacheManager,
          this.logger,
          "avatar_jobs",
        );
        this.imagineJobs = new ImageJobRepository(
          db,
          this.cacheManager,
          this.logger,
          "imagine_jobs",
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
