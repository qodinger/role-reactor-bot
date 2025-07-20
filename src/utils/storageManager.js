import fs from "fs";
import path from "path";
import { getLogger } from "./logger.js";
import { getDatabaseManager } from "./databaseManager.js";

/**
 * Hybrid Storage Manager
 * Supports both MongoDB and local JSON files with automatic fallback
 */
class StorageManager {
  constructor() {
    this.logger = getLogger();
    this.dbManager = null;
    this.storagePath = "./data";
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.syncInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize storage manager
   */
  async initialize() {
    if (this.isInitialized) return;

    this.logger.info("🔧 Initializing storage manager...");

    // Ensure data directory exists
    this._ensureDataDirectory();

    // Try to initialize database manager
    try {
      this.dbManager = await getDatabaseManager();
      this.logger.success("✅ Database storage enabled");
    } catch (_error) {
      this.logger.warn("⚠️ Database storage disabled, using local files only");
      this.dbManager = null;
    }

    // Start sync interval if both storage methods are available
    if (this.dbManager && this.dbManager.isConnected) {
      this._startSyncInterval();
    }

    this.isInitialized = true;
    this.logger.success("✅ Storage manager initialized");
  }

  /**
   * Ensure data directory exists
   */
  _ensureDataDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      this.logger.info("📁 Created data directory");
    }
  }

  /**
   * Get file path for a collection
   */
  _getFilePath(collection) {
    return path.join(this.storagePath, `${collection}.json`);
  }

  /**
   * Read data from local file
   */
  _readFromFile(collection) {
    try {
      const filePath = this._getFilePath(collection);
      if (!fs.existsSync(filePath)) {
        return {};
      }

      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (_error) {
      this.logger.error(`❌ Failed to read ${collection} from file`, _error);
      return {};
    }
  }

  /**
   * Write data to local file
   */
  _writeToFile(collection, data) {
    try {
      const filePath = this._getFilePath(collection);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      this.logger.debug(`💾 Saved ${collection} to file`);
      return true;
    } catch (_error) {
      this.logger.error(`❌ Failed to write ${collection} to file`, _error);
      return false;
    }
  }

  /**
   * Get cache key
   */
  _getCacheKey(collection, query = {}) {
    return `${collection}:${JSON.stringify(query)}`;
  }

  /**
   * Set cache
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cache
   */
  _getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear cache
   */
  _clearCache() {
    this.cache.clear();
  }

  /**
   * Start sync interval
   */
  _startSyncInterval() {
    if (this.syncInterval) return;

    // Sync every 5 minutes
    this.syncInterval = setInterval(
      () => {
        this._syncData().catch(error => {
          this.logger.error("❌ Sync error", error);
        });
      },
      5 * 60 * 1000,
    ).unref();

    this.logger.info("🔄 Started data sync interval");
  }

  /**
   * Stop sync interval
   */
  _stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info("🛑 Stopped data sync interval");
    }
  }

  /**
   * Sync data between database and local files
   */
  async _syncData() {
    if (!this.dbManager || !this.dbManager.isConnected) return;

    try {
      this.logger.debug("🔄 Syncing data between storage methods...");

      // Sync role mappings
      const dbMappings = await this.dbManager.getRoleMappings();
      const fileMappings = this._readFromFile("role_mappings");

      // Merge data (database takes precedence)
      const mergedMappings = { ...fileMappings, ...dbMappings };
      this._writeToFile("role_mappings", mergedMappings);

      // Sync temporary roles
      const dbTempRoles = await this.dbManager.getTemporaryRoles();
      const fileTempRoles = this._readFromFile("temporary_roles");

      // Merge data (database takes precedence)
      const mergedTempRoles = { ...fileTempRoles, ...dbTempRoles };
      this._writeToFile("temporary_roles", mergedTempRoles);

      this.logger.debug("✅ Data sync completed");
    } catch (_error) {
      this.logger.error("❌ Data sync failed", _error);
    }
  }

  // ===== ROLE MAPPINGS =====

  /**
   * Get role mappings
   */
  async getRoleMappings() {
    const cacheKey = this._getCacheKey("role_mappings");
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let mappings = {};

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        mappings = await this.dbManager.getRoleMappings();
        this.logger.debug("📊 Retrieved role mappings from database");
      } catch (_error) {
        this.logger.warn("⚠️ Database failed, falling back to local file");
      }
    }

    // Fallback to local file if database failed or not available
    if (Object.keys(mappings).length === 0) {
      mappings = this._readFromFile("role_mappings");
      this.logger.debug("📄 Retrieved role mappings from local file");
    }

    this._setCache(cacheKey, mappings);
    return mappings;
  }

  /**
   * Set role mapping
   */
  async setRoleMapping(messageId, guildId, channelId, roles) {
    const mapping = {
      messageId,
      guildId,
      channelId,
      roles,
      updatedAt: new Date(),
    };

    let success = false;

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        success = await this.dbManager.setRoleMapping(
          messageId,
          guildId,
          channelId,
          roles,
        );
        if (success) {
          this.logger.debug("💾 Saved role mapping to database");
        }
      } catch (_error) {
        this.logger.warn("⚠️ Database save failed, using local file");
      }
    }

    // Always save to local file as backup
    const mappings = this._readFromFile("role_mappings");
    mappings[messageId] = mapping;
    const fileSuccess = this._writeToFile("role_mappings", mappings);

    if (fileSuccess) {
      this.logger.debug("💾 Saved role mapping to local file");
      success = true;
    }

    // Clear cache
    this._clearCache();

    return success;
  }

  /**
   * Delete role mapping
   */
  async deleteRoleMapping(messageId) {
    let success = false;

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        success = await this.dbManager.deleteRoleMapping(messageId);
        if (success) {
          this.logger.debug("🗑️ Deleted role mapping from database");
        }
      } catch (_error) {
        this.logger.warn("⚠️ Database delete failed, using local file");
      }
    }

    // Always delete from local file
    const mappings = this._readFromFile("role_mappings");
    if (mappings[messageId]) {
      delete mappings[messageId];
      const fileSuccess = this._writeToFile("role_mappings", mappings);
      if (fileSuccess) {
        this.logger.debug("🗑️ Deleted role mapping from local file");
        success = true;
      }
    }

    // Clear cache
    this._clearCache();

    return success;
  }

  // ===== TEMPORARY ROLES =====

  /**
   * Get temporary roles
   */
  async getTemporaryRoles() {
    const cacheKey = this._getCacheKey("temporary_roles");
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    let tempRoles = {};

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        tempRoles = await this.dbManager.getTemporaryRoles();
        this.logger.debug("📊 Retrieved temporary roles from database");
      } catch (_error) {
        this.logger.warn("⚠️ Database failed, falling back to local file");
      }
    }

    // Fallback to local file if database failed or not available
    if (Object.keys(tempRoles).length === 0) {
      tempRoles = this._readFromFile("temporary_roles");
      this.logger.debug("📄 Retrieved temporary roles from local file");
    }

    this._setCache(cacheKey, tempRoles);
    return tempRoles;
  }

  /**
   * Add temporary role
   */
  async addTemporaryRole(guildId, userId, roleId, expiresAt) {
    let success = false;

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        success = await this.dbManager.addTemporaryRole(
          guildId,
          userId,
          roleId,
          expiresAt,
        );
        if (success) {
          this.logger.debug("💾 Added temporary role to database");
        }
      } catch (_error) {
        this.logger.warn("⚠️ Database save failed, using local file");
      }
    }

    // Always save to local file as backup
    const tempRoles = this._readFromFile("temporary_roles");
    if (!tempRoles[guildId]) tempRoles[guildId] = {};
    if (!tempRoles[guildId][userId]) tempRoles[guildId][userId] = {};

    tempRoles[guildId][userId][roleId] = {
      expiresAt: new Date(expiresAt),
      createdAt: new Date(),
    };

    const fileSuccess = this._writeToFile("temporary_roles", tempRoles);
    if (fileSuccess) {
      this.logger.debug("💾 Added temporary role to local file");
      success = true;
    }

    // Clear cache
    this._clearCache();

    return success;
  }

  /**
   * Remove temporary role
   */
  async removeTemporaryRole(guildId, userId, roleId) {
    let success = false;

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        success = await this.dbManager.removeTemporaryRole(
          guildId,
          userId,
          roleId,
        );
        if (success) {
          this.logger.debug("🗑️ Removed temporary role from database");
        }
      } catch (_error) {
        this.logger.warn("⚠️ Database delete failed, using local file");
      }
    }

    // Always delete from local file
    const tempRoles = this._readFromFile("temporary_roles");
    if (tempRoles[guildId]?.[userId]?.[roleId]) {
      delete tempRoles[guildId][userId][roleId];

      // Clean up empty objects
      if (Object.keys(tempRoles[guildId][userId]).length === 0) {
        delete tempRoles[guildId][userId];
      }
      if (Object.keys(tempRoles[guildId]).length === 0) {
        delete tempRoles[guildId];
      }

      const fileSuccess = this._writeToFile("temporary_roles", tempRoles);
      if (fileSuccess) {
        this.logger.debug("🗑️ Removed temporary role from local file");
        success = true;
      }
    }

    // Clear cache
    this._clearCache();

    return success;
  }

  /**
   * Cleanup expired roles
   */
  async cleanupExpiredRoles() {
    let cleanedCount = 0;

    // Try database first
    if (this.dbManager && this.dbManager.isConnected) {
      try {
        cleanedCount = await this.dbManager.cleanupExpiredRoles();
        this.logger.debug(
          `🧹 Cleaned up ${cleanedCount} expired roles from database`,
        );
      } catch (_error) {
        this.logger.warn("⚠️ Database cleanup failed, using local file");
      }
    }

    // Always cleanup local file
    const tempRoles = this._readFromFile("temporary_roles");
    const now = new Date();
    let localCleanedCount = 0;

    for (const guildId in tempRoles) {
      for (const userId in tempRoles[guildId]) {
        for (const roleId in tempRoles[guildId][userId]) {
          const role = tempRoles[guildId][userId][roleId];
          if (new Date(role.expiresAt) <= now) {
            delete tempRoles[guildId][userId][roleId];
            localCleanedCount++;
          }
        }

        // Clean up empty objects
        if (Object.keys(tempRoles[guildId][userId]).length === 0) {
          delete tempRoles[guildId][userId];
        }
      }

      if (Object.keys(tempRoles[guildId]).length === 0) {
        delete tempRoles[guildId];
      }
    }

    if (localCleanedCount > 0) {
      this._writeToFile("temporary_roles", tempRoles);
      this.logger.debug(
        `🧹 Cleaned up ${localCleanedCount} expired roles from local file`,
      );
    }

    // Clear cache
    this._clearCache();

    return Math.max(cleanedCount, localCleanedCount);
  }

  /**
   * Get storage status
   */
  getStorageStatus() {
    return {
      database: {
        connected: this.dbManager?.isConnected || false,
        type: this.dbManager?.isConnected ? "MongoDB" : "None",
      },
      local: {
        enabled: true,
        path: this.storagePath,
      },
      cache: {
        size: this.cache.size,
        timeout: this.cacheTimeout,
      },
      sync: {
        enabled: !!this.syncInterval,
        interval: "5 minutes",
      },
    };
  }

  /**
   * Close storage manager
   */
  async close() {
    this._stopSyncInterval();
    this._clearCache();

    if (this.dbManager) {
      await this.dbManager.close();
    }

    this.logger.info("🔌 Storage manager closed");
  }
}

// Singleton instance
let storageManager = null;

export async function getStorageManager() {
  if (!storageManager) {
    storageManager = new StorageManager();
    await storageManager.initialize();
  }
  return storageManager;
}

export { StorageManager };
