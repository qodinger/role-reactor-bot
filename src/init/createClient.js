import { Client, GatewayIntentBits, Partials, Options } from "discord.js";
import { getLogger } from "../utils/logger.js";

export async function createClient() {
  const configModule = await import("../config/config.js").catch(() => null);
  const config = configModule?.default || configModule || {};

  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.GuildEmojisAndStickers,
  ];

  const defaultCacheLimits = {
    MessageManager: 200,
    ChannelManager: 100,
    GuildMemberManager: 100,
    RoleManager: 100,
  };

  const defaultRateLimits = {
    rest: {
      globalLimit: 50,
      userLimit: 10,
      guildLimit: 20,
    },
    ws: {
      heartbeatInterval: 41250,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    },
  };

  const client = new Client({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    makeCache: Options.cacheWithLimits(
      config.cacheLimits || defaultCacheLimits,
    ),
    rest: {
      ...(config.rateLimits?.rest || defaultRateLimits.rest),
      globalLimit:
        config.rateLimits?.rest?.globalLimit ||
        defaultRateLimits.rest.globalLimit,
      userLimit:
        config.rateLimits?.rest?.userLimit || defaultRateLimits.rest.userLimit,
      guildLimit:
        config.rateLimits?.rest?.guildLimit ||
        defaultRateLimits.rest.guildLimit,
    },
    ws: {
      ...(config.rateLimits?.ws || defaultRateLimits.ws),
      heartbeatInterval:
        config.rateLimits?.ws?.heartbeatInterval ||
        defaultRateLimits.ws.heartbeatInterval,
      maxReconnectAttempts:
        config.rateLimits?.ws?.maxReconnectAttempts ||
        defaultRateLimits.ws.maxReconnectAttempts,
      reconnectDelay:
        config.rateLimits?.ws?.reconnectDelay ||
        defaultRateLimits.ws.reconnectDelay,
    },
  });

  client.rest.on("rateLimited", rateLimitInfo => {
    const logger = getLogger();
    const method = rateLimitInfo?.method ?? "UNKNOWN";
    const route =
      rateLimitInfo?.route ?? rateLimitInfo?.majorParameter ?? "unknown";
    const retryAfter =
      rateLimitInfo?.retryAfter ?? rateLimitInfo?.timeToReset ?? 0;

    logger.warn(
      `🚫 Rate limited: ${method} ${route} - Retry after ${retryAfter}ms`,
    );

    logger.debug(`Rate limit details:`, {
      method: rateLimitInfo?.method ?? "UNKNOWN",
      route,
      retryAfter,
      limit: rateLimitInfo?.limit ?? "unknown",
      global: rateLimitInfo?.global ?? false,
      hash: rateLimitInfo?.hash ?? "unknown",
      majorParameter: rateLimitInfo?.majorParameter ?? "unknown",
    });
  });

  client.rest.on("invalidated", () => {
    getLogger().error(
      "❌ REST connection invalidated - attempting reconnection...",
    );
  });

  client.on("clientReady", () => {
    const logger = getLogger();
    logger.info(`🚀 Bot connected with ${client.guilds.cache.size} guilds`);

    setTimeout(() => {
      try {
        logger.debug("Cache statistics:", {
          guilds: client.guilds.cache.size,
          users: client.users.cache.size,
          channels: client.channels.cache.size,
          roles: "N/A (avoiding API calls during startup)",
        });
      } catch (error) {
        logger.debug("Cache statistics logging failed:", error.message);
      }
    }, 5000);
  });

  return client;
}
