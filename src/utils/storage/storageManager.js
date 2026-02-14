import { getLogger } from "../logger.js";
import { getDatabaseManager } from "./databaseManager.js";
import { FileProvider } from "./FileProvider.js";
import { DatabaseProvider } from "./DatabaseProvider.js";

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
        this.dbManager = dbManager;
        this.provider = new DatabaseProvider(dbManager, this.logger);
        this.logger.success("✅ Database storage enabled");
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

  // --- Delegation Methods ---

  async getRoleMappings() {
    return this.provider.getRoleMappings();
  }

  async getRoleMappingsPaginated(guildId, page = 1, limit = 4) {
    return this.provider.getRoleMappingsPaginated(guildId, page, limit);
  }

  async setRoleMapping(messageId, guildId, channelId, roles) {
    return this.provider.setRoleMapping(messageId, guildId, channelId, roles);
  }

  async deleteRoleMapping(messageId) {
    return this.provider.deleteRoleMapping(messageId);
  }

  async cleanupExpiredRoles() {
    return this.provider.cleanupExpiredRoles();
  }

  async getTemporaryRoles() {
    return this.provider.getTemporaryRoles();
  }

  async addTemporaryRole(
    guildId,
    userId,
    roleId,
    expiresAt,
    notifyExpiry = false,
  ) {
    return this.provider.addTemporaryRole(
      guildId,
      userId,
      roleId,
      expiresAt,
      notifyExpiry,
    );
  }

  async removeTemporaryRole(guildId, userId, roleId) {
    return this.provider.removeTemporaryRole(guildId, userId, roleId);
  }

  async getAllPolls() {
    return this.provider.getAllPolls();
  }

  async getPollById(pollId) {
    return this.provider.getPollById(pollId);
  }

  async getPollsByGuild(guildId) {
    return this.provider.getPollsByGuild(guildId);
  }

  async getPollByMessageId(messageId) {
    return this.provider.getPollByMessageId(messageId);
  }

  async createPoll(pollData) {
    return this.provider.createPoll(pollData);
  }

  async updatePoll(pollId, pollData) {
    return this.provider.updatePoll(pollId, pollData);
  }

  async deletePoll(pollId) {
    return this.provider.deletePoll(pollId);
  }

  async cleanupEndedPolls() {
    return this.provider.cleanupEndedPolls();
  }

  async getVoiceControlRoles(guildId) {
    return this.provider.getVoiceControlRoles(guildId);
  }

  async addVoiceDisconnectRole(guildId, roleId) {
    return this.provider.addVoiceDisconnectRole(guildId, roleId);
  }

  async removeVoiceDisconnectRole(guildId, roleId) {
    return this.provider.removeVoiceDisconnectRole(guildId, roleId);
  }

  async addVoiceMuteRole(guildId, roleId) {
    return this.provider.addVoiceMuteRole(guildId, roleId);
  }

  async removeVoiceMuteRole(guildId, roleId) {
    return this.provider.removeVoiceMuteRole(guildId, roleId);
  }

  async addVoiceDeafenRole(guildId, roleId) {
    return this.provider.addVoiceDeafenRole(guildId, roleId);
  }

  async removeVoiceDeafenRole(guildId, roleId) {
    return this.provider.removeVoiceDeafenRole(guildId, roleId);
  }

  async addVoiceMoveRole(guildId, roleId, channelId) {
    return this.provider.addVoiceMoveRole(guildId, roleId, channelId);
  }

  async removeVoiceMoveRole(guildId, roleId) {
    return this.provider.removeVoiceMoveRole(guildId, roleId);
  }

  async updateGuildAnalytics(guildId, date, type, amount) {
    return this.provider.updateGuildAnalytics(guildId, date, type, amount);
  }

  async getGuildAnalyticsHistory(guildId, startDate, endDate) {
    return this.provider.getGuildAnalyticsHistory(guildId, startDate, endDate);
  }

  async cleanupOldAnalytics(cutoffDate) {
    return this.provider.cleanupOldAnalytics(cutoffDate);
  }

  async getUserExperience(guildId, userId) {
    return this.provider.getUserExperience(guildId, userId);
  }

  async getUserExperienceByGuild(guildId) {
    return this.provider.getUserExperienceByGuild(guildId);
  }

  async setUserExperience(guildId, userId, userData) {
    return this.provider.setUserExperience(guildId, userId, userData);
  }

  async getUserExperienceLeaderboard(guildId, limit = 10) {
    return this.provider.getUserExperienceLeaderboard(guildId, limit);
  }

  async getCoreCredits(userId) {
    return this.provider.getCoreCredits(userId);
  }

  async setCoreCredits(userId, userData) {
    return this.provider.setCoreCredits(userId, userData);
  }

  async updateCoreCredits(userId, creditsChange) {
    return this.provider.updateCoreCredits(userId, creditsChange);
  }

  async logModerationAction(actionData) {
    return this.provider.logModerationAction(actionData);
  }

  async getModerationHistory(guildId, userId) {
    return this.provider.getModerationHistory(guildId, userId);
  }

  async getAllModerationHistory(guildId) {
    return this.provider.getAllModerationHistory(guildId);
  }

  async getWarnCount(guildId, userId) {
    return this.provider.getWarnCount(guildId, userId);
  }

  async removeWarning(guildId, userId, caseId) {
    return this.provider.removeWarning(guildId, userId, caseId);
  }

  async createPayment(paymentData) {
    if (this.provider instanceof DatabaseProvider) {
      if (this.dbManager && this.dbManager.payments) {
        return await this.dbManager.payments.create(paymentData);
      }
    }
    return true;
  }

  // Generic storage methods
  async read(collection) {
    if (this.provider instanceof DatabaseProvider) {
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.read(collection);
    }
    return await this.provider.read(collection);
  }

  async write(collection, data) {
    if (this.provider instanceof DatabaseProvider) {
      const fileProvider = new FileProvider(this.logger);
      return await fileProvider.write(collection, data);
    }
    return await this.provider.write(collection, data);
  }

  async get(key) {
    return this.read(key);
  }

  async set(key, data) {
    return this.write(key, data);
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

export { FileProvider, DatabaseProvider };
