import { getStorageManager } from "../../../utils/storage/storageManager.js";

/**
 * Default stream connection settings
 */
export const DEFAULT_STREAM_CONFIG = {
  alertsEnabled: true,
  commandsEnabled: false,
  commandPrefix: "!",
  alertTypes: {
    goLive: true,
    offline: true,
    follow: true,
    subscribe: true,
    giftSub: true,
    raid: true,
    resub: true,
  },
};

/**
 * Get stream connection for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Array>} Array of stream connections
 */
export async function getStreamConnections(guildId) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    return [];
  }
  return storage.dbManager.streamConnections.getByGuild(guildId);
}

/**
 * Get stream connection for a user
 * @param {string} discordUserId - Discord user ID
 * @param {string} platform - Platform name
 * @returns {Promise<Object|null>} Stream connection or null
 */
export async function getStreamConnection(discordUserId, platform) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    return null;
  }
  return storage.dbManager.streamConnections.getByDiscordUser(
    discordUserId,
    platform,
  );
}

/**
 * Get stream connection by platform user ID
 * @param {string} platformUserId - Platform user ID
 * @param {string} platform - Platform name
 * @returns {Promise<Object|null>} Stream connection or null
 */
export async function getStreamConnectionByPlatformUser(
  platformUserId,
  platform,
) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    return null;
  }
  return storage.dbManager.streamConnections.getByPlatformUser(
    platformUserId,
    platform,
  );
}

/**
 * Create or update a stream connection
 * @param {Object} connection - Connection object
 * @returns {Promise<Object>} Result
 */
export async function upsertStreamConnection(connection) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    throw new Error("Stream connections repository not available");
  }
  return storage.dbManager.streamConnections.upsert(connection);
}

/**
 * Remove a stream connection
 * @param {string} discordUserId - Discord user ID
 * @param {string} platform - Platform name
 * @returns {Promise<Object>} Result
 */
export async function removeStreamConnection(discordUserId, platform) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    throw new Error("Stream connections repository not available");
  }
  return storage.dbManager.streamConnections.remove(discordUserId, platform);
}

/**
 * Update stream connection settings
 * @param {string} discordUserId - Discord user ID
 * @param {string} platform - Platform name
 * @param {Object} settings - Settings to update
 * @returns {Promise<Object>} Result
 */
export async function updateStreamConnectionSettings(
  discordUserId,
  platform,
  settings,
) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamConnections) {
    throw new Error("Stream connections repository not available");
  }
  return storage.dbManager.streamConnections.updateSettings(
    discordUserId,
    platform,
    settings,
  );
}

/**
 * Validate stream connection has required fields
 * @param {Object} connection - Connection object
 * @returns {boolean} True if valid
 */
export function validateStreamConnection(connection) {
  return !!(
    connection &&
    connection.discordUserId &&
    connection.platform &&
    connection.platformUserId &&
    connection.platformLogin &&
    connection.accessToken &&
    connection.refreshToken
  );
}

/**
 * Merge default config with existing settings
 * @param {Object} existing - Existing settings
 * @returns {Object} Merged settings
 */
export function mergeStreamConfig(existing = {}) {
  return {
    ...DEFAULT_STREAM_CONFIG,
    ...existing,
    alertTypes: {
      ...DEFAULT_STREAM_CONFIG.alertTypes,
      ...(existing.alertTypes || {}),
    },
  };
}
