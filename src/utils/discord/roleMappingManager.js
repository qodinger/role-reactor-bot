import { getStorageManager } from "../storage/storageManager.js";
import { getLogger } from "../logger.js";

// Cache for role mappings to reduce database calls
class RoleMappingCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 15 * 60 * 1000; // 15 minutes
    this.lastRefresh = 0;
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes
  }

  get(messageId) {
    const cached = this.cache.get(messageId);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    this.cache.delete(messageId);
    return null;
  }

  set(messageId, data) {
    this.cache.set(messageId, { data, timestamp: Date.now() });
  }

  setAll(mappings) {
    this.cache.clear();
    for (const [messageId, data] of Object.entries(mappings)) {
      this.cache.set(messageId, { data, timestamp: Date.now() });
    }
    this.lastRefresh = Date.now();
  }

  clear() {
    this.cache.clear();
    this.lastRefresh = 0;
  }

  // Check if cache needs refresh
  needsRefresh() {
    return Date.now() - this.lastRefresh > this.refreshInterval;
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const roleMappingCache = new RoleMappingCache();

// Cleanup cache every 15 minutes
setInterval(() => roleMappingCache.cleanup(), 15 * 60 * 1000).unref();

/**
 * Gets the role mapping for a specific message with caching.
 * @param {string} messageId The ID of the message.
 * @param {string} guildId The ID of the guild (optional, for validation).
 * @returns {Promise<object|null>} The role mapping, or null if not found.
 */
export async function getRoleMapping(messageId, guildId = null) {
  const logger = getLogger();

  try {
    // Check cache first
    const cached = roleMappingCache.get(messageId);
    if (cached) {
      // If guildId is provided, validate it matches
      if (guildId && cached.guildId !== guildId) {
        return null;
      }
      return cached;
    }

    // If cache needs refresh, refresh all mappings
    if (roleMappingCache.needsRefresh()) {
      await refreshAllMappings();
    }

    // Check cache again after potential refresh
    const refreshed = roleMappingCache.get(messageId);
    if (refreshed) {
      // If guildId is provided, validate it matches
      if (guildId && refreshed.guildId !== guildId) {
        return null;
      }
      return refreshed;
    }

    return null;
  } catch (error) {
    logger.error("Failed to get role mapping", error);
    return null;
  }
}

/**
 * Gets all role mappings with caching.
 * @returns {Promise<object>} All role mappings.
 */
export async function getAllRoleMappings() {
  const logger = getLogger();

  try {
    // Check if cache needs refresh
    if (roleMappingCache.needsRefresh()) {
      await refreshAllMappings();
    }

    // Return cached data
    const mappings = {};
    for (const [messageId, cached] of roleMappingCache.cache.entries()) {
      if (cached && Date.now() - cached.timestamp < roleMappingCache.ttl) {
        mappings[messageId] = cached.data;
      }
    }

    return mappings;
  } catch (error) {
    logger.error("Failed to get all role mappings", error);
    return {};
  }
}

/**
 * Refreshes all role mappings from storage.
 * @returns {Promise<void>}
 */
async function refreshAllMappings() {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const mappings = await storageManager.getRoleMappings();
    roleMappingCache.setAll(mappings);
    logger.debug("Refreshed role mapping cache");
  } catch (error) {
    logger.error("Failed to refresh role mapping cache", error);
  }
}

/**
 * Sets the role mapping for a message with cache update.
 * @param {string} messageId The ID of the message.
 * @param {string} guildId The ID of the guild.
 * @param {string} channelId The ID of the channel.
 * @param {object} roles The roles to map.
 * @returns {Promise<boolean>} True if the mapping was set successfully.
 */
export async function setRoleMapping(messageId, guildId, channelId, roles) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const success = await storageManager.setRoleMapping(
      messageId,
      guildId,
      channelId,
      roles,
    );

    if (success) {
      // Update cache
      roleMappingCache.set(messageId, { guildId, channelId, roles });
    }

    return success;
  } catch (error) {
    logger.error("Failed to set role mapping", error);
    return false;
  }
}

/**
 * Removes the role mapping for a message with cache update.
 * @param {string} messageId The ID of the message.
 * @returns {Promise<boolean>} True if the mapping was removed successfully.
 */
export async function removeRoleMapping(messageId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const success = await storageManager.deleteRoleMapping(messageId);

    if (success) {
      // Remove from cache
      roleMappingCache.cache.delete(messageId);
    }

    return success;
  } catch (error) {
    logger.error("Failed to remove role mapping", error);
    return false;
  }
}

/**
 * Clears the role mapping cache.
 * @returns {void}
 */
export function clearRoleMappingCache() {
  roleMappingCache.clear();
}
