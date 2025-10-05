import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";

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
    }, this.voiceXPIntervalMs);
  }

  /**
   * Process voice XP for all tracked users
   */
  async processVoiceXP() {
    if (this.voiceUsers.size === 0) return;

    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

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

        // Check if enough time has passed since last XP award (5 minutes)
        const timeSinceLastXP = Date.now() - userData.lastXPAward;
        if (timeSinceLastXP < 5 * 60 * 1000) {
          continue;
        }

        // Award voice XP
        await this.awardVoiceXP(guildId, userId);

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
   * Award XP for voice chat participation
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {object|null} Awarded XP data or null if XP system disabled
   */
  async awardVoiceXP(guildId, userId) {
    const { getExperienceManager } = await import("./ExperienceManager.js");
    const experienceManager = await getExperienceManager();

    // Check if XP system is enabled for this guild
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const guildSettings = await dbManager.guildSettings.getByGuild(guildId);

    if (
      !guildSettings.experienceSystem.enabled ||
      !guildSettings.experienceSystem.voiceXP
    ) {
      return null;
    }

    // Award XP for voice participation (5 XP per 5 minutes)
    const xp = 5;
    const userData = await experienceManager.addXP(guildId, userId, xp);

    // Update voice time
    const experienceData = await this.storageManager.read("user_experience");
    const userKey = `${guildId}_${userId}`;
    experienceData[userKey] = {
      ...userData,
      voiceTime: (userData.voiceTime || 0) + 5, // 5 minutes
    };

    await this.storageManager.write("user_experience", experienceData);

    this.logger.debug(
      `🎤 Awarded ${xp} voice XP to user ${userId} in guild ${guildId}`,
    );

    return {
      xp,
      newTotal: userData.totalXP,
      newLevel: userData.level,
      leveledUp: userData.leveledUp,
    };
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
