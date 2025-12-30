import { getLogger } from "../../utils/logger.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest as logRequestHelper,
} from "../utils/responseHelpers.js";

const logger = getLogger();

// Get package.json data
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let packageDataCache = null;

/**
 * Format package name to readable format
 * @param {string} name - Package name (e.g., "role-reactor-bot")
 * @returns {string} Formatted name (e.g., "Role Reactor Bot")
 */
function formatPackageName(name) {
  return name
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get package.json data
 * @returns {Object} Package.json data
 */
function getPackageData() {
  if (packageDataCache) {
    return packageDataCache;
  }

  try {
    const packageJsonPath = join(__dirname, "../../../package.json");
    packageDataCache = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageDataCache;
  } catch (error) {
    logger.error("Failed to read package.json", error);
    return {
      name: "role-reactor-bot",
      version: "Unknown",
      description:
        "A powerful Discord bot that helps you manage your server with role management, AI features, moderation tools, and community engagement features. Perfect for communities of all sizes.",
    };
  }
}

// Store Discord client reference
let discordClient = null;

// Cache for bot statistics (1 day TTL)
let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

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
function getDiscordClient() {
  return discordClient;
}

/**
 * Log API request
 * @param {string} endpoint - Endpoint name
 * @param {import('express').Request} req - Express request object
 */
function logRequest(endpoint, req) {
  logRequestHelper(logger, endpoint, req, "📊");
}

/**
 * API info endpoint - Detailed server information
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function apiInfo(req, res) {
  logRequest("API info", req);

  const packageData = getPackageData();
  const formattedName = formatPackageName(packageData.name);

  res.json(
    createSuccessResponse({
      message: "Unified API Server Information",
      server: {
        name: `${formattedName} API Server`,
        version: packageData.version,
        description: packageData.description,
      },
      features: {
        webhooks: true,
        healthChecks: true,
        cors: true,
        requestLogging: true,
        errorHandling: true,
      },
    }),
  );
}

/**
 * Calculate bot statistics
 * @param {boolean} [useCache=true] - Whether to use cached stats if available
 * @returns {Object|null} Bot statistics or null if client unavailable
 */
function calculateBotStats(useCache = true) {
  const client = getDiscordClient();
  if (!client) {
    return null;
  }

  // Return cached stats if still valid
  if (useCache && statsCache && Date.now() - statsCacheTime < STATS_CACHE_TTL) {
    return statsCache;
  }

  // Get guild count (servers)
  const guildCount = client.guilds.cache.size;

  // Calculate total user count across all guilds
  const uniqueUsers = new Set();
  client.guilds.cache.forEach(guild => {
    guild.members.cache.forEach(member => {
      uniqueUsers.add(member.user.id);
    });
  });

  const stats = {
    guilds: guildCount,
    users: uniqueUsers.size,
    bot: {
      id: client.user?.id || null,
      username: client.user?.username || null,
      tag: client.user?.tag || null,
    },
  };

  // Cache the results
  statsCache = stats;
  statsCacheTime = Date.now();

  return stats;
}

/**
 * Bot statistics endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function apiStats(req, res) {
  logRequest("Bot statistics", req);

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Bot client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const stats = calculateBotStats();
    if (!stats) {
      const { statusCode, response } = createErrorResponse(
        "Failed to calculate bot statistics",
        500,
      );
      return res.status(statusCode).json(response);
    }

    res.json(
      createSuccessResponse({
        bot: stats.bot,
        statistics: {
          guilds: stats.guilds,
          users: stats.users,
        },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting bot statistics:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve bot statistics",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
