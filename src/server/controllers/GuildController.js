import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { getCommandHandler } from "../../utils/core/commandHandler.js";
import { commandRegistry } from "../../utils/core/commandRegistry.js";
import { GuildHelper } from "../helpers/GuildHelper.js";

const logger = getLogger();

/**
 * Check which of the provided guild IDs the bot is currently in
 */
export async function apiCheckGuilds(req, res) {
  logRequest("Check guilds", req);
  const { guildIds } = req.body;

  if (!guildIds || !Array.isArray(guildIds)) {
    return res
      .status(400)
      .json(
        createErrorResponse(
          "Guild IDs are required",
          400,
          "Provide guildIds as an array",
        ).response,
      );
  }

  const client = getDiscordClient();
  if (!client)
    return res
      .status(503)
      .json(createErrorResponse("Bot client not available", 503).response);

  try {
    const installedGuilds = guildIds.filter(id => client.guilds.cache.has(id));
    res.json(createSuccessResponse({ installedGuilds }));
  } catch (error) {
    logger.error("❌ Error checking guilds:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to check guilds", 500, error.message)
          .response,
      );
  }
}

/**
 * List all guilds the bot is currently in
 */
export async function apiListGuilds(req, res) {
  logRequest("List guilds", req);
  const client = getDiscordClient();
  if (!client)
    return res
      .status(503)
      .json(createErrorResponse("Bot client not available", 503).response);

  try {
    const guilds = await Promise.all(
      client.guilds.cache.map(async guild => {
        try {
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

    res.json(createSuccessResponse({ guilds, total: guilds.length }));
  } catch (error) {
    logger.error("❌ Error listing guilds:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to list guilds", 500, error.message)
          .response,
      );
  }
}

/**
 * Get guild settings and available commands
 */
export async function apiGetGuildSettings(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild settings: ${guildId}`, req);

  if (!guildId)
    return res
      .status(400)
      .json(createErrorResponse("Guild ID is required", 400).response);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const commandHandler = getCommandHandler();

    if (!dbManager?.guildSettings)
      return res
        .status(503)
        .json(
          createErrorResponse("GuildSettingsRepository not available", 503)
            .response,
        );

    const settings = await dbManager.guildSettings.getByGuild(guildId);
    const client = getDiscordClient();

    if (!commandRegistry.initialized) await commandRegistry.initialize(client);

    const commandDetails = commandHandler
      .getAllCommands()
      .map(name => {
        const info = commandHandler.getCommandInfo(name);
        const metadata = commandRegistry.getCommandMetadata(name);
        if (!info || name === "help" || name === "invite") return null;

        let category = metadata?.category || "general";
        category = category.charAt(0).toUpperCase() + category.slice(1);

        return { name: info.name, description: info.description, category };
      })
      .filter(Boolean);

    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const { PremiumFeatures } = await import(
      "../../features/premium/config.js"
    );
    const premiumManager = getPremiumManager();

    const isProActive = await premiumManager.isFeatureActive(
      guildId,
      PremiumFeatures.PRO.id,
    );
    const guildStats = await GuildHelper.getEnrichedGuildStats(guildId);
    const proSubscription = await premiumManager.getSubscriptionStatus(
      guildId,
      PremiumFeatures.PRO.id,
    );

    res.json(
      createSuccessResponse({
        settings,
        guildStats,
        premiumFeatures: settings.premiumFeatures || {},
        isPremium: { pro: isProActive },
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
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve guild settings",
          500,
          error.message,
        ).response,
      );
  }
}

/**
 * Get guild channels
 */
export async function apiGetGuildChannels(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild channels: ${guildId}`, req);

  const client = getDiscordClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild)
    return res
      .status(404)
      .json(createErrorResponse("Guild not found", 404).response);

  try {
    await guild.channels.fetch();
    const channels = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.rawPosition,
      }))
      .sort((a, b) => a.position - b.position);

    res.json(createSuccessResponse({ channels }));
  } catch (error) {
    logger.error(`❌ Error getting channels for guild ${guildId}:`, error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve guild channels",
          500,
          error.message,
        ).response,
      );
  }
}

/**
 * Get guild roles
 */
export async function apiGetGuildRoles(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild roles: ${guildId}`, req);

  const client = getDiscordClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild)
    return res
      .status(404)
      .json(createErrorResponse("Guild not found", 404).response);

  try {
    await guild.roles.fetch();
    const roles = guild.roles.cache
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        rawPosition: r.rawPosition,
        hoist: r.hoist,
        managed: r.managed,
        mentionable: r.mentionable,
        permissions: r.permissions.bitfield.toString(),
      }))
      .sort((a, b) => b.rawPosition - a.rawPosition);

    res.json(createSuccessResponse({ roles }));
  } catch (error) {
    logger.error(`❌ Error getting roles for guild ${guildId}:`, error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve guild roles",
          500,
          error.message,
        ).response,
      );
  }
}

/**
 * Get guild emojis
 */
export async function apiGetGuildEmojis(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild emojis: ${guildId}`, req);

  const client = getDiscordClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild)
    return res
      .status(404)
      .json(createErrorResponse("Guild not found", 404).response);

  try {
    await guild.emojis.fetch();
    const emojis = guild.emojis.cache.map(e => ({
      id: e.id,
      name: e.name,
      animated: e.animated,
      url: e.url,
      identifier: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`,
    }));

    res.json(createSuccessResponse({ emojis }));
  } catch (error) {
    logger.error(`❌ Error getting emojis for guild ${guildId}:`, error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve guild emojis",
          500,
          error.message,
        ).response,
      );
  }
}

/**
 * Update guild settings
 */
export async function apiUpdateGuildSettings(req, res) {
  const { guildId } = req.params;
  const updates = req.body;
  logRequest(`Update guild settings: ${guildId}`, req);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    const existingSettings = await dbManager.guildSettings.getByGuild(guildId);

    const newSettings = {
      ...existingSettings,
      ...updates,
      updatedAt: new Date(),
    };

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

      if (!isActive)
        return res
          .status(403)
          .json(
            createErrorResponse(
              "Pro Engine is a premium feature.",
              403,
              "PREMIUM_REQUIRED_PRO",
            ).response,
          );

      const commandHandler = getCommandHandler();
      commandHandler
        .syncGuildCommands(guildId, newSettings.disabledCommands)
        .catch(err =>
          logger.error(
            `Failed to sync command visibility for guild ${guildId}:`,
            err,
          ),
        );
    }

    await dbManager.guildSettings.set(guildId, newSettings);
    res.json(
      createSuccessResponse({
        message: "Settings updated successfully",
        settings: newSettings,
      }),
    );
  } catch (error) {
    logger.error(`❌ Error updating settings for guild ${guildId}:`, error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to update guild settings",
          500,
          error.message,
        ).response,
      );
  }
}
