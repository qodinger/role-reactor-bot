import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";

/**
 * Experience Manager for handling user XP and levels
 * Integrates with role management system for level-based rewards
 */
class ExperienceManager {
  constructor() {
    this.logger = getLogger();
    this.storageManager = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.storageManager = await getStorageManager();
    this.isInitialized = true;
    this.logger.info("🎯 Experience Manager initialized");
  }

  /**
   * Calculate XP needed for a specific level
   * @param {number} level - The level to calculate XP for
   * @returns {number} XP required for that level
   */
  calculateXPForLevel(level) {
    // Exponential growth: 100 * level^1.5
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Calculate level from total XP
   * @param {number} totalXP - Total XP earned
   * @returns {number} Current level
   */
  calculateLevel(totalXP) {
    let level = 1;
    while (this.calculateXPForLevel(level) <= totalXP) {
      level++;
    }
    return level - 1;
  }

  /**
   * Calculate XP progress to next level
   * @param {number} totalXP - Total XP earned
   * @returns {object} Progress information
   */
  calculateProgress(totalXP) {
    const currentLevel = this.calculateLevel(totalXP);
    const xpForCurrentLevel = this.calculateXPForLevel(currentLevel);
    const xpForNextLevel = this.calculateXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const progress = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

    return {
      currentLevel,
      totalXP,
      xpInCurrentLevel,
      xpNeededForNextLevel,
      progress: Math.min(100, Math.max(0, progress)),
      xpForNextLevel,
    };
  }

  /**
   * Add XP to a user
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {number} xp - XP to add
   * @returns {object} Updated user data
   */
  async addXP(guildId, userId, xp) {
    await this.initialize();

    const userData = await this.getUserData(guildId, userId);
    const newTotalXP = userData.totalXP + xp;
    const oldLevel = userData.level;
    const newLevel = this.calculateLevel(newTotalXP);

    const updatedData = {
      ...userData,
      totalXP: newTotalXP,
      level: newLevel,
      lastUpdated: new Date(),
    };

    await this.storageManager.write("user_experience", {
      ...(await this.storageManager.read("user_experience")),
      [`${guildId}_${userId}`]: updatedData,
    });

    // Log level up if it happened
    if (newLevel > oldLevel) {
      this.logger.info(
        `🎉 User ${userId} leveled up to level ${newLevel} in guild ${guildId}`,
      );
    }

    return updatedData;
  }

  /**
   * Get user experience data
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {object} User experience data
   */
  async getUserData(guildId, userId) {
    await this.initialize();

    const experienceData = await this.storageManager.read("user_experience");
    const userKey = `${guildId}_${userId}`;
    const userData = experienceData[userKey] || {
      guildId,
      userId,
      totalXP: 0,
      level: 1,
      messagesSent: 0,
      rolesEarned: 0,
      lastUpdated: new Date(),
    };

    // Calculate current level
    // Normalize potential DB field names (xp vs totalXP) and level
    if (
      typeof userData.totalXP !== "number" &&
      typeof userData.xp === "number"
    ) {
      userData.totalXP = userData.xp;
    }
    if (typeof userData.level !== "number") {
      userData.level = this.calculateLevel(userData.totalXP || 0);
    } else {
      userData.level = this.calculateLevel(userData.totalXP || 0);
    }
    return userData;
  }

  /**
   * Get leaderboard for a guild
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of users to return
   * @returns {Array} Sorted leaderboard data
   */
  async getLeaderboard(guildId, limit = 10) {
    await this.initialize();

    // If using database provider, use optimized database query
    if (this.storageManager.provider.constructor.name === "DatabaseProvider") {
      const docs =
        await this.storageManager.provider.getUserExperienceLeaderboard(
          guildId,
          limit,
        );
      // Normalize fields to match file-provider shape
      return docs
        .map(doc => ({
          ...doc,
          totalXP: typeof doc.totalXP === "number" ? doc.totalXP : doc.xp || 0,
          level:
            typeof doc.level === "number"
              ? doc.level
              : this.calculateLevel(
                  typeof doc.totalXP === "number" ? doc.totalXP : doc.xp || 0,
                ),
        }))
        .sort((a, b) => b.totalXP - a.totalXP)
        .slice(0, limit);
    }

    // Fallback to file-based query
    const experienceData = await this.storageManager.read("user_experience");
    const guildUsers = Object.entries(experienceData)
      .filter(([key]) => key.startsWith(`${guildId}_`))
      .map(([key, data]) => ({
        userId: key.split("_")[1],
        ...data,
        level: this.calculateLevel(data.totalXP),
      }))
      .sort((a, b) => b.totalXP - a.totalXP)
      .slice(0, limit);

    return guildUsers;
  }

  /**
   * Get guild statistics
   * @param {string} guildId - Discord guild ID
   * @returns {object} Guild XP statistics
   */
  async getGuildStats(guildId) {
    await this.initialize();

    const experienceData = await this.storageManager.read("user_experience");
    const guildUsers = Object.entries(experienceData)
      .filter(([key]) => key.startsWith(`${guildId}_`))
      .map(([_key, data]) => data);

    if (guildUsers.length === 0) {
      return {
        totalUsers: 0,
        totalXP: 0,
        averageLevel: 1,
        highestLevel: 1,
        mostActiveUser: null,
      };
    }

    const totalXP = guildUsers.reduce((sum, user) => sum + user.totalXP, 0);
    const levels = guildUsers.map(user => this.calculateLevel(user.totalXP));
    const averageLevel =
      levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const highestLevel = Math.max(...levels);
    const mostActiveUser = guildUsers.reduce((max, user) =>
      user.totalXP > max.totalXP ? user : max,
    );

    return {
      totalUsers: guildUsers.length,
      totalXP,
      averageLevel: Math.round(averageLevel * 100) / 100,
      highestLevel,
      mostActiveUser,
    };
  }

  /**
   * Check if user can earn XP (cooldown system)
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {boolean} Whether user can earn XP
   */
  async canEarnXP(guildId, userId) {
    await this.initialize();

    const userData = await this.getUserData(guildId, userId);
    const now = new Date();
    const lastEarned = userData.lastEarned
      ? new Date(userData.lastEarned)
      : null;

    // 60 second cooldown between XP gains
    const cooldownMs = 60 * 1000;

    if (!lastEarned || now - lastEarned >= cooldownMs) {
      return true;
    }

    return false;
  }

  /**
   * Award XP for message activity
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {object|null} Awarded XP data or null if cooldown active
   */
  async awardMessageXP(guildId, userId) {
    // Check if XP system is enabled for this guild
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (dbManager.guildSettings) {
      const guildSettings = await dbManager.guildSettings.getByGuild(guildId);
      if (
        !guildSettings.experienceSystem.enabled ||
        !guildSettings.experienceSystem.messageXP
      ) {
        return null;
      }
    }

    if (!(await this.canEarnXP(guildId, userId))) {
      return null;
    }

    // Random XP between 15-25
    const xp = Math.floor(Math.random() * 11) + 15;
    const userData = await this.addXP(guildId, userId, xp);

    // Update last earned timestamp
    const experienceData = await this.storageManager.read("user_experience");
    const userKey = `${guildId}_${userId}`;
    experienceData[userKey] = {
      ...userData,
      lastEarned: new Date(),
      messagesSent: (userData.messagesSent || 0) + 1,
    };

    await this.storageManager.write("user_experience", experienceData);

    return {
      xp,
      newTotal: userData.totalXP,
      newLevel: userData.level,
      leveledUp: userData.level > this.calculateLevel(userData.totalXP - xp),
    };
  }

  /**
   * Award XP for role activity
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {object|null} Awarded XP data or null if XP system disabled
   */
  async awardRoleXP(guildId, userId) {
    // Check if XP system is enabled for this guild
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (dbManager.guildSettings) {
      const guildSettings = await dbManager.guildSettings.getByGuild(guildId);
      if (
        !guildSettings.experienceSystem.enabled ||
        !guildSettings.experienceSystem.roleXP
      ) {
        return null;
      }
    }

    // 50 XP for role activity
    const xp = 50;
    const userData = await this.addXP(guildId, userId, xp);

    // Update roles earned
    const experienceData = await this.storageManager.read("user_experience");
    const userKey = `${guildId}_${userId}`;
    experienceData[userKey] = {
      ...userData,
      rolesEarned: (userData.rolesEarned || 0) + 1,
    };

    await this.storageManager.write("user_experience", experienceData);

    return {
      xp,
      newTotal: userData.totalXP,
      newLevel: userData.level,
      leveledUp: userData.level > this.calculateLevel(userData.totalXP - xp),
    };
  }

  /**
   * Check if user can earn command XP (cooldown system)
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @returns {boolean} Whether user can earn command XP
   */
  async canEarnCommandXP(guildId, userId) {
    await this.initialize();

    const userData = await this.getUserData(guildId, userId);
    const now = new Date();
    const lastCommandEarned = userData.lastCommandEarned
      ? new Date(userData.lastCommandEarned)
      : null;

    // 30 second cooldown between command XP gains (shorter than message XP)
    const cooldownMs = 30 * 1000;

    if (!lastCommandEarned || now - lastCommandEarned >= cooldownMs) {
      return true;
    }

    return false;
  }

  /**
   * Award XP for command usage
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - Discord user ID
   * @param {string} commandName - Name of the command used
   * @returns {object|null} Awarded XP data or null if cooldown active
   */
  async awardCommandXP(guildId, userId, commandName) {
    this.logger.info(
      `🎯 ExperienceManager: Awarding command XP for user ${userId} in guild ${guildId} for command ${commandName}`,
    );

    // Check if XP system is enabled for this guild
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (dbManager.guildSettings) {
      const guildSettings = await dbManager.guildSettings.getByGuild(guildId);
      if (
        !guildSettings.experienceSystem.enabled ||
        !guildSettings.experienceSystem.commandXP
      ) {
        return null;
      }
    }

    // Check cooldown first
    if (!(await this.canEarnCommandXP(guildId, userId))) {
      this.logger.info(`⏰ User ${userId} is on cooldown for command XP`);
      return null;
    }

    // Base XP for any command usage
    let xp = 8; // Default XP for any command

    // Bonus XP for more engaging commands
    if (commandName === "8ball")
      xp = 15; // Fun interactive command
    else if (commandName === "level" || commandName === "leaderboard")
      xp = 5; // Self-checking commands
    else if (commandName === "avatar")
      xp = 10; // Visual command
    else if (commandName === "serverinfo" || commandName === "userinfo")
      xp = 12; // Info commands
    else if (commandName === "roles")
      xp = 12; // Role management
    else if (
      commandName === "help" ||
      commandName === "ping" ||
      commandName === "invite" ||
      commandName === "support"
    )
      xp = 3; // Utility commands
    // All other commands get the default 8 XP

    const userData = await this.addXP(guildId, userId, xp);

    // Update commands used and last command earned timestamp
    const experienceData = await this.storageManager.read("user_experience");
    const userKey = `${guildId}_${userId}`;
    experienceData[userKey] = {
      ...userData,
      commandsUsed: (userData.commandsUsed || 0) + 1,
      lastCommandEarned: new Date(),
    };

    await this.storageManager.write("user_experience", experienceData);

    return {
      xp,
      newTotal: userData.totalXP,
      newLevel: userData.level,
      leveledUp: userData.level > this.calculateLevel(userData.totalXP - xp),
    };
  }
}

let experienceManager = null;

export async function getExperienceManager() {
  if (!experienceManager) {
    experienceManager = new ExperienceManager();
    await experienceManager.initialize();
  }
  return experienceManager;
}
