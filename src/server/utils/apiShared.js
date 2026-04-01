import { getLogger } from "../../utils/logger.js";
import { logRequest as logRequestHelper } from "./responseHelpers.js";

const logger = getLogger();

// Store Discord client reference
let discordClient = null;

/**
 * Set the Discord client for API endpoints
 * @param {import('discord.js').Client} client - Discord.js client instance
 */
export function setDiscordClient(client) {
  discordClient = client;
}

/**
 * Get Discord client instance
 * @returns {import('discord.js').Client|null} Discord client or null
 */
export function getDiscordClient() {
  return discordClient;
}

/**
 * Log API request helper
 * @param {string} endpoint - Endpoint name
 * @param {import('express').Request} req - Express request object
 * @param {Object} [additionalInfo] - Additional context (userId, username, etc.)
 * @param {string} [emoji="📊"] - Emoji for log entry
 */
export function logRequest(endpoint, req, additionalInfo = {}, emoji = "📊") {
  const userInfo = additionalInfo?.userId
    ? ` | User: ${additionalInfo.username || additionalInfo.userId}`
    : "";
  logRequestHelper(logger, `${endpoint}${userInfo}`, req, emoji);
}
