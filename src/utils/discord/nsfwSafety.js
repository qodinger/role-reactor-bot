/**
 * NSFW Safety and Compliance System
 * Additional safeguards for production NSFW content generation
 */

import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Server-level NSFW settings and opt-in system
 * Note: We now use Discord's built-in server NSFW settings instead of custom opt-in
 */
// const NSFW_SERVER_SETTINGS = new Map(); // Deprecated - using Discord's native settings

/**
 * Prohibited content keywords that should never be generated
 * These are illegal or against platform policies regardless of channel
 */
const PROHIBITED_KEYWORDS = [
  // Age-related (strictly prohibited)
  "child",
  "children",
  "kid",
  "kids",
  "minor",
  "minors",
  "young",
  "teen",
  "teenager",
  "school",
  "student",
  "underage",
  "loli",
  "shota",
  "preteen",
  "adolescent",

  // Non-consensual content
  "rape",
  "forced",
  "non-consensual",
  "against will",
  "drugged",
  "unconscious",
  "sleeping",
  "passed out",
  "unwilling",
  "coerced",

  // Extreme content that violates most platforms
  "bestiality",
  "zoophilia",
  "necrophilia",
  "incest",
  "pedophile",
  "pedophilia",

  // Violence combined with sexual content
  "torture",
  "mutilation",
  "gore",
  "blood",
  "violence",
  "abuse",
  "harm",

  // Real person references (deepfakes, etc.)
  "celebrity",
  "famous person",
  "real person",
  "deepfake",
];

/**
 * Check if content contains prohibited keywords
 * @param {string} prompt - The prompt to check
 * @returns {Object} Validation result
 */
export function validateProhibitedContent(prompt) {
  if (!prompt || typeof prompt !== "string") {
    return { isValid: true };
  }

  const lowerPrompt = prompt.toLowerCase();

  for (const keyword of PROHIBITED_KEYWORDS) {
    if (lowerPrompt.includes(keyword)) {
      return {
        isValid: false,
        reason:
          "This content violates platform policies and cannot be generated.",
        keyword,
      };
    }
  }

  return { isValid: true };
}

/**
 * Check if server allows NSFW content based on Discord's native server settings
 * @param {Object} guild - Discord guild object
 * @returns {boolean} True if server allows NSFW generation
 */
export function isServerNSFWEnabled(guild) {
  if (!guild) return false;

  // Check if the server is marked as age-restricted (18+)
  // This is Discord's built-in NSFW server setting
  // Values: 0 = Default, 1 = Explicit, 2 = Safe, 3 = AgeRestricted
  return guild.nsfwLevel === 3; // AGE_RESTRICTED
}

/**
 * Enable NSFW generation for a server (admin only)
 * @deprecated - Now uses Discord's native server NSFW settings
 * @param {string} _guildId - Discord guild ID
 * @param {string} _adminUserId - Admin user ID who enabled it
 * @returns {boolean} Success
 */
export function enableServerNSFW(_guildId, _adminUserId) {
  logger.info(
    `[NSFW] Deprecated: Use Discord's server settings to mark server as age-restricted instead`,
  );
  return false; // Always return false to indicate this method is deprecated
}

/**
 * Disable NSFW generation for a server
 * @deprecated - Now uses Discord's native server NSFW settings
 * @param {string} _guildId - Discord guild ID
 * @param {string} _adminUserId - Admin user ID who disabled it
 * @returns {boolean} Success
 */
export function disableServerNSFW(_guildId, _adminUserId) {
  logger.info(
    `[NSFW] Deprecated: Use Discord's server settings to remove age-restriction instead`,
  );
  return false; // Always return false to indicate this method is deprecated
}

/**
 * Log NSFW generation for audit purposes
 * @param {Object} logData - Generation data to log
 */
export function logNSFWGeneration(logData) {
  const {
    userId,
    guildId,
    channelId,
    originalPrompt,
    timestamp = new Date().toISOString(),
  } = logData;

  // Log to console (in production, this should go to a secure audit log)
  logger.info(
    `[NSFW AUDIT] ${timestamp} | User: ${userId} | Guild: ${guildId} | Channel: ${channelId} | Prompt: "${originalPrompt}"`,
  );

  // TODO: In production, implement secure audit logging to database or external service
  // This should include:
  // - Encrypted storage
  // - Retention policies
  // - Access controls
  // - Compliance reporting
}

/**
 * Comprehensive NSFW validation for production use
 * @param {string} prompt - The prompt to validate
 * @param {Object} channel - Discord channel object
 * @param {Object} guild - Discord guild object
 * @param {boolean} userRequestedNSFW - Whether user explicitly requested NSFW with --nsfw flag
 * @returns {Object} Complete validation result
 */
export async function validateNSFWProduction(
  prompt,
  channel,
  guild,
  userRequestedNSFW = false,
) {
  // 1. Check for prohibited content first (always blocked)
  const prohibitedCheck = validateProhibitedContent(prompt);
  if (!prohibitedCheck.isValid) {
    return {
      isAllowed: false,
      isNSFW: true,
      reason: prohibitedCheck.reason,
      severity: "PROHIBITED",
    };
  }

  // 2. Check if content is NSFW (either detected or explicitly requested)
  const { detectNSFWPrompt } = await import("./nsfwUtils.js");
  const detectedNSFW = detectNSFWPrompt(prompt);
  const isNSFW = detectedNSFW || userRequestedNSFW;

  if (!isNSFW) {
    // Non-NSFW content is always allowed
    return { isAllowed: true, isNSFW: false };
  }

  // 3. For NSFW content, check server age-restriction setting
  if (!isServerNSFWEnabled(guild)) {
    return {
      isAllowed: false,
      isNSFW: true,
      reason:
        "NSFW image generation requires an age-restricted server. Server administrators can enable this in Discord's Server Settings > Safety Setup > Age-Restricted Server.",
      severity: "SERVER_NOT_AGE_RESTRICTED",
    };
  }

  // 4. Check channel NSFW status
  const { isNSFWChannel } = await import("./nsfwUtils.js");
  if (!isNSFWChannel(channel)) {
    return {
      isAllowed: false,
      isNSFW: true,
      reason:
        "NSFW content can only be generated in NSFW-marked channels. Please use an NSFW channel or modify your prompt.",
      severity: "CHANNEL_NOT_NSFW",
    };
  }

  // All checks passed
  return { isAllowed: true, isNSFW: true };
}

/**
 * Get NSFW safety statistics for monitoring
 * @returns {Object} Safety statistics
 */
export function getNSFWSafetyStats() {
  return {
    enabledServers: "Based on Discord's age-restricted server settings",
    totalProhibitedKeywords: PROHIBITED_KEYWORDS.length,
    // TODO: Add more metrics from audit logs
  };
}
