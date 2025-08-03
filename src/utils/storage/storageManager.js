import fs from "fs";
import path from "path";
import { getLogger } from "../logger.js";
import { getDatabaseManager } from "./databaseManager.js";

class FileProvider {
  constructor(logger, storagePath = "./data") {
    this.logger = logger;
    this.storagePath = storagePath;
    this._ensureDataDirectory();
  }

  _ensureDataDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  _getFilePath(collection) {
    return path.join(this.storagePath, `${collection}.json`);
  }

  read(collection) {
    try {
      const filePath = this._getFilePath(collection);
      if (!fs.existsSync(filePath)) return {};
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`❌ Failed to read ${collection} from file`, error);
      return {};
    }
  }

  write(collection, data) {
    try {
      const filePath = this._getFilePath(collection);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to write ${collection} to file`, error);
      return false;
    }
  }
}

class DatabaseProvider {
  constructor(dbManager, logger) {
    this.dbManager = dbManager;
    this.logger = logger;
  }

  async getRoleMappings() {
    return this.dbManager.roleMappings.getAll();
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    await this.dbManager.roleMappings.set(messageId, guildId, channelId, roles);
    return true;
  }

  async deleteRoleMapping(messageId) {
    await this.dbManager.roleMappings.delete(messageId);
    return true;
  }

  async cleanupExpiredRoles() {
    await this.dbManager.temporaryRoles.cleanupExpired();
  }

  async getTemporaryRoles() {
    return this.dbManager.temporaryRoles.getAll();
  }

  async addTemporaryRole(guildId, userId, roleId, expiresAt) {
    await this.dbManager.temporaryRoles.add(guildId, userId, roleId, expiresAt);
    return true;
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    await this.dbManager.temporaryRoles.delete(guildId, userId, roleId);
    return true;
  }
}

class StorageManager {
  constructor() {
    this.logger = getLogger();
    this.provider = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.logger.info("🔧 Initializing storage manager...");

    const dbManager = await getDatabaseManager();
    if (dbManager && dbManager.connectionManager.db) {
      this.provider = new DatabaseProvider(dbManager, this.logger);
      this.logger.success("✅ Database storage enabled");
    } else {
      this.provider = new FileProvider(this.logger);
      this.logger.warn("⚠️ Database storage disabled, using local files only");
    }

    this.isInitialized = true;
    this.logger.success("✅ Storage manager initialized");
  }

  async getRoleMappings() {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getRoleMappings();
    }
    return this.provider.read("role_mappings");
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.setRoleMapping(messageId, guildId, channelId, roles);
    }
    const mappings = this.provider.read("role_mappings");
    mappings[messageId] = { guildId, channelId, roles };
    return this.provider.write("role_mappings", mappings);
  }

  async deleteRoleMapping(messageId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.deleteRoleMapping(messageId);
    }
    const mappings = this.provider.read("role_mappings");
    delete mappings[messageId];
    return this.provider.write("role_mappings", mappings);
  }

  async cleanupExpiredRoles() {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.cleanupExpiredRoles();
    }
    // File-based cleanup would be more complex and is omitted for this refactoring
  }

  async getTemporaryRoles() {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getTemporaryRoles();
    }
    return this.provider.read("temporary_roles");
  }

  async addTemporaryRole(guildId, userId, roleId, expiresAt) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addTemporaryRole(guildId, userId, roleId, expiresAt);
    }
    const tempRoles = this.provider.read("temporary_roles");
    if (!tempRoles[guildId]) tempRoles[guildId] = {};
    if (!tempRoles[guildId][userId]) tempRoles[guildId][userId] = {};
    tempRoles[guildId][userId][roleId] = { expiresAt };
    return this.provider.write("temporary_roles", tempRoles);
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeTemporaryRole(guildId, userId, roleId);
    }
    const tempRoles = this.provider.read("temporary_roles");
    if (tempRoles[guildId]?.[userId]?.[roleId]) {
      delete tempRoles[guildId][userId][roleId];
      if (Object.keys(tempRoles[guildId][userId]).length === 0) {
        delete tempRoles[guildId][userId];
      }
      if (Object.keys(tempRoles[guildId]).length === 0) {
        delete tempRoles[guildId];
      }
      return this.provider.write("temporary_roles", tempRoles);
    }
    return false;
  }
}

let storageManager = null;

export async function getStorageManager() {
  if (!storageManager) {
    storageManager = new StorageManager();
    await storageManager.initialize();
  }
  return storageManager;
}
