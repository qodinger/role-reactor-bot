import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getBotContext } from "../../utils/core/BotContext.js";

/**
 * Voice Chat XP Tracker
 * Tracks time spent in voice channels and awards XP accordingly
 */
class VoiceTracker {
  constructor() {
    this.logger = getLogger();
    this.storageManager = null;
    this.isInitialized = false;

    // Track users currently in voice channels
    this.voiceUsers = new Map(); // guildId:userId -> { joinTime, channelId }
    this.voiceXPInterval = null;
    this.voiceXPIntervalMs = 60000; // Check every minute
  }

  async initialize() {
    if (this.isInitialized) return;

    this.storageManager = await getStorageManager();
    this.isInitialized = true;
    this.logger.info("🎤 Voice Tracker initialized");
  }

  /**
   * Start tracking voice XP for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} channelId - Voice channel ID
   */
  async startVoiceTracking(guildId, userId, channelId) {
    await this.initialize();

    const key = `${guildId}:${userId}`;
    this.voiceUsers.set(key, {
      joinTime: Date.now(),
      channelId,
      lastXPAward: Date.now(),
    });

    this.logger.debug(
      `🎤 Started voice tracking for user ${userId} in channel ${channelId}`,
    );

    // Start interval if not already running
    if (!this.voiceXPInterval) {
      this.startVoiceXPInterval();
    }
  }

  /**
   * Stop tracking voice XP for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   */
  async stopVoiceTracking(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const userData = this.voiceUsers.get(key);

    if (userData) {
      const timeSpent = Date.now() - userData.joinTime;
      this.logger.debug(
        `🎤 Stopped voice tracking for user ${userId}, time spent: ${Math.round(timeSpent / 1000)}s`,
      );
      this.voiceUsers.delete(key);
    }

    // Stop interval if no users are being tracked
    if (this.voiceUsers.size === 0 && this.voiceXPInterval) {
      clearInterval(this.voiceXPInterval);
      this.voiceXPInterval = null;
    }
  }

  /**
   * Start the voice XP interval
   */
  startVoiceXPInterval() {
    this.voiceXPInterval = setInterval(async () => {
      await this.processVoiceXP();
    }, this.voiceXPIntervalMs).unref();
  }

  /**
   * Process voice XP for all tracked users (anti-AFK filtered)
   */
  async processVoiceXP() {
    if (this.voiceUsers.size === 0) return;

    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const { getExperienceManager } = await import("./ExperienceManager.js");
    const experienceManager = await getExperienceManager();
    const client = getBotContext().client;

    for (const [key, userData] of this.voiceUsers.entries()) {
      const [guildId, userId] = key.split(":");

      try {
        // Check if XP system is enabled for this guild
        const guildSettings = await dbManager.guildSettings.getByGuild(guildId);
        if (
          !guildSettings.experienceSystem.enabled ||
          !guildSettings.experienceSystem.voiceXP
        ) {
          continue;
        }

        // Channel-level no-XP exclusion
        const noXpChannels = guildSettings.experienceSystem.noXpChannels || [];
        if (noXpChannels.includes(userData.channelId)) {
          continue;
        }

        // Role-level no-XP exclusion
        const noXpRoles = guildSettings.experienceSystem.noXpRoles || [];

        // Anti-AFK: evaluate the user's CURRENT voice state
        if (client && !this._isVoiceEngaged(guildId, userId, noXpRoles, client, guildSettings)) {
          continue;
        }

        // Check if enough time has passed since last XP award (5 minutes)
        const timeSinceLastXP = Date.now() - userData.lastXPAward;
        if (timeSinceLastXP < 5 * 60 * 1000) {
          continue;
        }

        // Award voice XP (single-writer via ExperienceManager batcher)
        await experienceManager.awardVoiceXP(guildId, userId);

        // Update last XP award time
        userData.lastXPAward = Date.now();
        this.voiceUsers.set(key, userData);
      } catch (error) {
        this.logger.error(
          `Error processing voice XP for user ${userId}:`,
          error,
        );
      }
    }
  }

  /**
   * Whether a user counts as engaged voice activity (not deaf/muted,
   * not holding an excluded role, and not alone in the channel)
   * @param {string} guildId
   * @param {string} userId
   * @param {string[]} noXpRoles
   * @param {import('discord.js').Client} client
   * @param {object} guildSettings
   * @returns {boolean}
   */
  _isVoiceEngaged(guildId, userId, noXpRoles, client, guildSettings) {
    const config = {
      ignoreMuted: true,
      ignoreDeafened: true,
      minOthers: 1,
      ...(guildSettings.experienceSystem.voiceXpSettings || {}),
    };

    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members?.cache?.get(userId);
    const voice = member?.voice;
    if (!voice || !voice.channel) return false;

    if (noXpRoles.length > 0 && member.roles?.cache) {
      for (const roleId of noXpRoles) {
        if (member.roles.cache.has(roleId)) return false;
      }
    }

    // deafened (self or server) = not listening/speaking; muted = can't speak
    if (config.ignoreMuted && voice.mute) return false;
    if (config.ignoreDeafened && voice.deaf) return false;

    if (config.minOthers > 0) {
      const humans = voice.channel.members.filter(m => !m.user.bot).size;
      if (humans - 1 < config.minOthers) return false;
    }

    return true;
  }

  /**
   * Get voice tracking data for a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {object|null} Voice tracking data or null if not tracking
   */
  getVoiceTrackingData(guildId, userId) {
    const key = `${guildId}:${userId}`;
    return this.voiceUsers.get(key) || null;
  }

  /**
   * Check if user is currently being tracked in voice
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {boolean} Whether user is being tracked
   */
  isUserInVoice(guildId, userId) {
    const key = `${guildId}:${userId}`;
    return this.voiceUsers.has(key);
  }

  /**
   * Get all users currently being tracked
   * @returns {Array} Array of tracking data
   */
  getAllTrackedUsers() {
    return Array.from(this.voiceUsers.entries()).map(([key, data]) => {
      const [guildId, userId] = key.split(":");
      return { guildId, userId, ...data };
    });
  }

  /**
   * Cleanup expired voice tracking data
   */
  cleanup() {
    const now = Date.now();
    const maxIdleTime = 30 * 60 * 1000; // 30 minutes

    for (const [key, userData] of this.voiceUsers.entries()) {
      if (now - userData.lastXPAward > maxIdleTime) {
        this.voiceUsers.delete(key);
        this.logger.debug(`🧹 Cleaned up expired voice tracking for ${key}`);
      }
    }
  }

  /**
   * Stop all voice tracking
   */
  stop() {
    if (this.voiceXPInterval) {
      clearInterval(this.voiceXPInterval);
      this.voiceXPInterval = null;
    }
    this.voiceUsers.clear();
    this.logger.info("🎤 Voice Tracker stopped");
  }
}

let voiceTracker = null;

export async function getVoiceTracker() {
  if (!voiceTracker) {
    voiceTracker = new VoiceTracker();
    await voiceTracker.initialize();
  }
  return voiceTracker;
}

// Cleanup every 10 minutes
setInterval(
  () => {
    if (voiceTracker) {
      voiceTracker.cleanup();
    }
  },
  10 * 60 * 1000,
).unref();
