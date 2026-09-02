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
    // GatewayIntentBits.MessageContent, // Requires Discord verification for 100+ servers
  ];

  const privilegedIntents = [
    GatewayIntentBits.GuildMembers,
    // GatewayIntentBits.MessageContent,
  ];
  const hasPrivilegedIntents = privilegedIntents.some(i => intents.includes(i));
  if (hasPrivilegedIntents) {
    getLogger().warn(
      "⚠️ Bot is using privileged intents (GuildMembers, MessageContent). " +
        "Ensure these are enabled in the Discord Developer Portal, or the bot may not function correctly.",
    );
  }

  const defaultCacheLimits = {
    MessageManager: 200,
    ChannelManager: 100,
    GuildMemberManager: 100,
    RoleManager: 100,
  };

  const defaultRestOptions = {
    timeout: 15000,
    retries: 3,
    offset: 750,
  };

  const client = new Client({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    makeCache: Options.cacheWithLimits(
      config.cacheLimits || defaultCacheLimits,
    ),
    // discord.js v14 REST options: timeout/retries/offset/globalBroadcast.
    // Per-user/per-guild limits are enforced automatically by the built-in handler.
    rest: config.rateLimits?.rest || defaultRestOptions,
    ...(config.rateLimits?.ws ? { ws: config.rateLimits.ws } : {}),
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
