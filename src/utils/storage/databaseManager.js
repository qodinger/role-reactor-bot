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
  }

  async connect() {
    if (this.connectionPromise) return this.connectionPromise;
    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    try {
      this.logger.info("🔌 Attempting to connect to MongoDB...");
      this.client = new MongoClient(this.config.uri, this.config.options);

      const connection = this.client.connect();
      const timeout = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(new Error("MongoDB connection timeout after 15 seconds")),
          15000,
        );
      });

      await Promise.race([connection, timeout]);
      this.logger.success("✅ MongoDB connection established");
      this.db = this.client.db(this.config.name);
      await this._createIndexes();
      return this.db;
    } catch (error) {
      this.logger.error("❌ Failed to connect to MongoDB", error);
      return null;
    }
  }

  async _createIndexes() {
    try {
      this.logger.info("🔧 Creating database indexes...");
      await this.db
        .collection("role_mappings")
        .createIndex({ messageId: 1 }, { unique: true });
      await this.db.collection("temporary_roles").createIndex({ expiresAt: 1 });
      this.logger.success("✅ Database indexes created successfully");
    } catch (error) {
      this.logger.warn("⚠️ Index creation failed (non-critical)", error);
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.logger.info("🔌 MongoDB connection closed");
    }
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
    }
  }

  async close() {
    await this.connectionManager.close();
  }

  async healthCheck() {
    if (!this.connectionManager.db) return false;
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
