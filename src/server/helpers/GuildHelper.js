import { getLogger } from "../../utils/logger.js";
import { getDiscordClient } from "../utils/apiShared.js";
import { getRankTitle } from "../../features/experience/rankTitles.js";

const logger = getLogger();

/**
 * Helper for guild-related data operations used by controllers
 */
export class GuildHelper {
  /**
   * Fetch live stats for a guild from Discord
   * @param {string} guildId
   * @returns {Promise<Object|null>}
   */
  static async getEnrichedGuildStats(guildId) {
    const client = getDiscordClient();
    if (!client) return null;

    try {
      const guild =
        client.guilds.cache.get(guildId) ||
        (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return null;

      // Best-effort cache enrichment
      try {
        await client.guilds
          .fetch({ guild: guildId, withCounts: true, force: true })
          .catch(() => null);
        if (guild.memberCount < 5000) {
          await guild.members.fetch({ time: 2000 }).catch(() => {});
        }
        await guild.roles.fetch().catch(() => null);
      } catch (e) {
        logger.warn(`Error ensuring guild caches for ${guildId}: ${e.message}`);
      }

      const botsInCache = guild.members.cache.filter(m => m.user.bot).size;
      const humansInCache = guild.members.cache.filter(m => !m.user.bot).size;

      const growthHistory = await (async () => {
        try {
          const { getAnalyticsManager } = await import(
            "../../features/analytics/AnalyticsManager.js"
          );
          const analyticsManager = await getAnalyticsManager();
          return await analyticsManager.getHistory(guild.id, 14);
        } catch {
          return [];
        }
      })();

      const leaderboard = await (async () => {
        try {
          const { getStorageManager } = await import(
            "../../utils/storage/storageManager.js"
          );
          const storageManager = await getStorageManager();
          const guildUsers = await storageManager.getUserExperienceLeaderboard(
            guild.id,
            3,
          );
          return guildUsers.map((l, i) => {
            const member = guild.members.cache.get(l.userId);
            return {
              rank: i + 1,
              userId: l.userId,
              username: member?.user.username || "Unknown User",
              avatar: member?.user.displayAvatarURL({
                size: 64,
              }),
              xp: l.totalXP || l.xp || 0,
              level: l.level || 1,
              rankInfo: getRankTitle(l.level || 1),
            };
          });
        } catch {
          return [];
        }
      })();

      const activity = await (async () => {
        try {
          const { getStorageManager } = await import(
            "../../utils/storage/storageManager.js"
          );
          const storageManager = await getStorageManager();
          const guildUsers = await storageManager.getUserExperienceByGuild(
            guild.id,
          );
          return {
            totalMessages: guildUsers.reduce(
              (sum, u) => sum + (u.messagesSent || 0),
              0,
            ),
            totalVoiceMins: guildUsers.reduce(
              (sum, u) => sum + (u.voiceTime || 0),
              0,
            ),
            totalCommands: guildUsers.reduce(
              (sum, u) => sum + (u.commandsUsed || 0),
              0,
            ),
            topChatters: [...guildUsers]
              .sort((a, b) => (b.messagesSent || 0) - (a.messagesSent || 0))
              .slice(0, 3)
              .map(u => ({
                username:
                  guild.members.cache.get(u.userId)?.user.username || "Unknown",
                count: u.messagesSent || 0,
              })),
            topVoiceUsers: [...guildUsers]
              .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
              .slice(0, 3)
              .map(u => ({
                username:
                  guild.members.cache.get(u.userId)?.user.username || "Unknown",
                count: u.voiceTime || 0,
              })),
          };
        } catch {
          return null;
        }
      })();

      return {
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount,
        humanCount: humansInCache,
        botCount: botsInCache,
        onlineCount: (function () {
          const precise = guild.members.cache.filter(
            m =>
              !m.user.bot &&
              m.presence?.status &&
              m.presence.status !== "offline",
          ).size;
          return (
            precise ||
            Math.max(0, (guild.approximatePresenceCount || 0) - botsInCache) ||
            0
          );
        })(),
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.filter(
          r => !r.managed && r.id !== guild.id,
        ).size,
        emojiCount: guild.emojis.cache.size,
        stickerCount: guild.stickers.cache.size,
        verificationLevel: guild.verificationLevel,
        vanityURLCode: guild.vanityURLCode,
        isPartnered: guild.partnered,
        isVerified: guild.verified,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        premiumSubscriptionCount: guild.premiumSubscriptionCount || 0,
        premiumTier: guild.premiumTier,
        features: guild.features,
        latency: client.ws.ping,
        uptime: client.uptime,
        growth: {
          new24h: guild.members.cache.filter(
            m =>
              !m.user.bot &&
              m.joinedTimestamp > Date.now() - 24 * 60 * 60 * 1000,
          ).size,
          new7d: guild.members.cache.filter(
            m =>
              !m.user.bot &&
              m.joinedTimestamp > Date.now() - 7 * 24 * 60 * 60 * 1000,
          ).size,
        },
        growthHistory,
        leaderboard,
        activity,
        recentMembers: (function () {
          const members = Array.from(guild.members.cache.values()).filter(
            m => m.user && !m.user.bot,
          );
          return members
            .sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0))
            .slice(0, 3)
            .map(m => ({
              userId: m.user.id,
              username: m.user.username,
              avatar: m.user.displayAvatarURL({ forceStatic: false, size: 64 }),
              joinedAt: m.joinedAt || new Date(),
            }));
        })(),
      };
    } catch (err) {
      logger.error(
        `Failed to fetch live guild stats for ${guildId}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Enrich leaderboard entries with Discord user data
   * @param {Array} leaderboard
   * @param {Object} client
   * @returns {Promise<Array>}
   */
  static async enrichLeaderboard(leaderboard, client) {
    const enriched = [];
    for (const entry of leaderboard) {
      let userDetails = {
        username: "Unknown User",
        discriminator: "0000",
        avatar: null,
        bot: false,
      };

      if (client) {
        const user =
          client.users.cache.get(entry.userId) ||
          (await client.users.fetch(entry.userId).catch(() => null));
        if (user) {
          userDetails = {
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.displayAvatarURL({ size: 64 }),
            bot: user.bot,
          };
        }
      }

      if (userDetails.bot) continue;

      enriched.push({
        ...entry,
        user: userDetails,
        rankInfo: getRankTitle(entry.level || 1),
      });
    }
    return enriched;
  }

  /**
   * Resolve role and channel names for a role mapping
   * @param {string} messageId
   * @param {Object} mapping
   * @param {Object} guild
   * @returns {Promise<Object>}
   */
  static async enrichRoleMapping(messageId, mapping, guild) {
    let channelName = null;
    let embedTitle = null;
    let embedDescription = null;
    let embedColor = null;

    if (guild) {
      const channel = guild.channels.cache.get(mapping.channelId);
      if (channel) {
        channelName = channel.name;
        try {
          const msg = await channel.messages.fetch(messageId);
          if (msg && msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            embedTitle = embed.title || null;
            embedDescription = embed.description || null;
            embedColor = embed.color || null;
          }
        } catch {}
      }
    }

    const enrichedRoles = {};
    let rawRoles = mapping.roles || {};
    let hideList = mapping.hideList || false;
    let selectionMode = mapping.selectionMode || "standard";

    if (
      rawRoles.roles &&
      typeof rawRoles.roles === "object" &&
      !rawRoles.roleId
    ) {
      hideList = rawRoles.hideList !== undefined ? rawRoles.hideList : hideList;
      selectionMode = rawRoles.selectionMode || selectionMode;
      rawRoles = rawRoles.roles;
    }

    for (const [emoji, roleConfig] of Object.entries(rawRoles)) {
      if (["hideList", "updatedAt", "createdAt"].includes(emoji)) continue;
      if (typeof roleConfig === "boolean" || !roleConfig) continue;

      const roleId =
        typeof roleConfig === "string" ? roleConfig : roleConfig.roleId;
      let roleName =
        typeof roleConfig === "object"
          ? roleConfig.roleName || roleConfig.name || "Unknown Role"
          : "Unknown Role";
      let roleColor = 0;

      if (guild && roleId) {
        const discordRole = guild.roles.cache.get(roleId);
        if (discordRole) {
          roleName = discordRole.name;
          roleColor = discordRole.color;
        }
      }

      enrichedRoles[emoji] = { emoji, roleId, roleName, roleColor };
    }

    return {
      messageId,
      channelId: mapping.channelId,
      channelName: channelName || mapping.channelId,
      embedTitle,
      embedDescription,
      embedColor,
      roles: enrichedRoles,
      hideList,
      selectionMode,
      createdAt: mapping.createdAt || mapping.updatedAt || null,
      updatedAt: mapping.updatedAt || null,
    };
  }
}
