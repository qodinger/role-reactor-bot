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
      // Close old client before reconnecting to prevent orphaned connections
      if (this.client) {
        await this.client.close().catch(() => {});
        this.client = null;
        this.db = null;
      }
      this.logger.info("🔌 Attempting to connect to MongoDB...");
      this.client = new MongoClient(this.config.uri, {
        ...this.config.options,
        // Enhanced connection pooling - optimized for resource efficiency
        // Lower minPoolSize reduces compute usage on MongoDB Atlas Flex tier
        maxPoolSize: Math.max(2, this.config.options.maxPoolSize || 5),
        minPoolSize: Math.max(1, this.config.options.minPoolSize || 1),
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
        maxConnecting: Math.max(2, this.config.options.maxConnecting || 2),
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
      } else if (error.message.includes("ETIMEOUT")) {
        this.logger.warn("⏱️ Connection timeout - network may be slow");
      } else if (error.message.includes("ENOTFOUND")) {
        this.logger.warn(
          "🔍 DNS lookup failed - check MongoDB URI configuration",
        );
      }

      throw error;
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
        if (this.client && this.db && this.isConnected) {
          await this.db.admin().ping();
        }
      } catch (_error) {
        if (this.isConnected) {
          this.logger.warn(
            "⚠️ MongoDB connection lost, attempting to reconnect...",
          );
          this.isConnected = false;
          this.connectionPromise = null; // Reset promise to allow retry
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
    const delay = this.reconnectDelay * this.reconnectAttempts;
    this.logger.info(
      `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`,
    );

    setTimeout(async () => {
      try {
        await this._connect();
      } catch (error) {
        this.logger.error("❌ Reconnection attempt failed", error?.message);
      }
    }, delay);
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

      // Drop old non-unique referrals.refereeId_1 index so it can be recreated
      // with unique:true, sparse:true by ReferralRepository._ensureIndexes()
      try {
        const referralsCollection = this.db.collection("referrals");
        const referralIndexes = await referralsCollection
          .listIndexes()
          .toArray();
        for (const index of referralIndexes) {
          if (index.name === "referrals.refereeId_1" && !index.unique) {
            this.logger.info(
              `Dropping old non-unique index: ${index.name} from referrals`,
            );
            await referralsCollection.dropIndex("referrals.refereeId_1");
          }
        }
      } catch (error) {
        this.logger.debug("No old referrals indexes to drop:", error.message);
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

      const indexSpecs = [
        ["role_mappings", { messageId: 1 }, { unique: true }],
        // Supports getByGuildPaginated ({guildId} + sort updatedAt)
        ["role_mappings", { guildId: 1, updatedAt: -1 }, {}],
        ["temporary_roles", { expiresAt: 1 }, {}],
        ["temporary_roles", { guildId: 1 }, {}],
        ["temporary_roles", { roleId: 1 }, {}],
        ["welcome_settings", { guildId: 1 }, { unique: true }],
        ["user_experience", { guildId: 1, userId: 1 }, { unique: true }],
        ["polls", { id: 1 }, { unique: true }],
        ["polls", { guildId: 1 }, {}],
        ["polls", { createdAt: 1 }, {}],
        ["core_credits", { userId: 1 }, { unique: true }],
        ["core_credits", { lastUpdated: 1 }, {}],
        ["scheduled_roles", { id: 1 }, { unique: true }],
        ["scheduled_roles", { guildId: 1 }, {}],
        ["scheduled_roles", { scheduledAt: 1 }, {}],
        ["scheduled_roles", { executed: 1 }, {}],
        ["recurring_schedules", { id: 1 }, { unique: true }],
        ["recurring_schedules", { guildId: 1 }, {}],
        ["recurring_schedules", { active: 1 }, {}],
        ["ai_conversations", { userId: 1, guildId: 1 }, { unique: true }],
        ["ai_conversations", { lastActivity: 1 }, {}],
        ["avatar_jobs", { jobId: 1 }, { unique: true }],
        ["avatar_jobs", { userId: 1 }, {}],
        ["avatar_jobs", { createdAt: 1 }, {}],
        ["avatar_jobs", { expiresAt: 1 }, {}],
        ["imagine_jobs", { jobId: 1 }, { unique: true }],
        ["imagine_jobs", { userId: 1 }, {}],
        ["imagine_jobs", { createdAt: 1 }, {}],
        ["imagine_jobs", { expiresAt: 1 }, {}],
        ["command_usage", { commandName: 1 }, { unique: true }],
        ["guild_analytics", { guildId: 1, date: 1 }, { unique: true }],
        ["moderation_logs", { guildId: 1 }, {}],
        ["moderation_logs", { userId: 1 }, {}],
        ["moderation_logs", { caseId: 1 }, { unique: true }],
        ["moderation_logs", { timestamp: -1 }, {}],
        // Missing guild-scoped indexes
        ["goodbye_settings", { guildId: 1 }, { unique: true }],
        ["guild_automod", { guildId: 1 }, { unique: true }],
        ["custom_commands", { guildId: 1 }, {}],
        ["voice_control_roles", { guildId: 1 }, {}],
        ["tickets", { guildId: 1 }, {}],
        ["ticket_panels", { guildId: 1 }, {}],
        ["ticket_transcripts", { guildId: 1 }, {}],
        ["guild_count_history", { date: 1 }, { unique: true }],
        ["guild_history", { guildId: 1 }, { unique: true }],
        ["guild_history", { status: 1 }, {}],
        // Recent command users indexes
        [
          "recent_command_users",
          { timestamp: 1 },
          { expireAfterSeconds: 604800 },
        ], // 7 days TTL
        ["recent_command_users", { userId: 1, timestamp: 1 }, {}],
        // BMAC payment indexes
        ["unclaimed_payments", { bmacPaymentId: 1 }, {}],
        ["unclaimed_payments", { status: 1 }, {}],
        ["unclaimed_payments", { timestamp: -1 }, {}],
        ["pending_codes", { code: 1 }, { unique: true }],
        // Auto-delete expired codes
        ["pending_codes", { expiresAt: 1 }, { expireAfterSeconds: 0 }],
        ["payments", { bmacPaymentId: 1 }, { sparse: true }],
      ];

      // createIndex is idempotent — run all in parallel on the pooled connection
      await Promise.all(
        indexSpecs.map(([collection, spec, options]) =>
          this.db.collection(collection).createIndex(spec, options),
        ),
      );

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
