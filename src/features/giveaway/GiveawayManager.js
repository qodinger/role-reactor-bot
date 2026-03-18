/**
 * GiveawayManager - Manages giveaway lifecycle, entries, and winner selection
 * @module features/giveaway/GiveawayManager
 */

import { EventEmitter } from "events";
import { ObjectId } from "mongodb";
import { getLogger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { FREE_TIER, PRO_TIER } from "../premium/config.js";
import { getPremiumManager } from "../premium/PremiumManager.js";

const logger = getLogger();

class GiveawayManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.db = null;
    this.collection = null;
    this.settingsCollection = null;
    this.checkInterval = null;
    this.CHECK_INTERVAL_MS = 30000; // Check every 30 seconds (optimized from 10s)
    this.premiumManager = getPremiumManager();

    // Caching for active giveaways
    this.activeGiveawaysCache = new Map();
    this.cacheTimestamp = null;
    this.CACHE_TTL_MS = 60000; // Cache valid for 1 minute

    // Rate limiting cache: userId => { count, lastGiveaway }
    this.rateLimitCache = new Map();

    // Performance metrics
    this.metrics = {
      lastCheckTime: 0,
      totalChecks: 0,
      giveawaysEnded: 0,
      averageCheckDuration: 0,
    };
  }

  /**
   * Initialize the giveaway manager
   */
  async init() {
    try {
      const dbManager = await getDatabaseManager();
      // Access the database from connectionManager after connect() is called
      await dbManager.connect();
      this.db = dbManager.connectionManager.db;
      this.collection = this.db.collection("giveaways");
      this.settingsCollection = this.db.collection("giveaway_settings");

      // Create indexes for better query performance
      await this.collection.createIndex({ guildId: 1, status: 1 });
      await this.collection.createIndex({ endTime: 1, status: 1 });
      await this.collection.createIndex({ messageId: 1 });
      await this.collection.createIndex({ host: 1, status: 1 });
      await this.collection.createIndex({ guildId: 1, host: 1, status: 1 });

      // Settings collection indexes
      await this.settingsCollection.createIndex(
        { guildId: 1 },
        { unique: true },
      );

      logger.info("🎉 GiveawayManager initialized");

      // Start the giveaway check interval
      this.startCheckInterval();
    } catch (error) {
      logger.error("❌ Failed to initialize GiveawayManager:", error);
      throw error;
    }
  }

  /**
   * Start the interval to check for ending giveaways
   */
  startCheckInterval() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkEndingGiveaways();
    }, this.CHECK_INTERVAL_MS);

    logger.debug("🕐 Giveaway check interval started");
  }

  /**
   * Stop the check interval
   */
  stopCheckInterval() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.debug("🛑 Giveaway check interval stopped");
    }
  }

  /**
   * Check for giveaways that should end (OPTIMIZED with caching)
   */
  async checkEndingGiveaways() {
    const startTime = Date.now();

    try {
      // Refresh cache if expired
      await this.refreshActiveGiveawaysCache();

      const now = new Date();
      const endingGiveaways = [];

      // Use cached data instead of querying database every time
      for (const [, giveaways] of this.activeGiveawaysCache) {
        for (const giveaway of giveaways) {
          if (giveaway.endTime <= now) {
            endingGiveaways.push(giveaway);
          }
        }
      }

      for (const giveaway of endingGiveaways) {
        await this.endGiveaway(giveaway._id.toString());
      }

      // Update metrics
      this.metrics.totalChecks++;
      this.metrics.giveawaysEnded += endingGiveaways.length;
      const duration = Date.now() - startTime;
      this.metrics.lastCheckTime = duration;
      this.metrics.averageCheckDuration =
        (this.metrics.averageCheckDuration * (this.metrics.totalChecks - 1) +
          duration) /
        this.metrics.totalChecks;

      if (endingGiveaways.length > 0) {
        logger.info(
          `🎉 Ended ${endingGiveaways.length} giveaway(s) in ${duration}ms`,
        );
      }
    } catch (error) {
      logger.error("❌ Error checking ending giveaways:", error);
    }
  }

  /**
   * Refresh active giveaways cache (OPTIMIZED)
   */
  async refreshActiveGiveawaysCache() {
    const now = Date.now();

    // Only refresh if cache is expired
    if (this.cacheTimestamp && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return; // Cache still valid
    }

    try {
      const activeGiveaways = await this.collection
        .find({
          status: "active",
        })
        .toArray();

      // Group by guild for faster lookup
      const grouped = new Map();
      for (const giveaway of activeGiveaways) {
        if (!grouped.has(giveaway.guildId)) {
          grouped.set(giveaway.guildId, []);
        }
        grouped.get(giveaway.guildId).push(giveaway);
      }

      this.activeGiveawaysCache = grouped;
      this.cacheTimestamp = now;

      logger.debug(
        `📦 Refreshed giveaway cache: ${activeGiveaways.length} active giveaways`,
      );
    } catch (error) {
      logger.error("❌ Error refreshing giveaway cache:", error);
    }
  }

  // ==================== SETTINGS MANAGEMENT ====================

  /**
   * Get guild giveaway settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Guild settings
   */
  async getGuildSettings(guildId) {
    try {
      const settings = await this.settingsCollection.findOne({ guildId });

      // Return default settings if none exist
      return (
        settings || {
          guildId,
          creatorRoles: [], // Roles that can create giveaways
          allowedChannels: [], // Channels where giveaways are allowed
          claimPeriod: 48, // Hours to claim prize
          logChannel: null, // Channel for giveaway logs
          requireAccountAge: 7, // Minimum account age in days (0 = disabled)
          requireServerAge: 1, // Minimum server age in days (0 = disabled)
          excludeBots: true, // Exclude bot accounts
          maxActivePerUser: 3, // Max active giveaways per user
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      logger.error("❌ Error getting guild settings:", error);
      throw error;
    }
  }

  /**
   * Update guild settings
   * @param {string} guildId - Guild ID
   * @param {Object} updates - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateGuildSettings(guildId, updates) {
    try {
      const result = await this.settingsCollection.findOneAndUpdate(
        { guildId },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      logger.info(`⚙️ Updated giveaway settings for guild ${guildId}`);
      return result;
    } catch (error) {
      logger.error("❌ Error updating guild settings:", error);
      throw error;
    }
  }

  /**
   * Add a creator role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Role ID to add
   * @returns {Promise<Object>} Updated settings
   */
  async addCreatorRole(guildId, roleId) {
    try {
      const result = await this.settingsCollection.findOneAndUpdate(
        { guildId },
        {
          $addToSet: { creatorRoles: roleId },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, returnDocument: "after" },
      );

      logger.info(`➕ Added creator role ${roleId} to guild ${guildId}`);
      return result;
    } catch (error) {
      logger.error("❌ Error adding creator role:", error);
      throw error;
    }
  }

  /**
   * Remove a creator role
   * @param {string} guildId - Guild ID
   * @param {string} roleId - Role ID to remove
   * @returns {Promise<Object>} Updated settings
   */
  async removeCreatorRole(guildId, roleId) {
    try {
      const result = await this.settingsCollection.findOneAndUpdate(
        { guildId },
        {
          $pull: { creatorRoles: roleId },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: "after" },
      );

      logger.info(`➖ Removed creator role ${roleId} from guild ${guildId}`);
      return result;
    } catch (error) {
      logger.error("❌ Error removing creator role:", error);
      throw error;
    }
  }

  /**
   * Add an allowed channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID to add
   * @returns {Promise<Object>} Updated settings
   */
  async addAllowedChannel(guildId, channelId) {
    try {
      const result = await this.settingsCollection.findOneAndUpdate(
        { guildId },
        {
          $addToSet: { allowedChannels: channelId },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, returnDocument: "after" },
      );

      logger.info(`➕ Added allowed channel ${channelId} to guild ${guildId}`);
      return result;
    } catch (error) {
      logger.error("❌ Error adding allowed channel:", error);
      throw error;
    }
  }

  /**
   * Remove an allowed channel
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID to remove
   * @returns {Promise<Object>} Updated settings
   */
  async removeAllowedChannel(guildId, channelId) {
    try {
      const result = await this.settingsCollection.findOneAndUpdate(
        { guildId },
        {
          $pull: { allowedChannels: channelId },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: "after" },
      );

      logger.info(
        `➖ Removed allowed channel ${channelId} from guild ${guildId}`,
      );
      return result;
    } catch (error) {
      logger.error("❌ Error removing allowed channel:", error);
      throw error;
    }
  }

  // ==================== PERMISSION CHECKS ====================

  /**
   * Check if user can create giveaways
   * @param {Object} member - Guild member
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Permission check result
   */
  async canUserCreateGiveaway(member, guildId) {
    try {
      if (!member) {
        return { allowed: false, reason: "Member not found" };
      }

      const settings = await this.getGuildSettings(guildId);

      // Check for admin permissions (always allowed)
      const isAdmin =
        member.permissions.has("ManageGuild") ||
        member.permissions.has("Administrator");

      if (isAdmin) {
        return { allowed: true, reason: "Admin permission" };
      }

      // Check for Manage Roles permission (always allowed)
      if (member.permissions.has("ManageRoles")) {
        return { allowed: true, reason: "Manage Roles permission" };
      }

      // Check for custom creator roles
      if (settings.creatorRoles?.length > 0) {
        const hasCreatorRole = settings.creatorRoles.some(roleId =>
          member.roles.cache.has(roleId),
        );

        if (hasCreatorRole) {
          return { allowed: true, reason: "Creator role" };
        }
      }

      return { allowed: false, reason: "Insufficient permissions" };
    } catch (error) {
      logger.error("❌ Error checking user permissions:", error);
      return { allowed: false, reason: "Error checking permissions" };
    }
  }

  /**
   * Check if channel allows giveaways
   * @param {string} guildId - Guild ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel check result
   */
  async canUseChannel(guildId, channelId) {
    try {
      const settings = await this.getGuildSettings(guildId);

      // If no allowed channels set, all channels are allowed
      if (!settings.allowedChannels || settings.allowedChannels.length === 0) {
        return { allowed: true, reason: "No channel restrictions" };
      }

      // Check if channel is in allowed list
      if (settings.allowedChannels.includes(channelId)) {
        return { allowed: true, reason: "Channel allowed" };
      }

      return { allowed: false, reason: "Channel not allowed for giveaways" };
    } catch (error) {
      logger.error("❌ Error checking channel permissions:", error);
      return { allowed: false, reason: "Error checking channel" };
    }
  }

  /**
   * Check rate limit for user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Rate limit check result
   */
  async checkRateLimit(userId, guildId) {
    try {
      const settings = await this.getGuildSettings(guildId);
      const maxActive = settings.maxActivePerUser || 3;

      // Count active giveaways for user
      const activeCount = await this.collection.countDocuments({
        guildId,
        host: userId,
        status: "active",
      });

      if (activeCount >= maxActive) {
        return {
          allowed: false,
          reason: `You can only have ${maxActive} active giveaway(s)`,
          current: activeCount,
          max: maxActive,
        };
      }

      return {
        allowed: true,
        reason: "Within rate limit",
        current: activeCount,
        max: maxActive,
      };
    } catch (error) {
      logger.error("❌ Error checking rate limit:", error);
      return { allowed: false, reason: "Error checking rate limit" };
    }
  }

  // ==================== GIVEAWAY CRUD ====================

  /**
   * Create a new giveaway
   * @param {Object} options - Giveaway options
   * @returns {Promise<Object>} Created giveaway
   */
  async create(options) {
    try {
      // Get guild settings for defaults
      const settings = await this.getGuildSettings(options.guildId);

      const giveaway = {
        _id: new ObjectId(),
        guildId: options.guildId,
        channelId: options.channelId,
        messageId: null,
        prize: options.prize,
        winners: options.winners || 1,
        host: options.host,
        entries: [],
        requirements: {
          roles: options.requiredRoles || [],
          minAccountAge:
            options.minAccountAge ??
            settings.requireAccountAge * 24 * 60 * 60 * 1000,
          minServerAge:
            options.minServerAge ??
            settings.requireServerAge * 24 * 60 * 60 * 1000,
          excludeBots: options.excludeBots ?? settings.excludeBots,
        },
        bonusEntries: options.bonusEntries || [],
        startTime: new Date(),
        endTime: new Date(Date.now() + options.duration),
        duration: options.duration,
        status: "active",
        winnersData: [],
        description: options.description || "",
        thumbnail: options.thumbnail || null,
        color: options.color || 0xffd700,
        reactionEmoji: options.reactionEmoji || "🎁",
        allowBotEntries: options.allowBotEntries ?? !settings.excludeBots,
        claimPeriod: options.claimPeriod ?? settings.claimPeriod, // Hours
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.collection.insertOne(giveaway);
      logger.info(
        `🎉 Giveaway created: ${giveaway._id} - Prize: ${giveaway.prize}`,
      );

      // Invalidate cache to include new giveaway
      this.invalidateCache();

      // Log giveaway creation
      await this.logGiveawayEvent(options.guildId, "giveaway_created", {
        giveawayId: giveaway._id.toString(),
        host: options.host,
        prize: options.prize,
      });

      return giveaway;
    } catch (error) {
      logger.error("❌ Error creating giveaway:", error);
      throw error;
    }
  }

  /**
   * Get a giveaway by ID
   * @param {string} id - Giveaway ID
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    try {
      return await this.collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("❌ Error getting giveaway by ID:", error);
      throw error;
    }
  }

  /**
   * Get a giveaway by message ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object|null>}
   */
  async getByMessageId(messageId) {
    try {
      return await this.collection.findOne({ messageId });
    } catch (error) {
      logger.error("❌ Error getting giveaway by message ID:", error);
      throw error;
    }
  }

  /**
   * Get all active giveaways for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>}
   */
  async getActiveForGuild(guildId) {
    try {
      return await this.collection
        .find({
          guildId,
          status: "active",
        })
        .toArray();
    } catch (error) {
      logger.error("❌ Error getting active giveaways:", error);
      throw error;
    }
  }

  /**
   * Edit a giveaway
   * @param {string} giveawayId - Giveaway ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated giveaway
   */
  async edit(giveawayId, updates) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        throw new Error("Giveaway not found");
      }

      if (giveaway.status !== "active") {
        throw new Error("Can only edit active giveaways");
      }

      const allowedUpdates = [
        "prize",
        "winners",
        "description",
        "endTime",
        "duration",
        "thumbnail",
        "color",
      ];
      const updateData = {};

      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          updateData[key] = updates[key];
        }
      }

      updateData.updatedAt = new Date();

      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(giveawayId) },
        { $set: updateData },
        { returnDocument: "after" },
      );

      logger.info(`✏️ Giveaway edited: ${giveawayId}`);

      // Log edit
      await this.logGiveawayEvent(giveaway.guildId, "giveaway_edited", {
        giveawayId,
        updates: Object.keys(updateData).filter(k => k !== "updatedAt"),
      });

      return result;
    } catch (error) {
      logger.error("❌ Error editing giveaway:", error);
      throw error;
    }
  }

  /**
   * Add a user to giveaway entries
   * @param {string} giveawayId - Giveaway ID
   * @param {string} userId - User ID
   * @param {number} entries - Number of entries (default: 1)
   * @returns {Promise<Object>} Result with success status and entries count
   */
  async addEntry(giveawayId, userId, entries = 1) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      if (giveaway.status !== "active") {
        return { success: false, error: "Giveaway is not active" };
      }

      // VPS Protection: Check total entries limit
      const currentTotal = giveaway.entries.reduce((sum, e) => sum + e.count, 0);
      const isPro = await this.premiumManager.isFeatureActive(
        giveaway.guildId,
        "pro_engine",
      );
      const maxEntries = isPro
        ? PRO_TIER.GIVEAWAY_MAX_ENTRIES
        : FREE_TIER.GIVEAWAY_MAX_ENTRIES;

      if (currentTotal + entries > maxEntries) {
        return {
          success: false,
          error: `This giveaway has reached the maximum entry limit of ${maxEntries.toLocaleString()}. ${isPro ? "" : "Upgrade to Pro Engine ✨ for unlimited entries!"}`,
        };
      }

      // Check if user already has entries
      const existingEntry = giveaway.entries.find(e => e.userId === userId);

      if (existingEntry) {
        existingEntry.count += entries;
        existingEntry.joinedAt = new Date();
      } else {
        giveaway.entries.push({
          userId,
          count: entries,
          joinedAt: new Date(),
        });
      }

      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: { entries: giveaway.entries, updatedAt: new Date() },
        },
      );

      const totalEntries = giveaway.entries.reduce(
        (sum, e) => sum + e.count,
        0,
      );

      return {
        success: true,
        entries: existingEntry ? existingEntry.count : entries,
        totalEntries,
      };
    } catch (error) {
      logger.error("❌ Error adding entry:", error);
      throw error;
    }
  }

  /**
   * Remove a user's entries from a giveaway
   * @param {string} giveawayId - Giveaway ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with success status
   */
  async removeEntry(giveawayId, userId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      const newEntries = giveaway.entries.filter(e => e.userId !== userId);

      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: { entries: newEntries, updatedAt: new Date() },
        },
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ Error removing entry:", error);
      throw error;
    }
  }

  /**
   * Get user's entries for a giveaway
   * @param {string} giveawayId - Giveaway ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of entries
   */
  async getUserEntries(giveawayId, userId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return 0;
      }

      const entry = giveaway.entries.find(e => e.userId === userId);
      return entry ? entry.count : 0;
    } catch (error) {
      logger.error("❌ Error getting user entries:", error);
      return 0;
    }
  }

  /**
   * Get total entries for a giveaway
   * @param {string} giveawayId - Giveaway ID
   * @returns {Promise<number>} Total entries
   */
  async getTotalEntries(giveawayId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return 0;
      }

      return giveaway.entries.reduce((sum, e) => sum + e.count, 0);
    } catch (error) {
      logger.error("❌ Error getting total entries:", error);
      return 0;
    }
  }

  /**
   * End a giveaway and select winners
   * @param {string} giveawayId - Giveaway ID
   * @returns {Promise<Object>} Result with winners
   */
  async endGiveaway(giveawayId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      if (giveaway.status !== "active") {
        return { success: false, error: "Giveaway already ended" };
      }

      // Select winners
      const winners = this.selectWinners(giveaway.entries, giveaway.winners);

      // Update giveaway status
      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: {
            status: "ended",
            winnersData: winners,
            updatedAt: new Date(),
            endedAt: new Date(),
          },
        },
      );

      logger.info(
        `🎉 Giveaway ended: ${giveawayId} - Winners: ${winners.length}`,
      );

      // Invalidate cache since giveaway status changed
      this.invalidateCache();

      // Log giveaway end
      await this.logGiveawayEvent(giveaway.guildId, "giveaway_ended", {
        giveawayId,
        winners: winners.length,
        totalEntries: giveaway.entries.reduce((sum, e) => sum + e.count, 0),
      });

      // Emit event for handler to announce winners
      this.emit("giveawayEnded", giveaway, winners);

      return { success: true, winners };
    } catch (error) {
      logger.error("❌ Error ending giveaway:", error);
      throw error;
    }
  }

  /**
   * Select random winners from entries
   * @param {Array} entries - All entries
   * @param {number} winnerCount - Number of winners to select
   * @returns {Array} Selected winners
   */
  selectWinners(entries, winnerCount) {
    // Build weighted pool based on entry count
    const pool = [];

    for (const entry of entries) {
      for (let i = 0; i < entry.count; i++) {
        pool.push(entry.userId);
      }
    }

    if (pool.length === 0) {
      return [];
    }

    const winners = [];
    const winnerSet = new Set();

    while (winners.length < winnerCount && winners.length < pool.length) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const winnerId = pool[randomIndex];

      if (!winnerSet.has(winnerId)) {
        winners.push({
          userId: winnerId,
          selectedAt: new Date(),
          claimed: false,
        });
        winnerSet.add(winnerId);
      }
    }

    return winners;
  }

  /**
   * Reroll a giveaway to select new winners
   * @param {string} giveawayId - Giveaway ID
   * @param {number} newWinnerCount - Number of new winners to select
   * @returns {Promise<Object>} Result with new winners
   */
  async rerollGiveaway(giveawayId, newWinnerCount = null) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      if (giveaway.status === "active") {
        return { success: false, error: "Giveaway is still active" };
      }

      const winnerCount = newWinnerCount || giveaway.winners;
      const winners = this.selectWinners(giveaway.entries, winnerCount);

      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: {
            winnersData: winners,
            updatedAt: new Date(),
            rerolledAt: new Date(),
          },
        },
      );

      logger.info(
        `🔄 Giveaway rerolled: ${giveawayId} - New Winners: ${winners.length}`,
      );

      // Log reroll
      await this.logGiveawayEvent(giveaway.guildId, "giveaway_rerolled", {
        giveawayId,
        newWinners: winners.length,
      });

      this.emit("giveawayRerolled", giveaway, winners);

      return { success: true, winners };
    } catch (error) {
      logger.error("❌ Error rerolling giveaway:", error);
      throw error;
    }
  }

  /**
   * Cancel a giveaway (no winners)
   * @param {string} giveawayId - Giveaway ID
   * @returns {Promise<Object>} Result
   */
  async cancelGiveaway(giveawayId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
            cancelledAt: new Date(),
          },
        },
      );

      logger.info(`🚫 Giveaway cancelled: ${giveawayId}`);

      // Log cancellation
      await this.logGiveawayEvent(giveaway.guildId, "giveaway_cancelled", {
        giveawayId,
        host: giveaway.host,
      });

      this.emit("giveawayCancelled", giveaway);

      return { success: true };
    } catch (error) {
      logger.error("❌ Error cancelling giveaway:", error);
      throw error;
    }
  }

  /**
   * Mark a winner as claimed
   * @param {string} giveawayId - Giveaway ID
   * @param {string} userId - Winner's user ID
   * @returns {Promise<Object>} Result
   */
  async markClaimed(giveawayId, userId) {
    try {
      const giveaway = await this.getById(giveawayId);

      if (!giveaway) {
        return { success: false, error: "Giveaway not found" };
      }

      const winner = giveaway.winnersData.find(w => w.userId === userId);

      if (!winner) {
        return { success: false, error: "User is not a winner" };
      }

      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: {
            "winnersData.$.claimed": true,
            "winnersData.$.claimedAt": new Date(),
            updatedAt: new Date(),
          },
        },
      );

      // Check if all winners claimed
      const allClaimed = giveaway.winnersData.every(w => w.claimed);

      if (allClaimed) {
        await this.collection.updateOne(
          { _id: new ObjectId(giveawayId) },
          {
            $set: {
              status: "completed",
              completedAt: new Date(),
            },
          },
        );
      }

      logger.info(`✅ Giveaway prize claimed: ${giveawayId} by ${userId}`);

      // Log claim
      await this.logGiveawayEvent(giveaway.guildId, "prize_claimed", {
        giveawayId,
        winner: userId,
      });

      return { success: true, allClaimed };
    } catch (error) {
      logger.error("❌ Error marking claimed:", error);
      throw error;
    }
  }

  /**
   * Update giveaway message ID
   * @param {string} giveawayId - Giveaway ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Result
   */
  async updateMessageId(giveawayId, messageId) {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(giveawayId) },
        {
          $set: {
            messageId,
            updatedAt: new Date(),
          },
        },
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ Error updating message ID:", error);
      throw error;
    }
  }

  /**
   * Get giveaway statistics for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(guildId) {
    try {
      const pipeline = [
        { $match: { guildId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalEntries: {
              $sum: {
                $reduce: {
                  input: "$entries",
                  initialValue: 0,
                  in: { $add: ["$$value", "$$this.count"] },
                },
              },
            },
          },
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();

      const stats = {
        total: 0,
        active: 0,
        ended: 0,
        completed: 0,
        cancelled: 0,
        totalEntries: 0,
      };

      for (const result of results) {
        stats[result._id] = result.count;
        stats.total += result.count;
        if (result._id !== "cancelled") {
          stats.totalEntries += result.totalEntries || 0;
        }
      }

      return stats;
    } catch (error) {
      logger.error("❌ Error getting stats:", error);
      throw error;
    }
  }

  /**
   * Log giveaway event
   * @param {string} guildId - Guild ID
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  async logGiveawayEvent(guildId, eventType, data) {
    try {
      const settings = await this.getGuildSettings(guildId);

      if (!settings.logChannel) {
        return; // No logging configured
      }

      // Emit event for handler to send to log channel
      this.emit("giveawayLog", guildId, eventType, data);
    } catch (error) {
      logger.error("❌ Error logging giveaway event:", error);
    }
  }

  /**
   * Clean up old giveaways
   * @param {number} daysOld - Delete giveaways older than this many days
   * @returns {Promise<number>} Number of deleted giveaways
   */
  async cleanup(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await this.collection.deleteMany({
        status: { $in: ["completed", "cancelled"] },
        updatedAt: { $lt: cutoffDate },
      });

      // Invalidate cache after cleanup
      this.activeGiveawaysCache.clear();
      this.cacheTimestamp = null;

      logger.info(`🧹 Cleaned up ${result.deletedCount} old giveaways`);

      return result.deletedCount;
    } catch (error) {
      logger.error("❌ Error cleaning up giveaways:", error);
      throw error;
    }
  }

  /**
   * Get performance metrics (OPTIMIZED)
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.activeGiveawaysCache.size,
      cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : 0,
      checkInterval: this.CHECK_INTERVAL_MS,
      cacheTTL: this.CACHE_TTL_MS,
    };
  }

  /**
   * Invalidate cache (call when giveaways change)
   */
  invalidateCache() {
    this.activeGiveawaysCache.clear();
    this.cacheTimestamp = null;
    logger.debug("🗑️ Giveaway cache invalidated");
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy() {
    this.stopCheckInterval();
    this.removeAllListeners();
    this.rateLimitCache.clear();
    logger.info("🛑 GiveawayManager destroyed");
  }
}

// Export singleton instance
const giveawayManager = new GiveawayManager();

export default giveawayManager;
export { GiveawayManager };
