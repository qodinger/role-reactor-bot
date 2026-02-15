import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";
import { commandRegistry } from "../../utils/core/commandRegistry.js";

const logger = getLogger();

/**
 * Check which of the provided guild IDs the bot is currently in
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCheckGuilds(req, res) {
  logRequest("Check guilds", req);

  const { guildIds } = req.body;

  if (!guildIds || !Array.isArray(guildIds)) {
    const { statusCode, response } = createErrorResponse(
      "Guild IDs are required",
      400,
      "Provide guildIds as an array in the request body",
    );
    return res.status(statusCode).json(response);
  }

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Bot client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const installedGuilds = guildIds.filter(id => client.guilds.cache.has(id));

    res.json(
      createSuccessResponse({
        installedGuilds,
      }),
    );
  } catch (error) {
    logger.error("❌ Error checking guilds:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to check guilds",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * List all guilds the bot is currently in with detailed info
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiListGuilds(req, res) {
  logRequest("List guilds", req);

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Bot client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const guilds = await Promise.all(
      client.guilds.cache.map(async guild => {
        try {
          // Attempt a lightweight fetch for accurate counts
          await client.guilds
            .fetch({ guild: guild.id, withCounts: true })
            .catch(() => null);

          return {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true, size: 128 }),
            memberCount: guild.memberCount,
            joinedAt: guild.joinedAt,
            ownerId: guild.ownerId,
            isPartnered: guild.partnered,
            isVerified: guild.verified,
          };
        } catch (err) {
          // Fallback if fetch fails
          return {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true, size: 128 }),
            memberCount: guild.memberCount,
            error: err.message,
          };
        }
      }),
    );

    res.json(
      createSuccessResponse({
        guilds,
        total: guilds.length,
      }),
    );
  } catch (error) {
    logger.error("❌ Error listing guilds:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to list guilds",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get guild settings and available commands
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildSettings(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild settings: ${guildId}`, req);

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
    const commandHandler = getCommandHandler();

    if (!dbManager?.guildSettings) {
      const { statusCode, response } = createErrorResponse(
        "GuildSettingsRepository not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const settings = await dbManager.guildSettings.getByGuild(guildId);
    const client = getDiscordClient();

    // Ensure command registry is initialized
    if (!commandRegistry.initialized) {
      await commandRegistry.initialize(client);
    }

    // Get all available commands to show in the UI
    const allCommands = commandHandler.getAllCommands();
    const commandDetails = allCommands
      .map(name => {
        const info = commandHandler.getCommandInfo(name);
        const metadata = commandRegistry.getCommandMetadata(name);

        // Skip internal commands that shouldn't be toggled
        if (!info || name === "help" || name === "invite") return null;

        // Get category from metadata, fallback to "General"
        let category = metadata?.category || "general";

        // Capitalize for UI
        category = category.charAt(0).toUpperCase() + category.slice(1);

        return {
          name: info.name,
          description: info.description,
          category,
        };
      })
      .filter(Boolean);

    // Include premium features info in response
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const { PremiumFeatures } = await import(
      "../../features/premium/config.js"
    );
    const premiumManager = getPremiumManager();

    // Check if pro engine is active
    const isProActive = await premiumManager.isFeatureActive(
      guildId,
      PremiumFeatures.PRO.id,
    );

    // Get live guild stats from Discord Client
    let guildStats = null;

    if (client) {
      try {
        logger.info(`Fetching live stats for guild: ${guildId}`);
        const guild =
          client.guilds.cache.get(guildId) ||
          (await client.guilds.fetch(guildId).catch(err => {
            logger.warn(`Could not fetch guild ${guildId}: ${err.message}`);
            return null;
          }));

        if (guild) {
          logger.info(
            `Found guild: ${guild.name} (${guild.memberCount} members)`,
          );

          // Best-effort fetch for accurate counts
          try {
            // First fetch the guild itself to get accurate counts (requires withCounts: true for approximate values)
            await client.guilds
              .fetch({ guild: guildId, withCounts: true, force: true })
              .catch(() => null);

            // Then ensure members are cached (for role counts etc)
            if (
              guild.memberCount !== guild.members.cache.size &&
              guild.memberCount < 5000
            ) {
              await guild.members.fetch({ time: 2000 }).catch(() => {
                logger.warn(`Timeout fetching members for ${guild.name}`);
              });
            }
            // Always try to fetch roles as it's lightweight
            await guild.roles.fetch().catch(() => null);
          } catch (_e) {
            logger.warn(`Error ensuring guild caches: ${_e.message}`);
          }

          const botsInCache = guild.members.cache.filter(m => m.user.bot).size;
          const humansInCache = guild.members.cache.filter(
            m => !m.user.bot,
          ).size;

          guildStats = {
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
              // Fallback to approximate count if precise count is 0 (likely missing intents)
              // We subtract bots from approximatePresenceCount because it includes EVERYONE online
              return (
                precise ||
                Math.max(
                  0,
                  (guild.approximatePresenceCount || 0) - botsInCache,
                ) ||
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
            growthHistory: await (async () => {
              try {
                const { getAnalyticsManager } = await import(
                  "../../features/analytics/AnalyticsManager.js"
                );
                const analyticsManager = await getAnalyticsManager();
                return await analyticsManager.getHistory(guild.id, 14); // 14 days for the chart
              } catch (_e) {
                return [];
              }
            })(),
            leaderboard: await (async () => {
              try {
                const { getStorageManager } = await import(
                  "../../utils/storage/storageManager.js"
                );
                const storageManager = await getStorageManager();
                const guildUsers =
                  await storageManager.getUserExperienceLeaderboard(
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
                      dynamic: true,
                      size: 64,
                    }),
                    xp: l.totalXP || l.xp || 0,
                    level: l.level || 1,
                  };
                });
              } catch (_e) {
                logger.warn(
                  `Failed to fetch leaderboard for ${guildId}: ${_e}`,
                );
                return [];
              }
            })(),
            activity: await (async () => {
              try {
                const { getStorageManager } = await import(
                  "../../utils/storage/storageManager.js"
                );
                const storageManager = await getStorageManager();
                const guildUsers =
                  await storageManager.getUserExperienceByGuild(guild.id);

                const totalMessages = guildUsers.reduce(
                  (sum, u) => sum + (u.messagesSent || 0),
                  0,
                );
                const totalVoiceMins = guildUsers.reduce(
                  (sum, u) => sum + (u.voiceTime || 0),
                  0,
                );
                const totalCommands = guildUsers.reduce(
                  (sum, u) => sum + (u.commandsUsed || 0),
                  0,
                );

                const topChatters = [...guildUsers]
                  .sort((a, b) => (b.messagesSent || 0) - (a.messagesSent || 0))
                  .slice(0, 3)
                  .map(u => ({
                    username:
                      guild.members.cache.get(u.userId)?.user.username ||
                      "Unknown",
                    count: u.messagesSent || 0,
                  }));

                const topVoiceUsers = [...guildUsers]
                  .sort((a, b) => (b.voiceTime || 0) - (a.voiceTime || 0))
                  .slice(0, 3)
                  .map(u => ({
                    username:
                      guild.members.cache.get(u.userId)?.user.username ||
                      "Unknown",
                    count: u.voiceTime || 0,
                  }));

                return {
                  totalMessages,
                  totalVoiceMins,
                  totalCommands,
                  topChatters,
                  topVoiceUsers,
                };
              } catch (_e) {
                logger.warn(`Failed to fetch activity for ${guildId}: ${_e}`);
                return null;
              }
            })(),
            recentMembers: (function () {
              try {
                const members = Array.from(guild.members.cache.values()).filter(
                  m => m.user && !m.user.bot,
                );

                if (members.length === 0) {
                  return [];
                }

                // Sort by join date (most recent first)
                return members
                  .sort((a, b) => {
                    const timeA = a.joinedTimestamp || 0;
                    const timeB = b.joinedTimestamp || 0;
                    return timeB - timeA;
                  })
                  .slice(0, 3)
                  .map(m => ({
                    userId: m.user.id,
                    username: m.user.username,
                    avatar: m.user.displayAvatarURL({
                      forceStatic: false,
                      size: 64,
                    }),
                    joinedAt: m.joinedAt || new Date(),
                  }));
              } catch (_e) {
                logger.error(
                  `Error in recentMembers fetch for ${guild.id}:`,
                  _e,
                );
                return [];
              }
            })(),
          };
        } else {
          logger.warn(`Guild ${guildId} not found in client cache or fetch.`);
        }
      } catch (err) {
        logger.warn(
          `Failed to fetch live guild stats for ${guildId}: ${err.message}`,
        );
      }
    } else {
      logger.error(
        "Discord client is NULL in apiGetGuildSettings - cannot fetch live stats",
      );
    }

    // Get subscription details
    const proSubscription = await premiumManager.getSubscriptionStatus(
      guildId,
      PremiumFeatures.PRO.id,
    );

    res.json(
      createSuccessResponse({
        settings,
        guildStats,
        premiumFeatures: settings.premiumFeatures || {},
        isPremium: {
          pro: isProActive,
        },
        subscription: proSubscription
          ? {
              activatedAt: proSubscription.activatedAt,
              expiresAt: proSubscription.nextDeductionDate,
              cancelled: proSubscription.cancelled,
              cancelledAt: proSubscription.cancelledAt,
              autoRenew: proSubscription.autoRenew,
              cost: proSubscription.cost,
              period: proSubscription.period,
            }
          : null,
        availableCommands: commandDetails,
      }),
    );
  } catch (error) {
    logger.error(`❌ Error getting settings for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve guild settings",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get guild channels (Text and Announcement)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildChannels(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild channels: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Discord client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      const { statusCode, response } = createErrorResponse(
        "Guild not found or bot not in guild",
        404,
      );
      return res.status(statusCode).json(response);
    }

    // Fetch channels to ensure we have the latest
    await guild.channels.fetch();

    const channels = guild.channels.cache
      .filter(channel => channel.type === 0 || channel.type === 5) // Text (0) or Announcement (5)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        position: channel.rawPosition,
      }))
      .sort((a, b) => a.position - b.position);

    res.json(createSuccessResponse({ channels }));
  } catch (error) {
    logger.error(`❌ Error getting channels for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve guild channels",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get guild roles
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildRoles(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild roles: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Discord client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      const { statusCode, response } = createErrorResponse(
        "Guild not found or bot not in guild",
        404,
      );
      return res.status(statusCode).json(response);
    }

    // Fetch roles to ensure we have the latest
    await guild.roles.fetch();

    const roles = guild.roles.cache
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        rawPosition: role.rawPosition,
        hoist: role.hoist,
        managed: role.managed,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
      }))
      .sort((a, b) => b.rawPosition - a.rawPosition);

    res.json(createSuccessResponse({ roles }));
  } catch (error) {
    logger.error(`❌ Error getting roles for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve guild roles",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get guild custom emojis
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildEmojis(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild emojis: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  const client = getDiscordClient();
  if (!client) {
    const { statusCode, response } = createErrorResponse(
      "Discord client not available",
      503,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      const { statusCode, response } = createErrorResponse(
        "Guild not found or bot not in guild",
        404,
      );
      return res.status(statusCode).json(response);
    }

    // Fetch emojis to ensure we have the latest
    await guild.emojis.fetch();

    const emojis = guild.emojis.cache.map(emoji => ({
      id: emoji.id,
      name: emoji.name,
      animated: emoji.animated,
      url: emoji.url,
      identifier: `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`,
    }));

    res.json(createSuccessResponse({ emojis }));
  } catch (error) {
    logger.error(`❌ Error getting emojis for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve guild emojis",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Update guild settings
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiUpdateGuildSettings(req, res) {
  const { guildId } = req.params;
  const updates = req.body;
  logRequest(`Update guild settings: ${guildId}`, req);

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

    if (!dbManager?.guildSettings) {
      const { statusCode, response } = createErrorResponse(
        "GuildSettingsRepository not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    // Get existing settings
    const existingSettings = await dbManager.guildSettings.getByGuild(guildId);

    // Merge updates (careful with nested objects if we had many, but here we just have disabledCommands)
    const newSettings = {
      ...existingSettings,
      ...updates,
      updatedAt: new Date(),
    };

    // Check for premium features if trying to update protected settings
    if (updates.disabledCommands) {
      const { getPremiumManager } = await import(
        "../../features/premium/PremiumManager.js"
      );
      const { PremiumFeatures } = await import(
        "../../features/premium/config.js"
      );
      const premiumManager = getPremiumManager();

      const isActive = await premiumManager.isFeatureActive(
        guildId,
        PremiumFeatures.PRO.id,
      );

      if (!isActive) {
        const { statusCode, response } = createErrorResponse(
          "Premium Feature Required: Pro Engine is a premium feature. Please enable it in the premium settings.",
          403,
          "PREMIUM_REQUIRED_PRO",
        );
        return res.status(statusCode).json(response);
      }
    }

    await dbManager.guildSettings.set(guildId, newSettings);

    // Sync visibility with Discord UI if disabledCommands changed
    if (updates.disabledCommands) {
      const commandHandler = getCommandHandler();
      // We don't await this to keep the API response fast, but it runs in background
      commandHandler
        .syncGuildCommands(guildId, newSettings.disabledCommands)
        .catch(err =>
          logger.error(
            `Failed to sync command visibility for guild ${guildId}:`,
            err,
          ),
        );
    }

    res.json(
      createSuccessResponse({
        message: "Settings updated successfully",
        settings: newSettings,
      }),
    );
  } catch (error) {
    logger.error(`❌ Error updating settings for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to update guild settings",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Activate a premium feature
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiActivatePremiumFeature(req, res) {
  const { guildId } = req.params;
  const { featureId, userId } = req.body;
  logRequest(
    `Activate premium feature: ${featureId} for guild ${guildId}`,
    req,
  );

  if (!guildId || !featureId || !userId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID, Feature ID, and User ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();

    const result = await premiumManager.activateFeature(
      guildId,
      featureId,
      userId,
    );

    if (result.success) {
      res.json(createSuccessResponse(result));
    } else {
      const { statusCode, response } = createErrorResponse(result.message, 400);
      res.status(statusCode).json(response);
    }
  } catch (error) {
    logger.error(
      `❌ Error activating premium feature ${featureId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to activate premium feature",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Cancel a premium feature subscription
 * The feature remains active until the end of the current billing cycle.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCancelPremiumFeature(req, res) {
  const { guildId } = req.params;
  const { featureId, userId } = req.body;
  logRequest(`Cancel premium feature: ${featureId} for guild ${guildId}`, req);

  if (!guildId || !featureId || !userId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID, Feature ID, and User ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();

    const result = await premiumManager.cancelFeature(
      guildId,
      featureId,
      userId,
    );

    if (result.success) {
      res.json(createSuccessResponse(result));
    } else {
      const { statusCode, response } = createErrorResponse(result.message, 400);
      res.status(statusCode).json(response);
    }
  } catch (error) {
    logger.error(
      `❌ Error cancelling premium feature ${featureId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to cancel premium feature",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get premium subscription status for a guild
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetPremiumStatus(req, res) {
  const { guildId } = req.params;
  const featureId = req.query.featureId || "pro_engine";
  logRequest(`Get premium status: ${featureId} for guild ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();

    const status = await premiumManager.getSubscriptionStatus(
      guildId,
      featureId,
    );

    res.json(
      createSuccessResponse({
        guildId,
        featureId,
        subscription: status,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error getting premium status for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to get premium status",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Guild leaderboard endpoint - Returns XP leaderboard for a guild
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGuildLeaderboard(req, res) {
  logRequest("Guild leaderboard", req);

  const { guildId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    // Check if XP system is enabled
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
    }

    const { getExperienceManager } = await import(
      "../../features/experience/ExperienceManager.js"
    );
    const experienceManager = await getExperienceManager();
    const leaderboard = await experienceManager.getLeaderboard(guildId, limit);

    // Enrich with user data from Discord client
    const client = getDiscordClient();
    const enrichedLeaderboard = [];

    // Helper to get user details
    const getUserDetails = async userId => {
      let userDetails = {
        username: "Unknown User",
        discriminator: "0000",
        avatar: null,
        bot: false,
      };

      if (client) {
        let user = client.users.cache.get(userId);
        if (!user) {
          try {
            user = await client.users.fetch(userId);
          } catch (_e) {
            // Ignore fetch errors
          }
        }

        if (user) {
          userDetails = {
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.displayAvatarURL({ dynamic: true, size: 64 }),
            bot: user.bot,
          };
        }
      }
      return userDetails;
    };

    // Process entries
    for (const entry of leaderboard) {
      const userDetails = await getUserDetails(entry.userId);

      // Exclude bots from public leaderboard
      if (userDetails.bot) {
        continue;
      }

      enrichedLeaderboard.push({
        ...entry,
        user: userDetails,
      });
    }

    res.json(
      createSuccessResponse({
        guildId,
        leaderboard: enrichedLeaderboard,
        total: enrichedLeaderboard.length,
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
