import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";

const logger = getLogger();

/**
 * Get detailed analytics history for a guild
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildAnalytics(req, res) {
  const { guildId } = req.params;
  const days = parseInt(req.query.days) || 30; // Default to 30 days if not specified
  logRequest(`Get guild analytics: ${guildId} (${days} days)`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getAnalyticsManager } = await import(
      "../../features/analytics/AnalyticsManager.js"
    );
    const analyticsManager = await getAnalyticsManager();

    // Get join/leave history
    const history = await analyticsManager.getHistory(guildId, days);

    // Get message/voice stats (aggregates)
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    // Query only users belonging to this guild
    const guildUsers = await dbManager.userExperience.collection
      .find({ guildId })
      .toArray();

    const activityStats = {
      totalMessages: guildUsers.reduce(
        (sum, u) => sum + (u.messagesSent || 0),
        0,
      ),
      totalVoiceMinutes: guildUsers.reduce(
        (sum, u) => sum + (u.voiceTime || 0),
        0,
      ),
      totalCommands: guildUsers.reduce(
        (sum, u) => sum + (u.commandsUsed || 0),
        0,
      ),
    };

    res.json(
      createSuccessResponse({
        guildId,
        days,
        history,
        activityStats,
      }),
    );
  } catch (error) {
    logger.error(`❌ Error getting analytics for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve guild analytics",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
