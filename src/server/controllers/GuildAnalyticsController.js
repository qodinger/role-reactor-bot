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

    // Use aggregation instead of loading all users into memory
    const activityAgg = await dbManager.userExperience.collection
      .aggregate([
        { $match: { guildId } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: { $ifNull: ["$messagesSent", 0] } },
            totalVoiceMinutes: { $sum: { $ifNull: ["$voiceTime", 0] } },
            totalCommands: { $sum: { $ifNull: ["$commandsUsed", 0] } },
          },
        },
      ])
      .toArray();

    const activityStats = activityAgg[0]
      ? {
          totalMessages: activityAgg[0].totalMessages,
          totalVoiceMinutes: activityAgg[0].totalVoiceMinutes,
          totalCommands: activityAgg[0].totalCommands,
        }
      : { totalMessages: 0, totalVoiceMinutes: 0, totalCommands: 0 };

    // Get top members directly from DB (sorted, limited) instead of loading all
    const topMembers = { chatters: [], voiceUsers: [] };
    try {
      const { getDiscordClient } = await import("../utils/apiShared.js");
      const client = getDiscordClient();

      // Use cache-only lookup to avoid Discord API rate limits
      const resolveUserInfo = userId => {
        const user = client?.users?.cache?.get(userId);
        return {
          username: user?.username || `User ${userId.slice(-4)}`,
          avatar: user?.displayAvatarURL?.({ size: 64 }) || null,
        };
      };

      const rawChatters = await dbManager.userExperience.collection
        .find({ guildId, messagesSent: { $gt: 0 } })
        .sort({ messagesSent: -1 })
        .limit(5)
        .project({ userId: 1, messagesSent: 1 })
        .toArray();

      topMembers.chatters = rawChatters.map(u => {
        const info = resolveUserInfo(u.userId);
        return {
          userId: u.userId,
          username: info.username,
          avatar: info.avatar,
          count: u.messagesSent || 0,
        };
      });

      const rawVoice = await dbManager.userExperience.collection
        .find({ guildId, voiceTime: { $gt: 0 } })
        .sort({ voiceTime: -1 })
        .limit(5)
        .project({ userId: 1, voiceTime: 1 })
        .toArray();

      topMembers.voiceUsers = rawVoice.map(u => {
        const info = resolveUserInfo(u.userId);
        return {
          userId: u.userId,
          username: info.username,
          avatar: info.avatar,
          count: u.voiceTime || 0,
        };
      });
    } catch (topErr) {
      logger.warn(
        `Could not resolve top members for ${guildId}:`,
        topErr.message,
      );
    }

    res.json(
      createSuccessResponse({
        guildId,
        days,
        history,
        activityStats,
        topMembers,
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
