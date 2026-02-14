import { MongoClient } from "mongodb";

export class ConnectionManager {
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
        // Enhanced connection pooling - optimized for resource efficiency
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
        .createIndex({ userId: 1, guildId: 1 }, { unique: true });
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
      await this.db
        .collection("command_usage")
        .createIndex({ commandName: 1 }, { unique: true });
      await this.db
        .collection("guild_analytics")
        .createIndex({ guildId: 1, date: 1 }, { unique: true });
      await this.db.collection("moderation_logs").createIndex({ guildId: 1 });
      await this.db.collection("moderation_logs").createIndex({ userId: 1 });
      await this.db
        .collection("moderation_logs")
        .createIndex({ caseId: 1 }, { unique: true });
      await this.db
        .collection("moderation_logs")
        .createIndex({ timestamp: -1 });

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
