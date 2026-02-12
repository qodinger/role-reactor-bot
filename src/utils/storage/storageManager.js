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

  /**
   * Migrate core_credit data from local JSON to MongoDB
   */
  async migrateCoreCreditsToDatabase() {
    try {
      this.logger.info("🔄 Checking for local core_credit data to migrate...");

      const fileProvider = new FileProvider(this.logger);
      const localData = await fileProvider.read("core_credit");

      if (Object.keys(localData).length === 0) {
        this.logger.info("📁 No local core_credit data to migrate");
        return;
      }

      // Check if database has any core credits
      const dbCount =
        await this.dbManager.coreCredits.collection.countDocuments();
      if (dbCount > 0) {
        this.logger.info(
          `📊 Database already has ${dbCount} core_credit records, skipping migration`,
        );
        return;
      }

      this.logger.info("🔄 Migrating core_credit data to database...");
      let migratedCount = 0;
      for (const [userId, userData] of Object.entries(localData)) {
        try {
          // eslint-disable-next-line no-unused-vars
          const { _id, ...cleanUserData } = userData;
          if (
            cleanUserData.lastUpdated &&
            typeof cleanUserData.lastUpdated === "string"
          ) {
            cleanUserData.lastUpdated = new Date(cleanUserData.lastUpdated);
          }
          await this.provider.setCoreCredits(userId, cleanUserData);
          migratedCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to migrate core_credit for user ${userId}:`,
            error.message,
          );
        }
      }

      this.logger.success(
        `✅ Successfully migrated ${migratedCount} core_credit records to database`,
      );

      // Automatically archive local file after successful migration
      await fileProvider.archive("core_credit");
      this.logger.info(
        "📦 Archived local core_credit.json to core_credit.json.migrated",
      );
    } catch (error) {
      this.logger.error("❌ core_credit migration failed:", error);
    }
  }

  /**
   * Migrate user_experience data from local JSON to MongoDB
   */
  async migrateUserExperienceToDatabase() {
    try {
      this.logger.info(
        "🔄 Checking for local user_experience data to migrate...",
      );

      const fileProvider = new FileProvider(this.logger);
      const localData = await fileProvider.read("user_experience");

      if (Object.keys(localData).length === 0) {
        this.logger.info("📁 No local user_experience data to migrate");
        return;
      }

      // Check if database already has user experience data
      const dbCount =
        await this.dbManager.userExperience.collection.countDocuments();
      if (dbCount > 0) {
        this.logger.info(
          `📊 Database already has ${dbCount} user_experience records, skipping migration`,
        );
        return;
      }

      this.logger.info("🔄 Migrating user_experience data to database...");
      let migratedCount = 0;
      for (const [key, userData] of Object.entries(localData)) {
        try {
          const [guildId, userId] = key.split("_");
          if (guildId && userId) {
            // eslint-disable-next-line no-unused-vars
            const { _id, ...cleanUserData } = userData;
            // Convert strings to Dates
            if (
              cleanUserData.lastMessageAt &&
              typeof cleanUserData.lastMessageAt === "string"
            ) {
              cleanUserData.lastMessageAt = new Date(
                cleanUserData.lastMessageAt,
              );
            }
            if (
              cleanUserData.updatedAt &&
              typeof cleanUserData.updatedAt === "string"
            ) {
              cleanUserData.updatedAt = new Date(cleanUserData.updatedAt);
            }
            await this.provider.setUserExperience(
              guildId,
              userId,
              cleanUserData,
            );
            migratedCount++;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to migrate user_experience for ${key}:`,
            error.message,
          );
        }
      }

      this.logger.success(
        `✅ Successfully migrated ${migratedCount} user_experience records to database`,
      );

      // Automatically archive local file after successful migration
      await fileProvider.archive("user_experience");
      this.logger.info(
        "📦 Archived local user_experience.json to user_experience.json.migrated",
      );
    } catch (error) {
      this.logger.error("❌ user_experience migration failed:", error);
    }
  }

  /**
   * Migrate data from local files to database when MongoDB becomes available
   */
  async migrateLocalDataToDatabase() {
    try {
      this.logger.info("🔄 Checking for remaining local data to migrate...");
      const fileProvider = new FileProvider(this.logger);

      // 1. Migrate Polls
      const localPolls = await fileProvider.read("polls");
      const localPollCount = Object.keys(localPolls).length;

      if (localPollCount > 0) {
        const dbPolls = await this.provider.getAllPolls();
        if (Object.keys(dbPolls).length === 0) {
          this.logger.info(
            `🔄 Migrating ${localPollCount} polls to database...`,
          );
          let migratedCount = 0;
          for (const pollData of Object.values(localPolls)) {
            try {
              await this.provider.createPoll(pollData);
              migratedCount++;
            } catch (error) {
              this.logger.warn(`Failed to migrate poll:`, error.message);
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} polls`,
          );
          await fileProvider.archive("polls");
        }
      }

      // 2. Migrate Moderation Logs
      const localModLogs = await fileProvider.read("moderation_logs");
      if (Object.keys(localModLogs).length > 0) {
        const dbCount =
          await this.dbManager.moderationLogs.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating moderation logs to database...");
          let migratedCount = 0;
          for (const [guildId, guildLogs] of Object.entries(localModLogs)) {
            for (const [userId, userLogs] of Object.entries(guildLogs)) {
              for (const log of userLogs) {
                try {
                  const logToMigrate = {
                    ...log,
                    guildId: log.guildId || guildId,
                    userId: log.userId || userId,
                  };
                  if (
                    logToMigrate.timestamp &&
                    typeof logToMigrate.timestamp === "string"
                  ) {
                    logToMigrate.timestamp = new Date(logToMigrate.timestamp);
                  }
                  await this.dbManager.moderationLogs.create(logToMigrate);
                  migratedCount++;
                } catch (error) {
                  this.logger.warn(
                    "Failed to migrate moderation log:",
                    error.message,
                  );
                }
              }
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} moderation logs`,
          );
          await fileProvider.archive("moderation_logs");
        }
      }

      // 3. Migrate Scheduled Roles
      const localSchedRoles = await fileProvider.read("scheduled_roles");
      if (Object.keys(localSchedRoles).length > 0) {
        const dbCount =
          await this.dbManager.scheduledRoles.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating scheduled roles to database...");
          let migratedCount = 0;
          for (const schedule of Object.values(localSchedRoles)) {
            try {
              await this.dbManager.scheduledRoles.create(schedule);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                "Failed to migrate scheduled role:",
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} scheduled roles`,
          );
          await fileProvider.archive("scheduled_roles");
        }
      }

      // 4. Migrate Recurring Schedules
      const localRecurSchedules = await fileProvider.read(
        "recurring_schedules",
      );
      if (Object.keys(localRecurSchedules).length > 0) {
        const dbCount =
          await this.dbManager.recurringSchedules.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating recurring schedules to database...");
          let migratedCount = 0;
          for (const schedule of Object.values(localRecurSchedules)) {
            try {
              if (
                schedule.lastExecutedAt &&
                typeof schedule.lastExecutedAt === "string"
              ) {
                schedule.lastExecutedAt = new Date(schedule.lastExecutedAt);
              }
              await this.dbManager.recurringSchedules.create(schedule);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                "Failed to migrate recurring schedule:",
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} recurring schedules`,
          );
          await fileProvider.archive("recurring_schedules");
        }
      }

      // 5. Migrate Voice Control Roles
      const localVoiceRoles = await fileProvider.read("voice_control_roles");
      if (Object.keys(localVoiceRoles).length > 0) {
        const dbCount =
          await this.dbManager.voiceControlRoles.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating voice control roles to database...");
          let migratedCount = 0;
          for (const [guildId, roleData] of Object.entries(localVoiceRoles)) {
            try {
              await this.dbManager.voiceControlRoles.set(guildId, roleData);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to migrate voice roles for ${guildId}:`,
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} voice control roles`,
          );
          await fileProvider.archive("voice_control_roles");
        }
      }

      // 6. Migrate Role Mappings
      const localRoleMappings = await fileProvider.read("role_mappings");
      if (Object.keys(localRoleMappings).length > 0) {
        const dbCount =
          await this.dbManager.roleMappings.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating role mappings to database...");
          let migratedCount = 0;
          for (const [messageId, mapping] of Object.entries(
            localRoleMappings,
          )) {
            try {
              await this.dbManager.roleMappings.set(
                messageId,
                mapping.guildId,
                mapping.channelId,
                mapping.roles,
              );
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to migrate role mapping ${messageId}:`,
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} role mappings`,
          );
          await fileProvider.archive("role_mappings");
        }
      }

      // 7. Migrate Temporary Roles
      const localTempRoles = await fileProvider.read("temporary_roles");
      if (Object.keys(localTempRoles).length > 0) {
        const dbCount =
          await this.dbManager.temporaryRoles.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating temporary roles to database...");
          let migratedCount = 0;
          for (const [guildId, users] of Object.entries(localTempRoles)) {
            for (const [userId, roles] of Object.entries(users)) {
              for (const [roleId, data] of Object.entries(roles)) {
                try {
                  await this.dbManager.temporaryRoles.add(
                    guildId,
                    userId,
                    roleId,
                    new Date(data.expiresAt),
                    data.notifyExpiry,
                  );
                  migratedCount++;
                } catch (error) {
                  this.logger.warn(
                    `Failed to migrate temp role ${roleId}:`,
                    error.message,
                  );
                }
              }
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} temporary roles`,
          );
          await fileProvider.archive("temporary_roles");
        }
      }

      // 8. Migrate Guild Settings
      const localGuildSettings = await fileProvider.read("guild_settings");
      if (Object.keys(localGuildSettings).length > 0) {
        const dbCount =
          await this.dbManager.guildSettings.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating guild settings to database...");
          let migratedCount = 0;
          for (const [guildId, settings] of Object.entries(
            localGuildSettings,
          )) {
            try {
              await this.dbManager.guildSettings.set(guildId, settings);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to migrate guild settings for ${guildId}:`,
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} guild settings`,
          );
          await fileProvider.archive("guild_settings");
        }
      }

      // 9. Migrate Welcome Settings
      const localWelcomeSettings = await fileProvider.read("welcome_settings");
      if (Object.keys(localWelcomeSettings).length > 0) {
        const dbCount =
          await this.dbManager.welcomeSettings.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating welcome settings to database...");
          let migratedCount = 0;
          for (const [guildId, settings] of Object.entries(
            localWelcomeSettings,
          )) {
            try {
              await this.dbManager.welcomeSettings.set(guildId, settings);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to migrate welcome settings for ${guildId}:`,
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} welcome settings`,
          );
          await fileProvider.archive("welcome_settings");
        }
      }

      // 10. Migrate Goodbye Settings
      const localGoodbyeSettings = await fileProvider.read("goodbye_settings");
      if (Object.keys(localGoodbyeSettings).length > 0) {
        const dbCount =
          await this.dbManager.goodbyeSettings.collection.countDocuments();
        if (dbCount === 0) {
          this.logger.info("🔄 Migrating goodbye settings to database...");
          let migratedCount = 0;
          for (const [guildId, settings] of Object.entries(
            localGoodbyeSettings,
          )) {
            try {
              await this.dbManager.goodbyeSettings.set(guildId, settings);
              migratedCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to migrate goodbye settings for ${guildId}:`,
                error.message,
              );
            }
          }
          this.logger.success(
            `✅ Successfully migrated ${migratedCount} goodbye settings`,
          );
          await fileProvider.archive("goodbye_settings");
        }
      }

      this.logger.info("🏁 Local data migration check completed");
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
        this.dbManager = dbManager; // Store dbManager for direct access
        this.provider = new DatabaseProvider(dbManager, this.logger);
        this.logger.success("✅ Database storage enabled");

        // Migrate data from local files to database
        await this.migrateLocalDataToDatabase();

        // Migrate core_credit data from JSON file to MongoDB if needed
        await this.migrateCoreCreditsToDatabase();

        // Migrate user_experience data from JSON file to MongoDB if needed
        await this.migrateUserExperienceToDatabase();

        // Migrate analytics data from local files if needed
        await this.migrateAnalyticsToDatabase();
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

  /**
   * Migrate analytics data from local files to database
   */
  async migrateAnalyticsToDatabase() {
    try {
      this.logger.info("🔄 Checking for local analytics data to migrate...");

      const fileProvider = new FileProvider(this.logger);
      const localData = await fileProvider.read("guild_analytics");

      if (Object.keys(localData).length === 0) {
        this.logger.info("📁 No local analytics data to migrate");
        return;
      }

      // Check if database has any analytics
      const dbCount =
        await this.dbManager.guildAnalytics.collection.countDocuments();
      if (dbCount > 0) {
        this.logger.info(
          `📊 Database already has ${dbCount} analytics records, skipping migration`,
        );
        return;
      }

      this.logger.info("🔄 Migrating analytics data to database...");
      const migratedCount =
        await this.dbManager.guildAnalytics.migrateFromJson(localData);

      this.logger.success(
        `✅ Successfully migrated ${migratedCount} analytics records to database`,
      );

      // Automatically archive local file after successful migration
      await fileProvider.archive("guild_analytics");
      this.logger.info(
        "📦 Archived local guild_analytics.json to guild_analytics.json.migrated",
      );
    } catch (error) {
      this.logger.error("❌ Analytics migration failed:", error);
    }
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
