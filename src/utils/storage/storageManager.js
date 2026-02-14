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

        // If JSON parse error, try to recover from corrupted file
        if (readError instanceof SyntaxError) {
          this.logger.warn(
            `⚠️ Corrupted JSON file detected for ${collection}, attempting recovery...`,
          );

          try {
            // Create backup of corrupted file
            const backupPath = `${filePath}.corrupted.${Date.now()}`;
            const data = await fs.readFile(filePath, "utf8");
            await fs.writeFile(backupPath, data, "utf8");
            this.logger.info(
              `📦 Created backup of corrupted file: ${backupPath}`,
            );

            // Try to extract valid JSON (find the first complete JSON object)
            const jsonMatch = data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const recovered = JSON.parse(jsonMatch[0]);
                this.logger.info(
                  `✅ Successfully recovered data from corrupted ${collection} file`,
                );
                // Write the recovered data back to fix the file
                await fs.writeFile(
                  filePath,
                  JSON.stringify(recovered, null, 2),
                  "utf8",
                );
                return recovered;
              } catch (_recoverError) {
                this.logger.warn(
                  `⚠️ Could not recover data from ${collection}, resetting to empty object`,
                );
              }
            }

            // If recovery failed, reset to empty object
            this.logger.warn(
              `🔄 Resetting ${collection} to empty object due to corruption`,
            );
            await fs.writeFile(filePath, JSON.stringify({}, null, 2), "utf8");
            return {};
          } catch (recoveryError) {
            this.logger.error(
              `❌ Failed to recover corrupted ${collection} file:`,
              recoveryError,
            );
            // Last resort: return empty object
            return {};
          }
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

  async delete(collection) {
    try {
      const filePath = this._getFilePath(collection);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logger.error(`❌ Failed to delete ${collection} file:`, error);
      }
      return false;
    }
  }

  async archive(collection) {
    try {
      const filePath = this._getFilePath(collection);
      const archivedPath = `${filePath}.migrated`;
      await fs.rename(filePath, archivedPath);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.logger.error(`❌ Failed to archive ${collection} file:`, error);
      }
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

  async getUserExperienceByGuild(guildId) {
    return this.dbManager.userExperience.getByGuild(guildId);
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

  // Voice Control Roles methods
  async getVoiceControlRoles(guildId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.getByGuild(guildId);
    }
    return {
      guildId,
      disconnectRoleIds: [],
      muteRoleIds: [],
      deafenRoleIds: [],
      moveRoleMappings: {},
    };
  }

  async addVoiceDisconnectRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addDisconnectRole(
        guildId,
        roleId,
      );
    }
    return false;
  }

  async removeVoiceDisconnectRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeDisconnectRole(
        guildId,
        roleId,
      );
    }
    return false;
  }

  async addVoiceMuteRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addMuteRole(guildId, roleId);
    }
    return false;
  }

  async removeVoiceMuteRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeMuteRole(guildId, roleId);
    }
    return false;
  }

  async addVoiceDeafenRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addDeafenRole(guildId, roleId);
    }
    return false;
  }

  async removeVoiceDeafenRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeDeafenRole(guildId, roleId);
    }
    return false;
  }

  async addVoiceMoveRole(guildId, roleId, channelId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.addMoveRole(
        guildId,
        roleId,
        channelId,
      );
    }
    return false;
  }

  async removeVoiceMoveRole(guildId, roleId) {
    if (this.dbManager?.voiceControlRoles) {
      return this.dbManager.voiceControlRoles.removeMoveRole(guildId, roleId);
    }
    return false;
  }

  // Guild Analytics methods
  async updateGuildAnalytics(guildId, date, type, amount) {
    if (this.dbManager?.guildAnalytics) {
      await this.dbManager.guildAnalytics.updateCounter(
        guildId,
        date,
        type,
        amount,
      );
      return true;
    }
    return false;
  }

  async getGuildAnalyticsHistory(guildId, startDate, endDate) {
    if (this.dbManager?.guildAnalytics) {
      return await this.dbManager.guildAnalytics.getHistory(
        guildId,
        startDate,
        endDate,
      );
    }
    return [];
  }

  async cleanupOldAnalytics(cutoffDate) {
    if (this.dbManager?.guildAnalytics) {
      return await this.dbManager.guildAnalytics.deleteOlderThan(cutoffDate);
    }
    return 0;
  }

  // Moderation methods
  async logModerationAction(actionData) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.create(actionData);
    }
    return false;
  }

  async getModerationHistory(guildId, userId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getByUser(guildId, userId);
    }
    return [];
  }

  async getAllModerationHistory(guildId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getByGuild(guildId);
    }
    return [];
  }

  async getWarnCount(guildId, userId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.getWarnCount(guildId, userId);
    }
    return 0;
  }

  async removeWarning(guildId, userId, caseId) {
    if (this.dbManager?.moderationLogs) {
      return await this.dbManager.moderationLogs.deleteWarning(
        guildId,
        userId,
        caseId,
      );
    }
    return false;
  }
}

class StorageManager {
  constructor() {
    this.logger = getLogger();
    this.provider = null;
    this.dbManager = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.logger.info("🔧 Initializing storage manager...");

    try {
      const dbManager = await getDatabaseManager();
      if (dbManager && dbManager.connectionManager.db) {
        this.dbManager = dbManager; // Store dbManager for direct access
        this.provider = new DatabaseProvider(dbManager, this.logger);
        this.logger.success("✅ Database storage enabled");

        // Initial migration phase completed
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
    return await this.provider.read("role_mappings");
  }

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getRoleMappingsPaginated(guildId, page, limit);
    }
    // Fallback to file-based pagination
    const allMappings = await this.provider.read("role_mappings");
    const guildMappings = Object.entries(allMappings)
      .filter(([, m]) => m.guildId === guildId)
      .sort((a, b) => {
        const aTime = a[1].updatedAt ? new Date(a[1].updatedAt).getTime() : 0;
        const bTime = b[1].updatedAt ? new Date(b[1].updatedAt).getTime() : 0;
        // If times are equal or both missing, sort by messageId (snowflake) descending
        if (bTime === aTime) {
          return b[0].localeCompare(a[0]);
        }
        return bTime - aTime;
      });

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
    const mappings = await this.provider.read("role_mappings");
    mappings[messageId] = { guildId, channelId, roles };
    return this.provider.write("role_mappings", mappings);
  }

  async deleteRoleMapping(messageId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.deleteRoleMapping(messageId);
    }
    const mappings = await this.provider.read("role_mappings");
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
    return await this.provider.read("temporary_roles");
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
    const tempRoles = await this.provider.read("temporary_roles");
    if (!tempRoles[guildId]) tempRoles[guildId] = {};
    if (!tempRoles[guildId][userId]) tempRoles[guildId][userId] = {};
    tempRoles[guildId][userId][roleId] = { expiresAt, notifyExpiry };
    return this.provider.write("temporary_roles", tempRoles);
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeTemporaryRole(guildId, userId, roleId);
    }
    const tempRoles = await this.provider.read("temporary_roles");
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
    return await this.provider.read("polls");
  }

  async getPollById(pollId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getPollById(pollId);
    }
    const polls = await this.provider.read("polls");
    return polls[pollId] || null;
  }

  async getPollsByGuild(guildId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getPollsByGuild(guildId);
    }
    const polls = await this.provider.read("polls");
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
    const polls = await this.provider.read("polls");
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
    const polls = await this.provider.read("polls");
    polls[pollData.id] = pollData;
    return this.provider.write("polls", polls);
  }

  async updatePoll(pollId, pollData) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.updatePoll(pollId, pollData);
    }
    const polls = await this.provider.read("polls");
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
    const polls = await this.provider.read("polls");
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

  // Voice Control Roles methods
  async getVoiceControlRoles(guildId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.getVoiceControlRoles(guildId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    return (
      data[guildId] || {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      }
    );
  }

  async addVoiceDisconnectRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addVoiceDisconnectRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].disconnectRoleIds.includes(roleId)) {
      data[guildId].disconnectRoleIds.push(roleId);
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async removeVoiceDisconnectRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeVoiceDisconnectRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].disconnectRoleIds = data[guildId].disconnectRoleIds.filter(
        id => id !== roleId,
      );
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async addVoiceMuteRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addVoiceMuteRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].muteRoleIds.includes(roleId)) {
      data[guildId].muteRoleIds.push(roleId);
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async removeVoiceMuteRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeVoiceMuteRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].muteRoleIds = data[guildId].muteRoleIds.filter(
        id => id !== roleId,
      );
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async addVoiceDeafenRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addVoiceDeafenRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].deafenRoleIds.includes(roleId)) {
      data[guildId].deafenRoleIds.push(roleId);
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async removeVoiceDeafenRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeVoiceDeafenRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (data[guildId]) {
      data[guildId].deafenRoleIds = data[guildId].deafenRoleIds.filter(
        id => id !== roleId,
      );
    }
    return fileProvider.write("voice_control_roles", data);
  }

  async addVoiceMoveRole(guildId, roleId, channelId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.addVoiceMoveRole(guildId, roleId, channelId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (!data[guildId]) {
      data[guildId] = {
        guildId,
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };
    }
    if (!data[guildId].moveRoleMappings) {
      data[guildId].moveRoleMappings = {};
    }
    data[guildId].moveRoleMappings[roleId] = channelId;
    return fileProvider.write("voice_control_roles", data);
  }

  async removeVoiceMoveRole(guildId, roleId) {
    if (this.provider instanceof DatabaseProvider) {
      return this.provider.removeVoiceMoveRole(guildId, roleId);
    }
    // Fallback to file storage
    const fileProvider = new FileProvider(this.logger);
    const data = await fileProvider.read("voice_control_roles");
    if (data[guildId]?.moveRoleMappings) {
      delete data[guildId].moveRoleMappings[roleId];
    }
    return fileProvider.write("voice_control_roles", data);
  }

  // Generic storage methods for other features
  async read(collection) {
    if (this.provider instanceof DatabaseProvider) {
      // For other collections, use file-based storage
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.read(collection);
    }

    // Fallback to file storage when MongoDB is not available
    return await this.provider.read(collection);
  }

  async write(collection, data) {
    if (this.provider instanceof DatabaseProvider) {
      // For other collections, use file-based storage
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.write(collection, data);
    }

    // Fallback to file storage when MongoDB is not available
    return await this.provider.write(collection, data);
  }

  /**
   * Create a new payment record in the payments collection
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object|boolean>} Created payment or success status
   */
  async createPayment(paymentData) {
    if (this.provider instanceof DatabaseProvider) {
      if (this.dbManager && this.dbManager.payments) {
        return await this.dbManager.payments.create(paymentData);
      }
    }
    // Fallback or if not using DB (we don't persist separate payments file currently)
    return true;
  }

  // Generic get and set methods for AI avatar credits and other data
  async get(key) {
    return this.read(key);
  }

  async set(key, data) {
    return this.write(key, data);
  }

  // Guild Analytics explicit methods
  async updateGuildAnalytics(guildId, date, type, amount) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.updateGuildAnalytics(
        guildId,
        date,
        type,
        amount,
      );
    }
    // Fallback for file provider
    const data = await this.provider.read("guild_analytics");
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][date]) {
      data[guildId][date] = { joins: 0, leaves: 0, members: 0 };
    }
    data[guildId][date][type] += amount;
    return await this.provider.write("guild_analytics", data);
  }

  async getGuildAnalyticsHistory(guildId, startDate, endDate) {
    if (this.provider instanceof DatabaseProvider) {
      const history = await this.provider.getGuildAnalyticsHistory(
        guildId,
        startDate,
        endDate,
      );
      // Map MongoDB documents to the format expected by AnalyticsManager
      return history.map(h => ({
        date: h.date,
        joins: h.joins || 0,
        leaves: h.leaves || 0,
        members: h.members || 0,
      }));
    }

    // File provider fallback
    const data = await this.provider.read("guild_analytics");
    const guildData = data[guildId] || {};
    const history = [];

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateKey = current.toISOString().split("T")[0];
      const dayData = guildData[dateKey] || { joins: 0, leaves: 0, members: 0 };
      history.push({
        date: dateKey,
        ...dayData,
      });
      current.setDate(current.getDate() + 1);
    }

    return history;
  }

  async cleanupOldAnalytics(cutoffDate) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.cleanupOldAnalytics(cutoffDate);
    }

    // File provider fallback
    const data = await this.provider.read("guild_analytics");
    let modified = false;
    for (const guildId in data) {
      for (const dateKey in data[guildId]) {
        if (dateKey < cutoffDate) {
          delete data[guildId][dateKey];
          modified = true;
        }
      }
    }
    if (modified) {
      await this.provider.write("guild_analytics", data);
    }
    return 0; // Don't track count for file-based
  }

  // User Experience explicit methods
  async getUserExperience(guildId, userId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getUserExperience(guildId, userId);
    }
    const data = await this.provider.read("user_experience");
    return data[`${guildId}_${userId}`] || null;
  }

  async getUserExperienceByGuild(guildId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getUserExperienceByGuild(guildId);
    }
    const data = await this.provider.read("user_experience");
    return Object.values(data).filter(u => u.guildId === guildId);
  }

  async setUserExperience(guildId, userId, userData) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.setUserExperience(guildId, userId, userData);
    }
    const data = await this.provider.read("user_experience");
    data[`${guildId}_${userId}`] = userData;
    return await this.provider.write("user_experience", data);
  }

  async getUserExperienceLeaderboard(guildId, limit = 10) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getUserExperienceLeaderboard(guildId, limit);
    }
    const data = await this.provider.read("user_experience");
    return Object.entries(data)
      .filter(([key]) => key.startsWith(`${guildId}_`))
      .map(([key, value]) => ({
        userId: key.split("_")[1],
        guildId,
        ...value,
      }))
      .sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0))
      .slice(0, limit);
  }

  // Core Credits explicit methods
  async getCoreCredits(userId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getCoreCredits(userId);
    }
    const data = await this.provider.read("core_credit");
    return data[userId] || null;
  }

  async setCoreCredits(userId, userData) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.setCoreCredits(userId, userData);
    }
    const data = await this.provider.read("core_credit");
    data[userId] = userData;
    return await this.provider.write("core_credit", data);
  }

  async updateCoreCredits(userId, creditsChange) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.updateCoreCredits(userId, creditsChange);
    }
    const data = await this.provider.read("core_credit");
    if (!data[userId]) {
      data[userId] = { credits: 0, lastUpdated: new Date().toISOString() };
    }
    data[userId].credits = (data[userId].credits || 0) + creditsChange;
    data[userId].lastUpdated = new Date().toISOString();
    return await this.provider.write("core_credit", data);
  }

  // Moderation explicit methods
  async logModerationAction(actionData) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.logModerationAction(actionData);
    }
    // File fallback handled in moderation utils via generic get/set for now
    // but we can make it explicit here if we want to refactor fully
    const moderationLogs = (await this.provider.read("moderation_logs")) || {};
    if (!moderationLogs[actionData.guildId])
      moderationLogs[actionData.guildId] = {};
    if (!moderationLogs[actionData.guildId][actionData.userId])
      moderationLogs[actionData.guildId][actionData.userId] = [];

    const logEntry = {
      ...actionData,
      timestamp: actionData.timestamp || new Date().toISOString(),
    };
    moderationLogs[actionData.guildId][actionData.userId].push(logEntry);

    // Keep only last 100 entries per user
    if (moderationLogs[actionData.guildId][actionData.userId].length > 100) {
      moderationLogs[actionData.guildId][actionData.userId] =
        moderationLogs[actionData.guildId][actionData.userId].slice(-100);
    }

    return await this.provider.write("moderation_logs", moderationLogs);
  }

  async getModerationHistory(guildId, userId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getModerationHistory(guildId, userId);
    }
    const moderationLogs = (await this.provider.read("moderation_logs")) || {};
    return moderationLogs[guildId]?.[userId] || [];
  }

  async getAllModerationHistory(guildId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getAllModerationHistory(guildId);
    }
    const moderationLogs = (await this.provider.read("moderation_logs")) || {};
    if (!moderationLogs[guildId]) return [];

    const allHistory = [];
    for (const [userId, userHistory] of Object.entries(
      moderationLogs[guildId],
    )) {
      for (const log of userHistory) {
        allHistory.push({ ...log, userId });
      }
    }
    return allHistory;
  }

  async getWarnCount(guildId, userId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.getWarnCount(guildId, userId);
    }
    const history = await this.getModerationHistory(guildId, userId);
    return history.filter(log => log.action === "warn").length;
  }

  async removeWarning(guildId, userId, caseId) {
    if (this.provider instanceof DatabaseProvider) {
      return await this.provider.removeWarning(guildId, userId, caseId);
    }
    const moderationLogs = (await this.provider.read("moderation_logs")) || {};
    if (!moderationLogs[guildId]?.[userId]) return false;

    const initialLength = moderationLogs[guildId][userId].length;
    moderationLogs[guildId][userId] = moderationLogs[guildId][userId].filter(
      log => !(log.action === "warn" && log.caseId === caseId),
    );

    const removed = moderationLogs[guildId][userId].length < initialLength;
    if (removed) {
      await this.provider.write("moderation_logs", moderationLogs);
    }
    return removed;
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
