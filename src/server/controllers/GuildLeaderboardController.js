import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { GuildHelper } from "../helpers/GuildHelper.js";

const logger = getLogger();

// Simple in-memory cache for public leaderboards
const leaderboardCache = {
  guilds: [],
  lastUpdate: 0,
  ttl: 5 * 60 * 1000,
};

// Per-guild stats cache (5 min TTL)
const guildStatsCache = new Map();
const GUILD_STATS_TTL = 5 * 60 * 1000;

export async function apiGuildLeaderboard(req, res) {
  const { guildId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  logRequest(`Guild leaderboard: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } =
      await import("../../utils/storage/databaseManager.js");
    const dbManager = await getDatabaseManager();

    if (dbManager.guildSettings) {
      const guildSettings = await dbManager.guildSettings.getByGuild(guildId);
      if (!guildSettings?.experienceSystem?.enabled) {
        const { statusCode, response } = createErrorResponse(
          "XP system is disabled in this server",
          403,
          "XP_DISABLED",
        );
        return res.status(statusCode).json(response);
      }

      const isDashboard = req.query.source === "dashboard";
      const isPublic =
        guildSettings?.experienceSystem?.publicLeaderboard !== false;
      if (!isPublic && !isDashboard) {
        const { statusCode, response } = createErrorResponse(
          "This server's leaderboard is marked as private",
          403,
          "PRIVATE",
        );
        return res.status(statusCode).json(response);
      }

      const client = getDiscordClient();
      const guild = client?.guilds.cache.get(guildId);
      if (guild && (guild.nsfwLevel === 1 || guild.nsfwLevel === 3)) {
        const { statusCode, response } = createErrorResponse(
          "NSFW leaderboards are strictly prohibited to comply with global advertising standards.",
          403,
          "NSFW_RESTRICTED",
        );
        return res.status(statusCode).json(response);
      }
    }

    const { getExperienceManager } =
      await import("../../features/experience/ExperienceManager.js");
    const { getPremiumManager } =
      await import("../../features/premium/PremiumManager.js");
    const { PremiumFeatures } =
      await import("../../features/premium/config.js");

    const experienceManager = await getExperienceManager();
    const premiumManager = getPremiumManager();

    const [leaderboard, isPremium] = await Promise.all([
      experienceManager.getLeaderboard(guildId, limit),
      premiumManager.isFeatureActive(guildId, PremiumFeatures.PRO.id),
    ]);

    const client = getDiscordClient();
    const guild = client?.guilds.cache.get(guildId);

    const enrichedLeaderboard = await GuildHelper.enrichLeaderboard(
      leaderboard,
      client,
      guild || guildId,
    );

    let serverInfo = null;
    if (client) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const botsInCache = guild.members.cache.filter(m => m.user.bot).size;
        const totalMembers = guild.approximateMemberCount || guild.memberCount;
        serverInfo = {
          name: guild.name,
          icon: guild.icon,
          banner: guild.banner,
          splash: guild.splash,
          description: guild.description || null,
          memberCount: totalMembers,
          botCount: botsInCache,
          humanCount: totalMembers - botsInCache,
        };
      }
    }

    // Use cached stats or compute via aggregation
    const now = Date.now();
    const cached = guildStatsCache.get(guildId);
    let stats;
    let total;

    if (cached && now - cached.timestamp < GUILD_STATS_TTL) {
      stats = cached.stats;
      total = cached.total;
    } else {
      const collection = dbManager.userExperience.collection;

      const [aggResult] = await collection
        .aggregate([
          { $match: { guildId, totalXP: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              totalXP: { $sum: { $ifNull: ["$totalXP", "$xp"] } },
              highestLevel: { $max: { $ifNull: ["$level", 0] } },
              averageLevel: { $avg: { $ifNull: ["$level", 0] } },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      stats = aggResult
        ? {
            totalXP: aggResult.totalXP || 0,
            highestLevel: aggResult.highestLevel || 0,
            averageLevel: Math.round(aggResult.averageLevel || 0),
          }
        : { totalXP: 0, highestLevel: 0, averageLevel: 0 };
      total = aggResult?.count || 0;

      guildStatsCache.set(guildId, { stats, total, timestamp: now });
    }

    res.json(
      createSuccessResponse({
        guildId,
        leaderboard: enrichedLeaderboard,
        total,
        isPremium,
        serverInfo,
        stats,
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting guild leaderboard:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve leaderboard",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Public endpoint to search or list public guild leaderboards
 */
export async function apiGetPublicLeaderboards(req, res) {
  const { q } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const query = (q || "").toLowerCase().trim();
  logRequest(
    `Get public leaderboards: query=${query || "none"} limit=${limit}`,
    req,
  );

  try {
    const now = Date.now();

    // Determine if query is an exact guild ID (snowflake: 17-20 digit number)
    const isGuildIdSearch = query && /^\d{17,20}$/.test(query);

    // Use cache for default listing and name/rank searches
    // Only bypass cache for exact guild ID lookups (to find newly enabled servers)
    if (
      !isGuildIdSearch &&
      leaderboardCache.guilds.length > 0 &&
      now - leaderboardCache.lastUpdate < leaderboardCache.ttl
    ) {
      let filteredGuilds = leaderboardCache.guilds;

      if (query) {
        const queryClean = query.toLowerCase().replace("#", "");
        const queryNum = parseInt(queryClean, 10);
        filteredGuilds = leaderboardCache.guilds.filter(g => {
          const nameMatch = g.name.toLowerCase().includes(query.toLowerCase());
          const rankMatch = !isNaN(queryNum) && g.rank === queryNum;
          return nameMatch || rankMatch;
        });
      }

      return res.json(
        createSuccessResponse({
          guilds: filteredGuilds.slice(0, limit),
          cached: true,
          nextUpdateIn: Math.round(
            (leaderboardCache.ttl - (now - leaderboardCache.lastUpdate)) / 1000,
          ),
        }),
      );
    }

    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot client not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const { getDatabaseManager } =
      await import("../../utils/storage/databaseManager.js");
    const dbManager = await getDatabaseManager();

    const publicSettings = await dbManager.guildSettings.collection
      .find({
        "experienceSystem.enabled": true,
        "experienceSystem.publicLeaderboard": { $ne: false },
      })
      .project({ guildId: 1 })
      .toArray();

    const publicGuildIds = publicSettings.map(s => s.guildId);
    const activePublicGuilds = publicGuildIds
      .map(id => client.guilds.cache.get(id))
      .filter(g => g && g.nsfwLevel !== 1 && g.nsfwLevel !== 3);

    // Single aggregation for all public guilds instead of per-guild queries
    const activeGuildIds = activePublicGuilds.map(g => g.id);
    const collection = dbManager.userExperience.collection;

    const guildAggs = await collection
      .aggregate([
        { $match: { guildId: { $in: activeGuildIds }, totalXP: { $gt: 0 } } },
        {
          $group: {
            _id: "$guildId",
            totalXP: { $sum: { $ifNull: ["$totalXP", "$xp"] } },
            rankedCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const statsMap = new Map(
      guildAggs.map(g => [
        g._id,
        { totalXP: g.totalXP, rankedCount: g.rankedCount },
      ]),
    );

    const publicGuildsResults = activePublicGuilds
      .map(guild => {
        const stats = statsMap.get(guild.id);
        if (!stats || stats.totalXP <= 0) return null;

        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const totalMembers = guild.approximateMemberCount || guild.memberCount;
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 64 }),
          memberCount: totalMembers - botCount,
          totalXP: stats.totalXP,
          rankedCount: stats.rankedCount,
        };
      })
      .filter(Boolean);

    const allPublicGuilds = publicGuildsResults
      .filter(g => g !== null && g.totalXP > 0)
      .sort((a, b) => b.totalXP - a.totalXP)
      .map((guild, index) => ({ ...guild, rank: index + 1 }));

    let filteredGuilds = allPublicGuilds;
    if (query) {
      const queryClean = query.toLowerCase().replace("#", "");
      const queryNum = parseInt(queryClean, 10);
      filteredGuilds = allPublicGuilds.filter(g => {
        const idMatch = g.id === query;
        const nameMatch = g.name.toLowerCase().includes(query.toLowerCase());
        const rankMatch = !isNaN(queryNum) && g.rank === queryNum;
        return idMatch || nameMatch || rankMatch;
      });
    }

    if (!query) {
      leaderboardCache.guilds = allPublicGuilds;
      leaderboardCache.lastUpdate = Date.now();
    }

    res.json(
      createSuccessResponse({
        guilds: filteredGuilds.slice(0, limit),
        cached: false,
      }),
    );
  } catch (error) {
    logger.error("❌ Error searching public leaderboards:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to search public leaderboards",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
