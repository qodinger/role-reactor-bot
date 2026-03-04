import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";
import { commandRegistry } from "../../utils/core/commandRegistry.js";
import { getRankTitle } from "../../features/experience/rankTitles.js";

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
                    rankInfo: getRankTitle(l.level || 1),
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
              lastDeductionDate:
                proSubscription.lastDeductionDate ||
                proSubscription.activatedAt,
            }
          : null,
        availableCommands: commandDetails,
        premiumConfig: PremiumFeatures,
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
  let { featureId, userId } = req.body;

  // Basic validation and defaults
  if (!featureId) featureId = "pro_engine"; // Default to the main feature

  // Try to find userId from other sources if not in body
  if (!userId) {
    if (req.user && req.user.id) userId = req.user.id;
    else if (
      req.session &&
      req.session.discordUser &&
      req.session.discordUser.id
    )
      userId = req.session.discordUser.id;
    // Check headers for potential userId passed by proxy/internal call
    else if (req.headers["x-user-id"]) userId = req.headers["x-user-id"];
    else if (req.headers["x-discord-id"]) userId = req.headers["x-discord-id"];
  }

  logRequest(
    `Activate premium feature: ${featureId} for guild ${guildId}`,
    req,
  );

  // Detailed logging for debugging
  if (!guildId || !featureId || !userId) {
    logger.warn(`Missing parameters for activate request:`, {
      guildId,
      featureId,
      userId,
      body: req.body,
      headers: req.headers, // Added to debug
      hasSession: !!req.session,
      hasUser: !!req.user,
    });

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
  let { featureId, userId } = req.body;

  // Basic validation and defaults
  if (!featureId) featureId = "pro_engine"; // Default to the main feature

  // Try to find userId from other sources if not in body
  if (!userId) {
    if (req.user && req.user.id) userId = req.user.id;
    else if (
      req.session &&
      req.session.discordUser &&
      req.session.discordUser.id
    )
      userId = req.session.discordUser.id;
    // Check headers for potential userId passed by proxy/internal call
    else if (req.headers["x-user-id"]) userId = req.headers["x-user-id"];
    else if (req.headers["x-discord-id"]) userId = req.headers["x-discord-id"];
  }

  logRequest(`Cancel premium feature: ${featureId} for guild ${guildId}`, req);

  // Detailed logging for debugging
  if (!guildId || !featureId || !userId) {
    logger.warn(`Missing parameters for cancel request:`, {
      guildId,
      featureId,
      userId,
      body: req.body,
      headers: req.headers, // Added headers to debug log
      hasSession: !!req.session,
      hasUser: !!req.user,
    });

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
        rankInfo: getRankTitle(entry.level || 1),
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

/**
 * Get guild role mappings (reaction roles)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiGetGuildRoleMappings(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild role mappings: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storageManager = await getStorageManager();

    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 6));

    const allMappings = await storageManager.getRoleMappings();
    const client = getDiscordClient();

    let guild = client?.guilds.cache.get(guildId);
    if (!guild && client) {
      guild = await client.guilds.fetch(guildId).catch(() => null);
    }

    // Ensure roles are cached for name resolution
    if (guild) {
      await guild.roles.fetch().catch(() => null);
      await guild.channels.fetch().catch(() => null);
    }

    // Step 1: Filter and sort ALL mappings (cheap — no Discord API calls)
    const sortedMappings = Object.entries(allMappings)
      .filter(([, m]) => m.guildId === guildId)
      .map(([messageId, mapping]) => ({ messageId, mapping }))
      .sort((a, b) => {
        const aTime = new Date(
          a.mapping.createdAt || a.mapping.updatedAt || 0,
        ).getTime();
        const bTime = new Date(
          b.mapping.createdAt || b.mapping.updatedAt || 0,
        ).getTime();
        return bTime - aTime;
      });

    const total = sortedMappings.length;
    const startIndex = (page - 1) * limit;
    const paginatedSlice = sortedMappings.slice(startIndex, startIndex + limit);

    // Step 2: Only enrich the paginated slice (expensive — Discord API calls)
    const guildMappings = [];

    for (const { messageId, mapping } of paginatedSlice) {
      let channelName = null;
      let embedTitle = null;
      let embedDescription = null;
      let embedColor = null;

      if (guild) {
        const channel = guild.channels.cache.get(mapping.channelId);
        if (channel) {
          channelName = channel.name;

          // Try to fetch the actual Discord message to get embed title/description
          try {
            const msg = await channel.messages.fetch(messageId);
            if (msg && msg.embeds.length > 0) {
              const embed = msg.embeds[0];
              embedTitle = embed.title || null;
              embedDescription = embed.description || null;
              embedColor = embed.color || null;
            }
          } catch (_e) {
            // Message might have been deleted — that's okay
          }
        }
      }

      // Resolve role names and colors from Discord
      // Handle two storage formats:
      // Format A (from setup): mapping.roles = { roles: { emoji: config }, hideList: bool }
      // Format B (from update): mapping.roles = { emoji: config }
      const enrichedRoles = {};
      let rawRoles = mapping.roles || {};
      let hideList = mapping.hideList || false;
      let selectionMode = mapping.selectionMode || "standard";

      // Detect wrapped format
      if (
        rawRoles.roles &&
        typeof rawRoles.roles === "object" &&
        !rawRoles.roleId
      ) {
        hideList =
          rawRoles.hideList !== undefined ? rawRoles.hideList : hideList;
        selectionMode = rawRoles.selectionMode || selectionMode;
        rawRoles = rawRoles.roles;
      }

      for (const [emoji, roleConfig] of Object.entries(rawRoles)) {
        if (
          emoji === "hideList" ||
          emoji === "updatedAt" ||
          emoji === "createdAt"
        )
          continue;
        if (
          typeof roleConfig === "boolean" ||
          roleConfig === null ||
          roleConfig === undefined
        )
          continue;

        let roleName = "Unknown Role";
        let roleColor = 0;
        let roleId = null;

        if (typeof roleConfig === "string") {
          roleId = roleConfig;
        } else if (typeof roleConfig === "object") {
          roleId = roleConfig.roleId || null;
          roleName = roleConfig.roleName || roleConfig.name || "Unknown Role";
        }

        // Resolve from live Discord data
        if (guild && roleId) {
          const discordRole = guild.roles.cache.get(roleId);
          if (discordRole) {
            roleName = discordRole.name;
            roleColor = discordRole.color;
          }
        }

        enrichedRoles[emoji] = {
          emoji,
          roleId,
          roleName,
          roleColor,
        };
      }

      guildMappings.push({
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
      });
    }

    res.json(
      createSuccessResponse({
        roleMappings: guildMappings,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total,
      }),
    );
  } catch (error) {
    logger.error(`❌ Error getting role mappings for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve role mappings",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Delete a guild role mapping (reaction role menu)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiDeleteGuildRoleMapping(req, res) {
  const { guildId, messageId } = req.params;
  logRequest(`Delete role mapping: ${messageId} for guild ${guildId}`, req);

  if (!guildId || !messageId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID and Message ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { removeRoleMapping } = await import(
      "../../utils/discord/roleMappingManager.js"
    );
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );

    const storageManager = await getStorageManager();
    const allMappings = await storageManager.getRoleMappings();
    const mapping = allMappings[messageId];

    // Verify the mapping belongs to this guild
    if (!mapping || mapping.guildId !== guildId) {
      const { statusCode, response } = createErrorResponse(
        "Role mapping not found in this guild",
        404,
      );
      return res.status(statusCode).json(response);
    }

    // Try to delete the Discord message
    let messageDeleted = false;
    const client = getDiscordClient();
    if (client) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const channel = guild.channels.cache.get(mapping.channelId);
          if (channel) {
            const msg = await channel.messages
              .fetch(messageId)
              .catch(() => null);
            if (msg) {
              await msg.delete();
              messageDeleted = true;
            }
          }
        }
      } catch (_e) {
        // Message may already be deleted, that's fine
      }
    }

    // Remove from database
    await removeRoleMapping(messageId, guildId);

    res.json(
      createSuccessResponse({
        message: "Role mapping deleted successfully",
        messageDeleted,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error deleting role mapping ${messageId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to delete role mapping",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Deploy a new role-reaction setup from the website dashboard.
 * Creates an embed message in the specified channel, adds reactions, and saves the mapping.
 *
 * POST /guilds/:guildId/roles/deploy
 * Body: { title, description, color, channelId, selectionMode, hideList, reactions }
 */
export async function apiDeployRoleReactions(req, res) {
  const { guildId } = req.params;
  logRequest(`Deploy role reactions for guild ${guildId}`, req);

  try {
    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot is not connected",
        503,
        "The Discord bot is currently offline. Please try again later.",
      );
      return res.status(statusCode).json(response);
    }

    const {
      title,
      description,
      color,
      channelId,
      selectionMode,
      hideList,
      reactions,
    } = req.body;

    // Validate required fields
    if (!channelId) {
      const { statusCode, response } = createErrorResponse(
        "Channel ID is required",
        400,
        "Please select a target channel.",
      );
      return res.status(statusCode).json(response);
    }

    if (!reactions || !Array.isArray(reactions) || reactions.length === 0) {
      const { statusCode, response } = createErrorResponse(
        "At least one role mapping is required",
        400,
        "Add at least one emoji-role mapping before deploying.",
      );
      return res.status(statusCode).json(response);
    }

    // Get the guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      const { statusCode, response } = createErrorResponse(
        "Guild not found",
        404,
        "The bot is not in this server or the server ID is invalid.",
      );
      return res.status(statusCode).json(response);
    }

    // Get the channel
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      const { statusCode, response } = createErrorResponse(
        "Channel not found",
        404,
        "The specified channel was not found in this server.",
      );
      return res.status(statusCode).json(response);
    }

    // Check bot permissions in the channel
    const botMember = guild.members.cache.get(client.user.id);
    const permissions = channel.permissionsFor(botMember);
    if (
      !permissions?.has("SendMessages") ||
      !permissions?.has("AddReactions")
    ) {
      const { statusCode, response } = createErrorResponse(
        "Missing permissions",
        403,
        "The bot needs 'Send Messages' and 'Add Reactions' permissions in the target channel.",
      );
      return res.status(statusCode).json(response);
    }

    // Build validRoles format expected by createSetupRolesEmbed
    const validRoles = reactions.map(r => ({
      emoji: r.emoji,
      roleName: r.roleName,
      roleId: r.roleId,
      roleColor: r.roleColor || 0,
    }));

    // Build role mapping for storage (emoji -> role config)
    const roleMapping = {};
    for (const r of reactions) {
      roleMapping[r.emoji] = {
        roleId: r.roleId,
        roleName: r.roleName,
        roleColor: r.roleColor || 0,
        emoji: r.emoji,
      };
    }

    // Parse color
    let embedColor = color || "#9b8bf0";
    if (embedColor && !embedColor.startsWith("#")) {
      embedColor = `#${embedColor}`;
    }

    // Import the embed builder dynamically to avoid circular deps
    const { createSetupRolesEmbed } = await import(
      "../../commands/admin/role-reactions/embeds.js"
    );

    // Create the embed
    const embed = createSetupRolesEmbed(
      title,
      description,
      embedColor,
      validRoles,
      client,
      hideList || false,
    );

    // Send the message to the channel
    const message = await channel.send({ embeds: [embed] });

    // Update footer with message ID
    try {
      if (message.embeds.length > 0) {
        const { EmbedBuilder } = await import("discord.js");
        const sentEmbed = message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(sentEmbed).setFooter({
          text: `Role Reactions • ID: ${message.id}`,
          iconURL: sentEmbed.footer?.iconURL,
        });
        await message.edit({ embeds: [updatedEmbed] });
      }
    } catch (footerError) {
      logger.warn("Failed to update footer with ID", {
        error: footerError.message,
      });
    }

    // Add reactions
    const { addReactionsToMessage } = await import(
      "../../commands/admin/role-reactions/messageOperations.js"
    );
    const reactionResult = await addReactionsToMessage(message, validRoles);

    if (
      !reactionResult.success &&
      reactionResult.failedReactions.length === validRoles.length
    ) {
      // All reactions failed — delete the message
      try {
        await message.delete();
      } catch (deleteErr) {
        logger.warn("Failed to delete message after reaction failure", {
          error: deleteErr.message,
        });
      }

      const { statusCode, response } = createErrorResponse(
        "Failed to add reactions",
        500,
        "Could not add emoji reactions to the message. Check that the emojis are valid Discord emojis.",
      );
      return res.status(statusCode).json(response);
    }

    // Save the role mapping
    const { setRoleMapping } = await import(
      "../../utils/discord/roleMappingManager.js"
    );

    const mappingData = {
      roles: roleMapping,
      hideList: hideList || false,
    };

    // Include selectionMode if not standard
    if (selectionMode && selectionMode !== "standard") {
      mappingData.selectionMode = selectionMode;
    }

    await setRoleMapping(message.id, guildId, channelId, mappingData);

    logger.info(
      `✅ Role-reaction deployed via dashboard: ${message.id} in #${channel.name} (${guildId}) with ${validRoles.length} roles`,
    );

    res.json(
      createSuccessResponse({
        message: "Role-reaction setup deployed successfully!",
        messageId: message.id,
        channelId,
        roleCount: validRoles.length,
        messageUrl: `https://discord.com/channels/${guildId}/${channelId}/${message.id}`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error deploying role reactions for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to deploy role reactions",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Update an existing role-reaction setup from the website dashboard.
 * Updates the embed message, syncs reactions, and saves the updated mapping.
 *
 * PATCH /guilds/:guildId/role-reactions/:messageId
 * Body: { title, description, color, selectionMode, hideList, reactions }
 */
export async function apiUpdateRoleReactions(req, res) {
  const { guildId, messageId } = req.params;
  logRequest(`Update role reactions ${messageId} for guild ${guildId}`, req);

  try {
    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot is not connected",
        503,
        "The Discord bot is currently offline.",
      );
      return res.status(statusCode).json(response);
    }

    const { title, description, color, selectionMode, hideList, reactions } =
      req.body;

    logger.info(
      `Updating role reaction ${messageId} with selectionMode: ${selectionMode}`,
    );

    // Get the existing mapping
    const { getRoleMapping, setRoleMapping } = await import(
      "../../utils/discord/roleMappingManager.js"
    );

    const existingMapping = await getRoleMapping(messageId, guildId);
    if (!existingMapping) {
      const { statusCode, response } = createErrorResponse(
        "Role mapping not found",
        404,
        "No role-reaction setup found with this message ID.",
      );
      return res.status(statusCode).json(response);
    }

    // Get guild and channel
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      const { statusCode, response } = createErrorResponse(
        "Guild not found",
        404,
        "The bot is not in this server.",
      );
      return res.status(statusCode).json(response);
    }

    const channelId = existingMapping.channelId;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      const { statusCode, response } = createErrorResponse(
        "Channel not found",
        404,
        "The channel for this setup no longer exists.",
      );
      return res.status(statusCode).json(response);
    }

    // Fetch the existing Discord message
    let message;
    try {
      message = await channel.messages.fetch(messageId);
    } catch {
      const { statusCode, response } = createErrorResponse(
        "Message not found",
        404,
        "The Discord message for this setup no longer exists. It may have been deleted.",
      );
      return res.status(statusCode).json(response);
    }

    // Build updated role mapping
    const roleMapping = {};
    const validRoles = [];
    if (reactions && Array.isArray(reactions) && reactions.length > 0) {
      for (const r of reactions) {
        roleMapping[r.emoji] = {
          roleId: r.roleId,
          roleName: r.roleName,
          roleColor: r.roleColor || 0,
          emoji: r.emoji,
        };
        validRoles.push({
          emoji: r.emoji,
          roleName: r.roleName,
          roleId: r.roleId,
          roleColor: r.roleColor || 0,
        });
      }
    }

    // Use existing roles if none provided
    const finalRoleMapping =
      Object.keys(roleMapping).length > 0
        ? roleMapping
        : existingMapping.roles || {};
    const finalValidRoles =
      validRoles.length > 0
        ? validRoles
        : Object.values(existingMapping.roles || {});

    // Parse color
    let embedColor = color || existingMapping.color || "#9b8bf0";
    if (embedColor && !embedColor.startsWith("#")) {
      embedColor = `#${embedColor}`;
    }

    // Build the updated embed
    const { createSetupRolesEmbed } = await import(
      "../../commands/admin/role-reactions/embeds.js"
    );

    const finalHideList =
      hideList !== undefined ? hideList : existingMapping.hideList || false;

    const embed = createSetupRolesEmbed(
      title || existingMapping.title || "Role Reactions",
      description || existingMapping.description || "React to get a role!",
      embedColor,
      finalValidRoles,
      client,
      finalHideList,
    );

    // Update footer with message ID
    const { EmbedBuilder } = await import("discord.js");
    const updatedEmbed = EmbedBuilder.from(embed).setFooter({
      text: `Role Reactions • ID: ${messageId}`,
      iconURL: client.user.displayAvatarURL(),
    });

    // Edit the message
    await message.edit({ embeds: [updatedEmbed] });

    // Sync reactions if roles changed
    if (validRoles.length > 0) {
      const { syncReactions } = await import(
        "../../commands/admin/role-reactions/messageOperations.js"
      );
      try {
        await syncReactions(message, validRoles);
      } catch (syncError) {
        logger.warn("Failed to sync reactions during dashboard update", {
          error: syncError.message,
        });
      }
    }

    // Save updated mapping
    const mappingData = {
      roles: finalRoleMapping,
      hideList: finalHideList,
      title: title || existingMapping.title,
      description: description || existingMapping.description,
      color: embedColor,
    };

    if (selectionMode) {
      mappingData.selectionMode = selectionMode;
    }

    await setRoleMapping(messageId, guildId, channelId, mappingData);

    logger.info(
      `✅ Role-reaction updated via dashboard: ${messageId} in #${channel.name} (${guildId})`,
    );

    res.json(
      createSuccessResponse({
        message: "Role-reaction setup updated successfully!",
        messageId,
        channelId,
        roleCount: finalValidRoles.length,
        messageUrl: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error updating role reactions ${messageId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to update role reactions",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
