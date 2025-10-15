import fs from "fs/promises";
import fsSync from "fs";
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
    if (!fsSync.existsSync(this.storagePath)) {
      fsSync.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  _getFilePath(collection) {
    return path.join(this.storagePath, `${collection}.json`);
  }

  async read(collection) {
    try {
      const filePath = this._getFilePath(collection);
      // Use async file access instead of blocking existsSync
      try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data);
      } catch (readError) {
        // If file doesn't exist, return empty object
        if (readError.code === "ENOENT") {
          return {};
        }
        throw readError;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to read ${collection} from file`, error);
      return {};
    }
  }

  async write(collection, data) {
    try {
      const filePath = this._getFilePath(collection);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
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

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    return this.dbManager.roleMappings.getByGuildPaginated(
      guildId,
      page,
      limit,
    );
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

  async addTemporaryRole(
    guildId,
    userId,
    roleId,
    expiresAt,
    notifyExpiry = false,
  ) {
    await this.dbManager.temporaryRoles.add(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );
    return true;
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    await this.dbManager.temporaryRoles.delete(guildId, userId, roleId);
    return true;
  }

  async getUserExperience(guildId, userId) {
    return this.dbManager.userExperience.getByUser(guildId, userId);
  }

  async setUserExperience(guildId, userId, userData) {
    await this.dbManager.userExperience.set(guildId, userId, userData);
    return true;
  }

  async getAllUserExperience() {
    return this.dbManager.userExperience.getAll();
  }

  async getUserExperienceLeaderboard(guildId, limit) {
    return this.dbManager.userExperience.getLeaderboard(guildId, limit);
  }

  // Supporter management methods
  async getSupporters() {
    try {
      return this.dbManager.guildSettings.getSupporters() || {};
    } catch (error) {
      this.logger.error("Failed to get supporters from database", error);
      return {};
    }
  }

  async setSupporters(supporters) {
    try {
      await this.dbManager.guildSettings.setSupporters(supporters);
      return true;
    } catch (error) {
      this.logger.error("Failed to set supporters in database", error);
      return false;
    }
  }

  // Poll management methods
  async getAllPolls() {
    return this.dbManager.polls.getAll();
  }

  async getPollById(pollId) {
    return this.dbManager.polls.getById(pollId);
  }

  async getPollsByGuild(guildId) {
    return this.dbManager.polls.getByGuild(guildId);
  }

  async getPollByMessageId(messageId) {
    return this.dbManager.polls.getByMessageId(messageId);
  }

  async createPoll(pollData) {
    return this.dbManager.polls.create(pollData);
  }

  async updatePoll(pollId, pollData) {
    return this.dbManager.polls.update(pollId, pollData);
  }

  async deletePoll(pollId) {
    return this.dbManager.polls.delete(pollId);
  }

  async cleanupEndedPolls() {
    return this.dbManager.polls.cleanupEndedPolls();
  }

  // Core Credits methods
  async getAllCoreCredits() {
    return this.dbManager.coreCredits.getAll();
  }

  async getCoreCredits(userId) {
    return this.dbManager.coreCredits.getByUserId(userId);
  }

  async setCoreCredits(userId, userData) {
    return this.dbManager.coreCredits.setByUserId(userId, userData);
  }

  async updateCoreCredits(userId, creditsChange) {
    return this.dbManager.coreCredits.updateCredits(userId, creditsChange);
  }

  async deleteCoreCredits(userId) {
    return this.dbManager.coreCredits.deleteByUserId(userId);
  }
}

class StorageManager {
  constructor() {
    this.logger = getLogger();
    this.provider = null;
    this.isInitialized = false;
  }

  /**
   * Migrate data from local files to database when MongoDB becomes available
   */
  async migrateLocalDataToDatabase() {
    try {
      this.logger.info("🔄 Checking for local data to migrate...");

      // Create a temporary file provider to read local data
      const fileProvider = new FileProvider(this.logger);

      // Check if there are polls in local files
      const localPolls = await fileProvider.read("polls");
      const localPollCount = Object.keys(localPolls).length;

      if (localPollCount === 0) {
        this.logger.info("📁 No local poll data to migrate");
        return;
      }

      this.logger.info(
        `📁 Found ${localPollCount} polls in local files, checking database...`,
      );

      // Check if database already has polls
      const dbPolls = await this.provider.getAllPolls();
      const dbPollCount = Object.keys(dbPolls).length;

      if (dbPollCount > 0) {
        this.logger.info(
          `📊 Database already has ${dbPollCount} polls, skipping migration`,
        );
        return;
      }

      // Migrate polls from local files to database
      this.logger.info(`🔄 Migrating ${localPollCount} polls to database...`);

      let migratedCount = 0;
      for (const [pollId, pollData] of Object.entries(localPolls)) {
        try {
          await this.provider.createPoll(pollData);
          migratedCount++;
        } catch (error) {
          this.logger.warn(`Failed to migrate poll ${pollId}:`, error.message);
        }
      }

      this.logger.success(
        `✅ Successfully migrated ${migratedCount}/${localPollCount} polls to database`,
      );

      // Optionally, you can clear local files after successful migration
      // Uncomment the next line if you want to clear local files after migration
      // await fileProvider.write("polls", {});
    } catch (error) {
      this.logger.error("❌ Migration failed:", error);
    }
  }

  async initialize() {
    if (this.isInitialized) return;
    this.logger.info("🔧 Initializing storage manager...");

    try {
      const dbManager = await getDatabaseManager();
      if (dbManager && dbManager.connectionManager.db) {
        this.provider = new DatabaseProvider(dbManager, this.logger);
        this.logger.success("✅ Database storage enabled");

        // Migrate data from local files to database
        await this.migrateLocalDataToDatabase();
      } else {
        this.provider = new FileProvider(this.logger);
        this.logger.warn(
          "⚠️ Database storage disabled, using local files only",
        );
      }
    } catch (error) {
      this.logger.warn(
        "⚠️ Failed to connect to database, falling back to local files:",
        error.message,
      );
      this.provider = new FileProvider(this.logger);
      this.logger.info("📁 Using local file storage as fallback");
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

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getRoleMappingsPaginated(guildId, page, limit);
    }
    // Fallback to file-based pagination
    const allMappings = this.provider.read("role_mappings");
    const guildMappings = Object.entries(allMappings).filter(
      ([, m]) => m.guildId === guildId,
    );

    const totalItems = guildMappings.length;
    const totalPages = Math.ceil(totalItems / limit);
    const skip = (page - 1) * limit;
    const paginatedMappings = guildMappings.slice(skip, skip + limit);

    const mappings = {};
    for (const [messageId, mapping] of paginatedMappings) {
      mappings[messageId] = mapping;
    }

    return {
      mappings,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
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

  async addTemporaryRole(
    guildId,
    userId,
    roleId,
    expiresAt,
    notifyExpiry = false,
  ) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addTemporaryRole(
        guildId,
        userId,
        roleId,
        expiresAt,
        notifyExpiry,
      );
    }
    const tempRoles = this.provider.read("temporary_roles");
    if (!tempRoles[guildId]) tempRoles[guildId] = {};
    if (!tempRoles[guildId][userId]) tempRoles[guildId][userId] = {};
    tempRoles[guildId][userId][roleId] = { expiresAt, notifyExpiry };
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

  // Poll management methods
  async getAllPolls() {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getAllPolls();
    }
    return this.provider.read("polls");
  }

  async getPollById(pollId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getPollById(pollId);
    }
    const polls = this.provider.read("polls");
    return polls[pollId] || null;
  }

  async getPollsByGuild(guildId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getPollsByGuild(guildId);
    }
    const polls = this.provider.read("polls");
    const guildPolls = {};
    for (const [pollId, poll] of Object.entries(polls)) {
      if (poll.guildId === guildId) {
        guildPolls[pollId] = poll;
      }
    }
    return guildPolls;
  }

  async getPollByMessageId(messageId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getPollByMessageId(messageId);
    }
    const polls = this.provider.read("polls");
    for (const [, poll] of Object.entries(polls)) {
      if (poll.messageId === messageId) {
        return poll;
      }
    }
    return null;
  }

  async createPoll(pollData) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.createPoll(pollData);
    }
    const polls = this.provider.read("polls");
    polls[pollData.id] = pollData;
    return this.provider.write("polls", polls);
  }

  async updatePoll(pollId, pollData) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.updatePoll(pollId, pollData);
    }
    const polls = this.provider.read("polls");
    if (polls[pollId]) {
      polls[pollId] = { ...polls[pollId], ...pollData };
      return this.provider.write("polls", polls);
    }
    return false;
  }

  async deletePoll(pollId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.deletePoll(pollId);
    }
    const polls = this.provider.read("polls");
    if (polls[pollId]) {
      delete polls[pollId];
      return this.provider.write("polls", polls);
    }
    return false;
  }

  async cleanupEndedPolls() {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.cleanupEndedPolls();
    }
    // File-based cleanup would be more complex and is omitted for this refactoring
    return 0;
  }

  // Generic storage methods for other features
  async read(collection) {
    if (this.provider instanceof DatabaseProvider) {
      // Use database for user_experience collection
      if (collection === "user_experience") {
        // Normalize to a key-value map like the file provider returns
        const documents = await this.provider.getAllUserExperience();
        const map = {};
        for (const doc of documents) {
          map[`${doc.guildId}_${doc.userId}`] = doc;
        }
        return map;
      }
      // Use database for core_credit collection
      if (collection === "core_credit") {
        // Get all core credits from database
        const allCoreCredits = await this.provider.getAllCoreCredits();
        return allCoreCredits;
      }
      // For other collections, use file-based storage
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.read(collection);
    }
    return await this.provider.read(collection);
  }

  async write(collection, data) {
    if (this.provider instanceof DatabaseProvider) {
      // Use database for user_experience collection
      if (collection === "user_experience") {
        // Update all user experience data in database
        for (const [key, userData] of Object.entries(data)) {
          const [guildId, userId] = key.split("_");
          if (guildId && userId) {
            await this.provider.setUserExperience(guildId, userId, userData);
          }
        }
        return true;
      }
      // Use database for core_credit collection
      if (collection === "core_credit") {
        // Update all core credit data in database
        for (const [userId, userData] of Object.entries(data)) {
          await this.provider.setCoreCredits(userId, userData);
        }
        return true;
      }
      // For other collections, use file-based storage
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.write(collection, data);
    }
    return await this.provider.write(collection, data);
  }

  // Generic get and set methods for AI avatar credits and other data
  async get(key) {
    if (this.provider && this.provider.get) {
      return this.provider.get(key);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    return fileProvider.read(key);
  }

  async set(key, data) {
    if (this.provider && this.provider.set) {
      return this.provider.set(key, data);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    return fileProvider.write(key, data);
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
