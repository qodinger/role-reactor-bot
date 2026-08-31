import { getStorageManager } from "../../../utils/storage/storageManager.js";
import { config } from "../../../config/config.js";

/**
 * Get the RoleReactor Twitch bot account used to send chat as the bot.
 * Prefers env-provided identity (TWITCH_BOT_*); falls back to the DB doc
 * populated by /stream bot-connect.
 * @returns {Promise<Object|null>} Bot account document or null
 */
export async function getStreamBotAccount() {
  const { botUserId, botLogin, botAccessToken, botRefreshToken } =
    config.twitch;
  if (botUserId) {
    return {
      botUserId,
      login: botLogin || null,
      accessToken: botAccessToken || undefined,
      refreshToken: botRefreshToken || undefined,
      source: "env",
    };
  }

  const storage = await getStorageManager();
  if (!storage.dbManager?.streamBotAccount) {
    return null;
  }
  const doc = await storage.dbManager.streamBotAccount.get();
  if (doc) {
    return { ...doc, source: "db" };
  }
  return null;
}

/**
 * Create or update the global bot account.
 * @param {Object} account - Bot account document
 * @returns {Promise<Object>} Result
 */
export async function upsertStreamBotAccount(account) {
  const storage = await getStorageManager();
  if (!storage.dbManager?.streamBotAccount) {
    throw new Error("Stream bot account repository not available");
  }
  return storage.dbManager.streamBotAccount.upsert(account);
}
