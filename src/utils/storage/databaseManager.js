import { MongoClient } from "mongodb";
import { getLogger } from "../logger.js";
import config from "../../config/config.js";

class CacheManager {
  constructor(timeout = 5 * 60 * 1000) {
    this.cache = new Map();
    this.timeout = timeout;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.timestamp > this.timeout) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

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
        // Add automatic reconnection options
        serverSelectionTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
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
      }

      return null;
    } finally {
      // Clean up timeout to prevent memory leaks
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

  async add(guildId, userId, roleId, expiresAt) {
    await this.collection.updateOne(
      { guildId, userId, roleId },
      { $set: { expiresAt, updatedAt: new Date() } },
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
}

class UserExperienceRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "user_experience", cache, logger);
  }

  async getAll() {
    const cacheKey = "user_experience_all";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const documents = await this.collection.find({}).toArray();
    const experienceData = {};
    for (const doc of documents) {
      const key = `${doc.guildId}_${doc.userId}`;
      experienceData[key] = {
        guildId: doc.guildId,
        userId: doc.userId,
        totalXP: doc.totalXP || 0,
        level: doc.level || 1,
        messagesSent: doc.messagesSent || 0,
        rolesEarned: doc.rolesEarned || 0,
        commandsUsed: doc.commandsUsed || 0,
        lastUpdated: doc.lastUpdated || new Date(),
        lastEarned: doc.lastEarned || null,
        lastCommandEarned: doc.lastCommandEarned || null,
      };
    }
    this.cache.set(cacheKey, experienceData);
    return experienceData;
  }

  async getByUser(guildId, userId) {
    const doc = await this.collection.findOne({ guildId, userId });
    return doc || null;
  }

  async set(guildId, userId, userData) {
    await this.collection.updateOne(
      { guildId, userId },
      { $set: { ...userData, guildId, userId, updatedAt: new Date() } },
      { upsert: true },
    );
    this.cache.clear();
  }

  async delete(guildId, userId) {
    const result = await this.collection.deleteOne({ guildId, userId });
    if (result.deletedCount > 0) {
      this.cache.clear();
    }
    return result.deletedCount > 0;
  }

  async getLeaderboard(guildId, limit = 10) {
    return this.collection
      .find({ guildId })
      .sort({ totalXP: -1, level: -1 })
      .limit(limit)
      .toArray();
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
  }

  async connect() {
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
    await databaseManager.connect();
  }
  return databaseManager;
}
