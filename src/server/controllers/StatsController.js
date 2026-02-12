import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";

const logger = getLogger();

// Cache for bot statistics (1 day TTL)
let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

/**
 * Calculate bot statistics
 * @param {boolean} [useCache=true] - Whether to use cached stats if available
 * @returns {Promise<Object|null>} Bot statistics or null if client unavailable
 */
async function calculateBotStats(useCache = true) {
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
  // Note: This is an expensive operation for large bots
  // Using a Set to count unique users
  const uniqueUsers = new Set();

  // Use for...of loop for better performance with async if needed,
  // though we are synchronous here.
  // We can use setImmediate to yield if needed, but for now just basic optimization.
  for (const guild of client.guilds.cache.values()) {
    // We can only count cached members. For accurate counts, we'd need to fetch,
    // but that's too heavy. Using cache is standard for these stats.
    for (const member of guild.members.cache.values()) {
      if (!member.user.bot) {
        uniqueUsers.add(member.user.id);
      }
    }
  }

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
export async function apiStats(req, res) {
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
    const stats = await calculateBotStats();
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

/**
 * Command usage statistics
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCommandUsage(req, res) {
  logRequest("Command usage", req);

  try {
    const commandHandler = getCommandHandler();
    const commandStats = await commandHandler.getCommandStats();

    if (!commandStats || Object.keys(commandStats).length === 0) {
      return res.json(
        createSuccessResponse({
          commands: [],
          summary: {
            totalCommands: 0,
            totalExecutions: 0,
          },
        }),
      );
    }

    // Filter for specific command if requested
    const specificCommand = req.query.command;
    if (specificCommand) {
      const stats = commandStats[specificCommand];
      if (!stats) {
        const { statusCode, response } = createErrorResponse(
          `Command '${specificCommand}' not found or has no usage data`,
          404,
        );
        return res.status(statusCode).json(response);
      }
      return res.json(
        createSuccessResponse({
          command: specificCommand,
          ...stats,
        }),
      );
    }

    // Convert to array and sort
    let commandArray = Object.entries(commandStats).map(([name, stats]) => ({
      name,
      ...stats,
    }));

    // Calculate total executions
    const totalExecutions = commandArray.reduce(
      (sum, cmd) => sum + (cmd.count || 0),
      0,
    );

    // Sort by count descending
    commandArray.sort((a, b) => b.count - a.count);

    // Apply limit
    const limit = parseInt(req.query.limit);
    if (!isNaN(limit) && limit > 0) {
      commandArray = commandArray.slice(0, limit);
    }

    res.json(
      createSuccessResponse({
        commands: commandArray,
        summary: {
          totalCommands: commandArray.length,
          totalExecutions,
        },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting command usage stats:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve command usage statistics",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
