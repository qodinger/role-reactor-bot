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

/**
 * Guild leaderboard endpoint
 */
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
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
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
    }

    const { getExperienceManager } = await import(
      "../../features/experience/ExperienceManager.js"
    );
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const { PremiumFeatures } = await import(
      "../../features/premium/config.js"
    );

    const experienceManager = await getExperienceManager();
    const premiumManager = getPremiumManager();

    const [leaderboard, isPremium] = await Promise.all([
      experienceManager.getLeaderboard(guildId, limit),
      premiumManager.isFeatureActive(guildId, PremiumFeatures.PRO.id),
    ]);

    const client = getDiscordClient();
    const enrichedLeaderboard = await GuildHelper.enrichLeaderboard(
      leaderboard,
      client,
    );

    let serverInfo = null;
    if (client) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        serverInfo = {
          name: guild.name,
          icon: guild.icon,
          banner: guild.banner,
          splash: guild.splash,
          description: guild.description || null,
          memberCount: guild.memberCount,
          botCount: 0,
          humanCount: guild.memberCount,
        };
      }
    }

    const allRankedDocs =
      await experienceManager.storageManager.provider.dbManager.userExperience.collection
        .find({ guildId, totalXP: { $gt: 0 } })
        .toArray();

    const humanRankedDocs = allRankedDocs.filter(doc => {
      const user = client?.users.cache.get(doc.userId);
      return user ? !user.bot : true;
    });

    const totalXP = humanRankedDocs.reduce(
      (sum, doc) => sum + (doc.totalXP || doc.xp || 0),
      0,
    );
    const levels = humanRankedDocs.map(
      doc =>
        doc.level ||
        experienceManager.calculateLevel(doc.totalXP || doc.xp || 0),
    );
    const highestLevel = levels.length > 0 ? Math.max(...levels) : 0;
    const averageLevel =
      levels.length > 0
        ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
        : 0;

    res.json(
      createSuccessResponse({
        guildId,
        leaderboard: enrichedLeaderboard,
        total: humanRankedDocs.length,
        isPremium,
        serverInfo,
        stats: { totalXP, highestLevel, averageLevel },
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
  const query = (q || "").toLowerCase().trim();
  logRequest(`Get public leaderboards: query=${query || "none"}`, req);

  try {
    const now = Date.now();
    if (
      !query &&
      leaderboardCache.guilds.length > 0 &&
      now - leaderboardCache.lastUpdate < leaderboardCache.ttl
    ) {
      return res.json(
        createSuccessResponse({
          guilds: leaderboardCache.guilds.slice(0, 100),
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

    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const { getExperienceManager } = await import(
      "../../features/experience/ExperienceManager.js"
    );
    const experienceManager = await getExperienceManager();

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
      .filter(Boolean);

    const publicGuildsResults = await Promise.all(
      activePublicGuilds.map(async guild => {
        const leaderboard = await experienceManager.getLeaderboard(guild.id, 1);
        if (leaderboard.length === 0) return null;

        const allRankedDocs =
          await experienceManager.storageManager.provider.dbManager.userExperience.collection
            .find({ guildId: guild.id, totalXP: { $gt: 0 } })
            .toArray();

        const humanRankedDocs = allRankedDocs.filter(doc => {
          const user = client.users.cache.get(doc.userId);
          return user ? !user.bot : true;
        });

        const totalXP = humanRankedDocs.reduce(
          (sum, doc) => sum + (doc.totalXP || doc.xp || 0),
          0,
        );
        if (totalXP <= 0) return null;

        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 64 }),
          memberCount: guild.memberCount,
          totalXP,
          rankedCount: humanRankedDocs.length,
        };
      }),
    );

    const allPublicGuilds = publicGuildsResults
      .filter(g => g !== null && g.totalXP > 0)
      .sort((a, b) => b.totalXP - a.totalXP)
      .map((guild, index) => ({ ...guild, rank: index + 1 }));

    let filteredGuilds = allPublicGuilds;
    if (query) {
      const queryClean = query.toLowerCase().replace("#", "");
      const queryNum = parseInt(queryClean);
      filteredGuilds = allPublicGuilds.filter(g => {
        const nameMatch = g.name.toLowerCase().includes(query.toLowerCase());
        const rankMatch = !isNaN(queryNum) && g.rank === queryNum;
        return nameMatch || rankMatch;
      });
    }

    if (!query) {
      leaderboardCache.guilds = allPublicGuilds;
      leaderboardCache.lastUpdate = Date.now();
    }

    res.json(
      createSuccessResponse({
        guilds: filteredGuilds.slice(0, 100),
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
