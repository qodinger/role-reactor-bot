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

    // Get top members (chatters + voice) - resolve usernames from guild cache
    const topMembers = { chatters: [], voiceUsers: [] };
    try {
      const { getDiscordClient } = await import("../utils/apiShared.js");
      const client = getDiscordClient();
      const guild = client?.guilds?.cache?.get(guildId);

      const resolveUserInfo = async userId => {
        let user = null;
        if (guild) {
          try {
            // Try fetching member directly from guild (will use cache if available)
            const member = await guild.members.fetch(userId);
            user = member?.user;
          } catch (_err) {
            // Member might have left the guild
          }
        }

        if (!user && client) {
          try {
            // Fallback to fetching user globally
            user = await client.users.fetch(userId);
          } catch (_err) {
            // Failed globally
          }
        }

        return {
          username: user?.username || `User ${userId.slice(-4)}`,
          avatar: user?.displayAvatarURL?.({ size: 64 }) || null,
        };
      };

      const rawChatters = [...guildUsers]
        .filter(u => (u.messagesSent || 0) > 0)
        .sort((a, b) => (b.messagesSent || 0) - (a.messagesSent || 0))
        .slice(0, 5);

      topMembers.chatters = await Promise.all(
        rawChatters.map(async u => {
          const info = await resolveUserInfo(u.userId);
          return {
            userId: u.userId,
            username: info.username,
            avatar: info.avatar,
            count: u.messagesSent || 0,
          };
        }),
      );

      const rawVoice = [...guildUsers]
        .filter(u => (u.voiceTime || 0) > 0)
        .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
        .slice(0, 5);

      topMembers.voiceUsers = await Promise.all(
        rawVoice.map(async u => {
          const info = await resolveUserInfo(u.userId);
          return {
            userId: u.userId,
            username: info.username,
            avatar: info.avatar,
            count: u.voiceTime || 0,
          };
        }),
      );
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
