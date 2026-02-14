import { getLogger } from "../logger.js";
import {
  RoleMappingRepository,
  TemporaryRoleRepository,
  UserExperienceRepository,
  WelcomeSettingsRepository,
  GoodbyeSettingsRepository,
  VoiceControlRepository,
  GuildSettingsRepository,
  ConversationRepository,
  ImageJobRepository,
  PollRepository,
  CoreCreditsRepository,
  ScheduledRoleRepository,
  RecurringScheduleRepository,
  UserRepository,
  PaymentRepository,
  CommandUsageRepository,
  GuildAnalyticsRepository,
  ModerationLogRepository,
} from "./repositories/index.js";
import { CacheManager } from "../cache/CacheManager.js";
import { QueryCache } from "../cache/QueryCache.js";
import { ConnectionManager } from "./ConnectionManager.js";

const queryCache = new QueryCache();

// Cleanup caches every 5 minutes
setInterval(
  () => {
    queryCache.clear();
  },
  5 * 60 * 1000,
).unref();

class DatabaseManager {
  constructor() {
    this.logger = getLogger();
    // Load database config with fallback to environment variables
    this._dbConfig = null;
    this._configPromise = this._loadDatabaseConfig();
    this.connectionManager = null;
    this.cacheManager = new CacheManager();
    this.roleMappings = null;
    this.temporaryRoles = null;
    this.userExperience = null;
    this.welcomeSettings = null;
    this.goodbyeSettings = null;
    this.guildSettings = null;
    this.polls = null;
    this.coreCredits = null;
    this.voiceControlRoles = null;
    this.recurringSchedules = null;
    this.scheduledRoles = null;
    this.conversations = null;
    this.avatarJobs = null;
    this.imagineJobs = null;
    this.users = null;
    this.payments = null;
    this.commandUsage = null;
    this.guildAnalytics = null;
    this.moderationLogs = null;
    // Initialize connection manager asynchronously (non-blocking)
    this._initializeConnectionManager().catch(() => {
      // Silently fail - will be initialized on first connect
    });
  }

  async _loadDatabaseConfig() {
    try {
      const configModule = await import("../../config/config.js").catch(
        () => null,
      );
      const config =
        configModule?.config || configModule?.default || configModule || {};
      return (
        config.database || {
          uri: process.env.MONGODB_URI || process.env.MONGO_URI || "",
          name:
            process.env.MONGODB_DB_NAME ||
            process.env.MONGO_DB_NAME ||
            "role_reactor",
          options: {},
        }
      );
    } catch {
      return {
        uri: process.env.MONGODB_URI || process.env.MONGO_URI || "",
        name:
          process.env.MONGODB_DB_NAME ||
          process.env.MONGO_DB_NAME ||
          "role_reactor",
        options: {},
      };
    }
  }

  async _initializeConnectionManager() {
    this._dbConfig = await this._configPromise;
    this.connectionManager = new ConnectionManager(this.logger, this._dbConfig);
  }

  async _ensureConnectionManager() {
    if (!this.connectionManager) {
      await this._initializeConnectionManager();
    }
    return this.connectionManager;
  }

  async connect() {
    try {
      await this._ensureConnectionManager();
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
        this.users = new UserRepository(db, this.cacheManager, this.logger);
        this.payments = new PaymentRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.commandUsage = new CommandUsageRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.guildAnalytics = new GuildAnalyticsRepository(
          db,
          this.cacheManager,
          this.logger,
        );
        this.moderationLogs = new ModerationLogRepository(
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
    if (this.connectionManager) {
      await this.connectionManager.close();
    }
  }

  async healthCheck() {
    await this._ensureConnectionManager();
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

// Alias for backward compatibility or clarity if needed
export const getStorageManager = getDatabaseManager;
