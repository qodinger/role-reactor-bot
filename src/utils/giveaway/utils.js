/**
 * Giveaway Utilities - Helper functions for giveaway system
 * @module utils/giveaway/utils
 */

import { PermissionFlagsBits } from "discord.js";
import { getExperienceManager } from "../../features/experience/ExperienceManager.js";
import { getDatabaseManager } from "../storage/databaseManager.js";
import { getMentionableCommand } from "../commandUtils.js";

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., "1h", "2d", "30m", "1w")
 * @returns {number|null} Duration in milliseconds or null if invalid
 */
export function parseDuration(duration) {
  if (!duration) return null;

  const match = duration.match(/^(\d+)(s|m|h|d|w)$/i);

  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const units = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    w: 1000 * 60 * 60 * 24 * 7,
  };

  if (!units[unit]) {
    return null;
  }

  return value * units[unit];
}

/**
 * Format duration from milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (ms < 0) return "Invalid duration";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) {
    return `${weeks}w ${days % 7}d`;
  }
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Check if user has permission to manage giveaways
 * @param {Object} member - Guild member
 * @returns {boolean}
 */
export function canManageGiveaways(member) {
  if (!member) return false;

  // Check for Manage Server permission or specific role
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles)
  );
}

/**
 * Validate giveaway requirements for a user
 * @param {Object} giveaway - Giveaway data
 * @param {Object} member - Guild member
 * @returns {Promise<Object>} Validation result
 */
export async function validateRequirements(giveaway, member) {
  const result = {
    valid: true,
    errors: [],
  };

  // Check role requirements
  if (giveaway.requirements?.roles?.length > 0) {
    const hasRequiredRole = giveaway.requirements.roles.some(roleId =>
      member.roles.cache.has(roleId),
    );

    if (!hasRequiredRole) {
      result.valid = false;
      result.errors.push(
        "You do not have the required role to enter this giveaway.",
      );
    }
  }

  // Check account age
  if (giveaway.requirements?.minAccountAge > 0) {
    const accountAge = Date.now() - member.user.createdAt.getTime();

    if (accountAge < giveaway.requirements.minAccountAge) {
      result.valid = false;
      const days = Math.ceil(
        giveaway.requirements.minAccountAge / (1000 * 60 * 60 * 24),
      );
      result.errors.push(`Your account must be at least ${days} days old.`);
    }
  }

  // Check server age
  if (giveaway.requirements?.minServerAge > 0) {
    const serverAge = Date.now() - member.joinedAt.getTime();

    if (serverAge < giveaway.requirements.minServerAge) {
      result.valid = false;
      const days = Math.ceil(
        giveaway.requirements.minServerAge / (1000 * 60 * 60 * 24),
      );
      result.errors.push(
        `You must be a member of this server for at least ${days} days.`,
      );
    }
  }

  // Check if bot entries are allowed
  if (member.user.bot && !giveaway.allowBotEntries) {
    result.valid = false;
    result.errors.push("Bots cannot enter this giveaway.");
  }

  // Next-Gen Ecosystem Checks
  if (giveaway.requirements?.minLevel > 0) {
    const experienceManager = await getExperienceManager();
    const userData = await experienceManager.getUserData(
      member.guild.id,
      member.user.id,
    );
    const userLevel = experienceManager.calculateLevel(userData.totalXP);

    if (userLevel < giveaway.requirements.minLevel) {
      result.valid = false;
      result.errors.push(
        `You must be at least **Level ${giveaway.requirements.minLevel}** to enter this giveaway.`,
      );
    }
  }

  if (giveaway.requirements?.requireVote) {
    const dbManager = await getDatabaseManager();
    const userCredits = await dbManager.connectionManager.db
      .collection("credits")
      .findOne({ userId: member.user.id });

    if (
      !userCredits ||
      !userCredits.lastVote ||
      Date.now() - userCredits.lastVote > 12 * 60 * 60 * 1000
    ) {
      result.valid = false;
      const voteCmd = getMentionableCommand(member.client, "vote");
      result.errors.push(
        `You must have voted recently to enter this giveaway. Use the ${voteCmd} command to vote now!`,
      );
    }
  }

  return result;
}

/**
 * Calculate bonus entries for a user
 * @param {Object} giveaway - Giveaway data
 * @param {Object} member - Guild member
 * @returns {number} Total bonus entries
 */
export function calculateBonusEntries(giveaway, member) {
  let bonus = 0;

  if (giveaway.bonusEntries?.length > 0) {
    for (const bonusEntry of giveaway.bonusEntries) {
      if (
        bonusEntry.type === "role" &&
        member.roles.cache.has(bonusEntry.roleId)
      ) {
        bonus += bonusEntry.entries || 1;
      }

      if (bonusEntry.type === "booster" && member.premiumSince) {
        bonus += bonusEntry.entries || 2;
      }
    }
  }

  return bonus;
}

/**
 * Validate giveaway creation parameters
 * @param {Object} options - Giveaway options
 * @returns {Object} Validation result
 */
export function validateGiveawayCreation(options) {
  const result = {
    valid: true,
    errors: [],
  };

  // Validate prize
  if (!options.prize || options.prize.trim().length === 0) {
    result.valid = false;
    result.errors.push("Prize is required.");
  }

  if (options.prize && options.prize.length > 100) {
    result.valid = false;
    result.errors.push("Prize must be less than 100 characters.");
  }

  // Validate winner count
  if (!options.winners || options.winners < 1) {
    result.valid = false;
    result.errors.push("At least 1 winner is required.");
  }

  if (options.winners && options.winners > 20) {
    result.valid = false;
    result.errors.push("Maximum 20 winners allowed.");
  }

  // Validate duration
  const duration = parseDuration(options.duration);

  if (!duration) {
    result.valid = false;
    result.errors.push("Invalid duration format. Use: 30m, 1h, 1d, 1w");
  }

  const minDuration = 1000 * 60; // 1 minute
  const maxDuration = 1000 * 60 * 60 * 24 * 28; // 28 days

  if (duration && duration < minDuration) {
    result.valid = false;
    result.errors.push("Duration must be at least 1 minute.");
  }

  if (duration && duration > maxDuration) {
    result.valid = false;
    result.errors.push("Duration cannot exceed 28 days.");
  }

  // Validate description
  if (options.description && options.description.length > 1000) {
    result.valid = false;
    result.errors.push("Description must be less than 1000 characters.");
  }

  return result;
}

/**
 * Get giveaway status label
 * @param {string} status - Giveaway status
 * @returns {string} Status emoji and label
 */
export function getStatusLabel(status) {
  const labels = {
    active: "🟢 Active",
    ended: "🔴 Ended",
    completed: "✅ Completed",
    cancelled: "🚫 Cancelled",
  };

  return labels[status] || "❓ Unknown";
}

/**
 * Check if giveaway can be edited
 * @param {Object} giveaway - Giveaway data
 * @returns {boolean}
 */
export function canEditGiveaway(giveaway) {
  return giveaway.status === "active";
}

/**
 * Check if giveaway can be ended
 * @param {Object} giveaway - Giveaway data
 * @returns {boolean}
 */
export function canEndGiveaway(giveaway) {
  return giveaway.status === "active";
}

/**
 * Check if giveaway can be rerolled
 * @param {Object} giveaway - Giveaway data
 * @returns {boolean}
 */
export function canRerollGiveaway(giveaway) {
  return (
    ["ended", "completed"].includes(giveaway.status) &&
    giveaway.entries.length > 0
  );
}

/**
 * Sanitize giveaway text input
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
  if (!text) return "";

  // Remove @everyone and @here mentions
  return text.replace(/@(everyone|here)/g, "$1").trim();
}
