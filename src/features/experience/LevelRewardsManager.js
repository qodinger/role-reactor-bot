import { getLogger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getPremiumManager } from "../premium/PremiumManager.js";
import { PremiumFeatures } from "../premium/config.js";

const logger = getLogger();

/**
 * Free tier limits for level rewards
 */
export const LEVEL_REWARDS_CONFIG = {
  /** Max rewards allowed on the free tier */
  FREE_LIMIT: 5,
  /** Reward mode options */
  MODES: {
    /** Users keep all earned roles (default, free) */
    STACK: "stack",
    /** Users only keep the highest earned role (premium) */
    REPLACE: "replace",
  },
};

/**
 * Level Rewards Manager
 * Handles assigning/removing Discord roles when users reach specific levels.
 */
export class LevelRewardsManager {
  constructor() {
    this.dbManager = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.dbManager = await getDatabaseManager();
    this.isInitialized = true;
  }

  // ─────────────────────────────────────────────────────────────────
  // CRUD — Level Rewards
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a level reward to a guild
   * @param {string} guildId
   * @param {number} level
   * @param {string} roleId
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async addReward(guildId, level, roleId) {
    await this.initialize();

    const settings = await this.dbManager.guildSettings.getByGuild(guildId);
    const rewards = settings.levelRewards || [];

    // Check for duplicate
    const existing = rewards.find(
      r => r.level === level && r.roleId === roleId,
    );
    if (existing) {
      return {
        success: false,
        message: `A reward for level ${level} with that role already exists.`,
      };
    }

    // Check free tier limit
    const isPro = await this._isProActive(guildId);
    if (!isPro && rewards.length >= LEVEL_REWARDS_CONFIG.FREE_LIMIT) {
      return {
        success: false,
        message: `You've reached the free limit of ${LEVEL_REWARDS_CONFIG.FREE_LIMIT} level rewards. Enable **Pro Engine** to add unlimited rewards.`,
        premiumRequired: true,
      };
    }

    rewards.push({ level, roleId, addedAt: new Date().toISOString() });

    // Sort by level ascending
    rewards.sort((a, b) => a.level - b.level);

    await this.dbManager.guildSettings.set(guildId, {
      ...settings,
      levelRewards: rewards,
    });

    logger.info(
      `✅ Level reward added for guild ${guildId}: Level ${level} → Role ${roleId}`,
    );

    return {
      success: true,
      message: `Level reward added! Users reaching level **${level}** will receive the role.`,
      remaining: isPro
        ? "unlimited"
        : LEVEL_REWARDS_CONFIG.FREE_LIMIT - rewards.length,
    };
  }

  /**
   * Remove a level reward from a guild
   * @param {string} guildId
   * @param {number} level
   * @param {string} roleId
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async removeReward(guildId, level, roleId) {
    await this.initialize();

    const settings = await this.dbManager.guildSettings.getByGuild(guildId);
    const rewards = settings.levelRewards || [];

    const index = rewards.findIndex(
      r => r.level === level && r.roleId === roleId,
    );
    if (index === -1) {
      return {
        success: false,
        message: `No reward found for level ${level} with that role.`,
      };
    }

    rewards.splice(index, 1);

    await this.dbManager.guildSettings.set(guildId, {
      ...settings,
      levelRewards: rewards,
    });

    logger.info(
      `🗑️ Level reward removed for guild ${guildId}: Level ${level} → Role ${roleId}`,
    );

    return {
      success: true,
      message: `Level reward for level **${level}** has been removed.`,
    };
  }

  /**
   * Get all level rewards for a guild
   * @param {string} guildId
   * @returns {Promise<Array<{level: number, roleId: string}>>}
   */
  async getRewards(guildId) {
    await this.initialize();
    const settings = await this.dbManager.guildSettings.getByGuild(guildId);
    return (settings.levelRewards || []).sort((a, b) => a.level - b.level);
  }

  /**
   * Get the reward mode for a guild (stack or replace)
   * @param {string} guildId
   * @returns {Promise<string>}
   */
  async getRewardMode(guildId) {
    await this.initialize();
    const settings = await this.dbManager.guildSettings.getByGuild(guildId);
    return settings.levelRewardMode || LEVEL_REWARDS_CONFIG.MODES.STACK;
  }

  /**
   * Set the reward mode for a guild (premium only for "replace")
   * @param {string} guildId
   * @param {string} mode
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setRewardMode(guildId, mode) {
    await this.initialize();

    if (!Object.values(LEVEL_REWARDS_CONFIG.MODES).includes(mode)) {
      return { success: false, message: "Invalid reward mode." };
    }

    if (mode === LEVEL_REWARDS_CONFIG.MODES.REPLACE) {
      const isPro = await this._isProActive(guildId);
      if (!isPro) {
        return {
          success: false,
          message:
            "The **Replace** mode is a Pro Engine feature. Enable Pro Engine to use it.",
          premiumRequired: true,
        };
      }
    }

    const settings = await this.dbManager.guildSettings.getByGuild(guildId);
    await this.dbManager.guildSettings.set(guildId, {
      ...settings,
      levelRewardMode: mode,
    });

    logger.info(`⚙️ Level reward mode set to '${mode}' for guild ${guildId}`);

    return {
      success: true,
      message: `Reward mode set to **${mode === LEVEL_REWARDS_CONFIG.MODES.STACK ? "Stack" : "Replace"}**.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Role Assignment Logic
  // ─────────────────────────────────────────────────────────────────

  /**
   * Process role rewards after a level-up event.
   * Called from ExperienceManager.addXP() when a user levels up.
   *
   * @param {import('discord.js').Guild} guild
   * @param {string} userId
   * @param {number} oldLevel
   * @param {number} newLevel
   * @returns {Promise<Array<{level: number, roleId: string, roleName: string}>>} Roles awarded
   */
  async processLevelUp(guild, userId, oldLevel, newLevel) {
    await this.initialize();

    let rewards = await this.getRewards(guild.id);
    if (!rewards.length) return [];

    const isPro = await this._isProActive(guild.id);
    let mode = await this.getRewardMode(guild.id);

    // 🔒 Enforce Free Tier Limits (Strict Mode)
    // If not premium, only use the first N rewards and force STACK mode
    if (!isPro) {
      if (rewards.length > LEVEL_REWARDS_CONFIG.FREE_LIMIT) {
        rewards = rewards.slice(0, LEVEL_REWARDS_CONFIG.FREE_LIMIT);
      }
      if (mode === LEVEL_REWARDS_CONFIG.MODES.REPLACE) {
        mode = LEVEL_REWARDS_CONFIG.MODES.STACK; // Fallback to free mode
      }
    }

    // Get the member
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      logger.warn(
        `Could not fetch member ${userId} in guild ${guild.id} for level reward:`,
        error.message,
      );
      return [];
    }

    // Find all rewards the user is now eligible for (up to newLevel)
    const eligibleRewards = rewards.filter(r => r.level <= newLevel);

    // Find newly earned rewards (between oldLevel+1 and newLevel)
    const newRewards = rewards.filter(
      r => r.level > oldLevel && r.level <= newLevel,
    );

    if (!newRewards.length) return [];

    const awarded = [];

    if (mode === LEVEL_REWARDS_CONFIG.MODES.REPLACE) {
      // REPLACE mode: only keep the highest-level reward role, remove lower ones
      const highestReward = eligibleRewards[eligibleRewards.length - 1];
      const lowerRewards = eligibleRewards.slice(0, -1);

      // Add the highest role
      try {
        const role = guild.roles.cache.get(highestReward.roleId);
        if (role && !member.roles.cache.has(highestReward.roleId)) {
          await member.roles.add(
            role,
            `Level ${highestReward.level} reward (Replace mode)`,
          );
          awarded.push({
            level: highestReward.level,
            roleId: highestReward.roleId,
            roleName: role.name,
          });
        }
      } catch (error) {
        logger.warn(
          `Could not add reward role ${highestReward.roleId} to member ${userId}:`,
          error.message,
        );
      }

      // Remove lower reward roles
      for (const reward of lowerRewards) {
        try {
          if (member.roles.cache.has(reward.roleId)) {
            const role = guild.roles.cache.get(reward.roleId);
            if (role) {
              await member.roles.remove(
                role,
                `Replaced by level ${highestReward.level} reward`,
              );
            }
          }
        } catch (error) {
          logger.warn(
            `Could not remove old reward role ${reward.roleId} from member ${userId}:`,
            error.message,
          );
        }
      }
    } else {
      // STACK mode: add all newly earned roles, keep existing ones
      for (const reward of newRewards) {
        try {
          const role = guild.roles.cache.get(reward.roleId);
          if (role && !member.roles.cache.has(reward.roleId)) {
            await member.roles.add(role, `Level ${reward.level} reward`);
            awarded.push({
              level: reward.level,
              roleId: reward.roleId,
              roleName: role.name,
            });
          }
        } catch (error) {
          logger.warn(
            `Could not add reward role ${reward.roleId} to member ${userId}:`,
            error.message,
          );
        }
      }
    }

    if (awarded.length) {
      logger.info(
        `🎁 Level rewards granted to user ${userId} in guild ${guild.id}: ${awarded.map(a => `${a.roleName} (L${a.level})`).join(", ")}`,
      );
    }

    return awarded;
  }

  /**
   * Sync a single user's reward roles to their current level.
   * Useful when a user joins back or an admin wants to fix roles.
   *
   * @param {import('discord.js').Guild} guild
   * @param {string} userId
   * @param {number} currentLevel
   * @returns {Promise<{added: string[], removed: string[]}>}
   */
  async syncUserRewards(guild, userId, currentLevel) {
    await this.initialize();

    let rewards = await this.getRewards(guild.id);
    if (!rewards.length) return { added: [], removed: [] };

    const isPro = await this._isProActive(guild.id);
    let mode = await this.getRewardMode(guild.id);

    // 🔒 Enforce Free Tier Limits
    if (!isPro) {
      if (rewards.length > LEVEL_REWARDS_CONFIG.FREE_LIMIT) {
        rewards = rewards.slice(0, LEVEL_REWARDS_CONFIG.FREE_LIMIT);
      }
      if (mode === LEVEL_REWARDS_CONFIG.MODES.REPLACE) {
        mode = LEVEL_REWARDS_CONFIG.MODES.STACK; // Fallback to free mode
      }
    }

    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return { added: [], removed: [] };
    }

    const eligible = rewards.filter(r => r.level <= currentLevel);
    const notEligible = rewards.filter(r => r.level > currentLevel);

    const added = [];
    const removed = [];

    if (mode === LEVEL_REWARDS_CONFIG.MODES.REPLACE) {
      const highest = eligible[eligible.length - 1];

      // Add highest, remove all others
      for (const r of eligible) {
        if (highest && r.roleId === highest.roleId) {
          if (!member.roles.cache.has(r.roleId)) {
            try {
              const role = guild.roles.cache.get(r.roleId);
              if (role) {
                await member.roles.add(role, "Level reward sync");
                added.push(role.name);
              }
            } catch {
              /* skip */
            }
          }
        } else if (member.roles.cache.has(r.roleId)) {
          try {
            const role = guild.roles.cache.get(r.roleId);
            if (role) {
              await member.roles.remove(role, "Level reward sync (replace)");
              removed.push(role.name);
            }
          } catch {
            /* skip */
          }
        }
      }
    } else {
      // STACK: add all eligible, remove ineligible
      for (const r of eligible) {
        if (!member.roles.cache.has(r.roleId)) {
          try {
            const role = guild.roles.cache.get(r.roleId);
            if (role) {
              await member.roles.add(role, "Level reward sync");
              added.push(role.name);
            }
          } catch {
            /* skip */
          }
        }
      }
    }

    // Remove roles for levels above current in both modes
    for (const r of notEligible) {
      if (member.roles.cache.has(r.roleId)) {
        try {
          const role = guild.roles.cache.get(r.roleId);
          if (role) {
            await member.roles.remove(role, "Level reward sync (not eligible)");
            removed.push(role.name);
          }
        } catch {
          /* skip */
        }
      }
    }

    return { added, removed };
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if guild has Pro Engine active
   * @param {string} guildId
   * @returns {Promise<boolean>}
   */
  async _isProActive(guildId) {
    try {
      const premiumManager = getPremiumManager();
      return await premiumManager.isFeatureActive(
        guildId,
        PremiumFeatures.PRO.id,
      );
    } catch {
      return false;
    }
  }
}

let instance = null;
export async function getLevelRewardsManager() {
  if (!instance) {
    instance = new LevelRewardsManager();
    await instance.initialize();
  }
  return instance;
}
