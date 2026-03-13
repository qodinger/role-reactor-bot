/**
 * Configuration Presets for Role Reactor Bot
 *
 * Pre-configured settings for different server sizes and use cases.
 * Apply these presets by copying the values to your .env file or config.js
 *
 * @see {@link https://rolereactor.app/docs/configuration} for detailed documentation
 */

/**
 * Small Server Preset
 * Perfect for: Communities with <100 members
 * - Minimal resource usage
 * - Basic caching
 * - Conservative rate limits
 */
export const SMALL = {
  name: "Small Server (<100 members)",
  description: "Optimized for small communities with minimal resource usage",

  // Database
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB: "role-reactor-bot",
  MONGODB_MIN_POOL_SIZE: "2",
  MONGODB_MAX_POOL_SIZE: "10",

  // Cache Limits (conservative)
  CACHE_MESSAGES: "100",
  CACHE_USERS: "200",
  CACHE_MEMBERS: "100",

  // Rate Limits (strict)
  AI_MAX_CONCURRENT: "3",
  AI_REQUEST_TIMEOUT: "180000", // 3 minutes
  AI_USER_RATE_LIMIT: "10",
  AI_USER_RATE_WINDOW: "60000",

  // Performance
  PERFORMANCE_MONITORING: "true",
  MEMORY_THRESHOLD: "256000000", // 256MB

  // Logging
  LOG_LEVEL: "INFO",
  LOG_CONSOLE: "true",

  // Features
  XP_SYSTEM_ENABLED: "false", // Disabled by default
  WELCOME_ENABLED: "true",
  GOODBYE_ENABLED: "true",
  TICKET_ENABLED: "true",
};

/**
 * Medium Server Preset
 * Perfect for: Communities with 100-1,000 members
 * - Balanced resource usage
 * - Moderate caching
 * - Standard rate limits
 */
export const MEDIUM = {
  name: "Medium Server (100-1,000 members)",
  description: "Balanced configuration for growing communities",

  // Database
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB: "role-reactor-bot",
  MONGODB_MIN_POOL_SIZE: "5",
  MONGODB_MAX_POOL_SIZE: "25",

  // Cache Limits (moderate)
  CACHE_MESSAGES: "300",
  CACHE_USERS: "500",
  CACHE_MEMBERS: "300",

  // Rate Limits (standard)
  AI_MAX_CONCURRENT: "10",
  AI_REQUEST_TIMEOUT: "240000", // 4 minutes
  AI_USER_RATE_LIMIT: "20",
  AI_USER_RATE_WINDOW: "60000",

  // Performance
  PERFORMANCE_MONITORING: "true",
  MEMORY_THRESHOLD: "512000000", // 512MB

  // Logging
  LOG_LEVEL: "INFO",
  LOG_CONSOLE: "true",

  // Features
  XP_SYSTEM_ENABLED: "true",
  WELCOME_ENABLED: "true",
  GOODBYE_ENABLED: "true",
  TICKET_ENABLED: "true",
};

/**
 * Large Server Preset
 * Perfect for: Communities with 1,000+ members
 * - Aggressive caching
 * - High concurrency
 * - Relaxed rate limits for users
 */
export const LARGE = {
  name: "Large Server (1,000+ members)",
  description: "High-performance configuration for large communities",

  // Database
  MONGODB_URI: "mongodb+srv://cluster.mongodb.net/?retryWrites=true&w=majority",
  MONGODB_DB: "role-reactor-bot-prod",
  MONGODB_MIN_POOL_SIZE: "10",
  MONGODB_MAX_POOL_SIZE: "50",

  // Cache Limits (aggressive)
  CACHE_MESSAGES: "500",
  CACHE_USERS: "2000",
  CACHE_MEMBERS: "1000",

  // Rate Limits (relaxed for users, strict on AI)
  AI_MAX_CONCURRENT: "20",
  AI_REQUEST_TIMEOUT: "300000", // 5 minutes
  AI_USER_RATE_LIMIT: "50",
  AI_USER_RATE_WINDOW: "60000",

  // Performance
  PERFORMANCE_MONITORING: "true",
  MEMORY_THRESHOLD: "1024000000", // 1GB

  // Logging
  LOG_LEVEL: "WARN", // Less verbose for production
  LOG_CONSOLE: "true",
  LOG_FILE: "./logs/bot.log",

  // Features
  XP_SYSTEM_ENABLED: "true",
  WELCOME_ENABLED: "true",
  GOODBYE_ENABLED: "true",
  TICKET_ENABLED: "true",
};

/**
 * Apply a preset configuration
 * @param {'small'|'medium'|'large'} presetName - Name of the preset to apply
 * @returns {Object} Preset configuration object
 *
 * @example
 * // In your config.js or .env loader
 * import { applyPreset } from './config/presets.js';
 *
 * const preset = applyPreset('medium');
 * Object.assign(process.env, preset);
 */
export function applyPreset(presetName) {
  const presets = { small: SMALL, medium: MEDIUM, large: LARGE };

  if (!presets[presetName]) {
    throw new Error(
      `Invalid preset: ${presetName}. Choose from: ${Object.keys(presets).join(", ")}`,
    );
  }

  console.log(`📋 Applying ${presets[presetName].name} preset`);
  return presets[presetName];
}

/**
 * Get preset recommendations for a server
 * @param {number} memberCount - Current server member count
 * @returns {'small'|'medium'|'large'} Recommended preset
 *
 * @example
 * const recommended = getRecommendedPreset(guild.memberCount);
 * console.log(`Recommended preset: ${recommended}`);
 */
export function getRecommendedPreset(memberCount) {
  if (memberCount < 100) return "small";
  if (memberCount < 1000) return "medium";
  return "large";
}

// Export all presets as default
export default {
  SMALL,
  MEDIUM,
  LARGE,
  applyPreset,
  getRecommendedPreset,
};
