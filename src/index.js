// Load environment variables first
import "../scripts/load-env.js";

import { Collection } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import { getStorageManager } from "./utils/storage/storageManager.js";
import { getPerformanceMonitor } from "./utils/monitoring/performanceMonitor.js";

/**
 * @typedef {import('discord.js').Client & { commands?: Collection<string, any> }} ExtendedClient
 */

import { getLogger } from "./utils/logger.js";
import { getScheduler as getRoleExpirationScheduler } from "./features/temporaryRoles/RoleExpirationScheduler.js";
import { getHealthCheckRunner } from "./utils/monitoring/healthCheck.js";
import { getCommandHandler } from "./utils/core/commandHandler.js";
import { getBotContext } from "./utils/core/BotContext.js";
import { getVersion } from "./utils/discord/version.js";
import { startWebhookServer, setClient } from "./server/index.js";
import { setupErrorHandlers } from "./init/errorHandlers.js";
import {
  waitForDockerStartup,
  isDockerEnvironment,
} from "./init/dockerStartup.js";
import { createClient } from "./init/createClient.js";
import { loadCommands } from "./init/loadCommands.js";
import { loadEvents } from "./init/loadEvents.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup global error handlers
setupErrorHandlers();

/**
 * Performs a graceful shutdown of the bot
 * @param {ExtendedClient} client
 */
async function gracefulShutdown(client) {
  const logger = getLogger();
  logger.info("🔄 Initiating graceful shutdown...");

  try {
    const ctx = getBotContext();
    ctx.client = client;
    await ctx.shutdown();

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

async function validateEnvironment() {
  const logger = getLogger();
  const configModule = await import("./config/config.js").catch(() => null);
  const config = configModule?.default || configModule || {};

  if (config.validate && typeof config.validate === "function") {
    if (!config.validate()) {
      logger.error("❌ Configuration validation failed");
      throw new Error("Configuration validation failed");
    }
    logger.info("✅ Configuration validated successfully");
  } else {
    logger.debug(
      "Config validation skipped (config.js not found, using environment variables)",
    );
  }
}

async function main() {
  const logger = getLogger();
  /** @type {ExtendedClient|null} */
  let client = null;
  try {
    // Wait for Docker environment to stabilize
    await waitForDockerStartup();

    await validateEnvironment();
    logger.info(`🚀 Starting Role Reactor Bot v${getVersion()}...`);

    // Health server functionality is now part of the unified API server

    // Initialize core systems
    await getStorageManager();
    const performanceMonitor = getPerformanceMonitor();
    const healthCheckRunner = getHealthCheckRunner();

    // Create Discord client
    client = await createClient();
    client.commands = new Collection();

    // Load commands and events
    const commandsPath = path.join(__dirname, "commands");
    const eventsPath = path.join(__dirname, "events");

    // Initialize core components
    await loadCommands(client, commandsPath);
    await loadEvents(client, eventsPath);

    // In Docker environments, retry command loading if there are synchronization issues
    if (isDockerEnvironment()) {
      const commandHandler = getCommandHandler();
      const debugInfo = commandHandler.getAllCommandsDebug();

      if (!debugInfo.synchronized) {
        logger.warn(
          "🐳 Docker: Command collections not synchronized, retrying...",
        );

        // Wait a bit more for Docker to stabilize
        await new Promise(resolve => {
          setTimeout(resolve, 3000);
        });

        // Retry command loading
        await loadCommands(client, commandsPath);

        const retryDebugInfo = commandHandler.getAllCommandsDebug();
        if (retryDebugInfo.synchronized) {
          logger.info(
            "✅ Docker: Command synchronization successful after retry",
          );
        } else {
          logger.warn(
            "⚠️ Docker: Command synchronization still failed after retry",
          );
        }
      }
    }

    // Start the bot with retry logic
    let loginAttempts = 0;
    const maxLoginAttempts = 3;

    while (loginAttempts < maxLoginAttempts) {
      try {
        logger.info(
          `🔌 Attempting to connect to Discord (attempt ${loginAttempts + 1}/${maxLoginAttempts})...`,
        );
        // Load config for token
        const configModule = await import("./config/config.js").catch(
          () => null,
        );
        const config = configModule?.default || configModule || {};
        const token =
          config.discord?.token ||
          process.env.DISCORD_TOKEN ||
          process.env.BOT_TOKEN;

        if (!token) {
          throw new Error(
            "Discord token not found. Set DISCORD_TOKEN or BOT_TOKEN environment variable, or provide it in config.js",
          );
        }

        await client.login(token);
        break; // Success, exit the retry loop
      } catch (error) {
        loginAttempts++;
        logger.warn(`⚠️ Login attempt ${loginAttempts} failed:`, error.message);

        if (loginAttempts >= maxLoginAttempts) {
          throw new Error(
            `Failed to connect to Discord after ${maxLoginAttempts} attempts: ${error.message}`,
          );
        }

        // Wait before retrying
        logger.info(`⏳ Waiting 5 seconds before retry...`);
        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        });
      }
    }

    // Setup shutdown handlers
    const shutdown = () => gracefulShutdown(client);
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Add error handling for Discord connection issues
    client.on("error", error => {
      logger.error("❌ Discord client error:", error);
    });

    client.on("disconnect", () => {
      logger.warn("⚠️ Discord client disconnected");
    });

    client.on("reconnecting", () => {
      logger.info("🔄 Discord client reconnecting...");
    });

    // Track guild changes
    client.on("guildCreate", async guild => {
      logger.info(`➕ Bot joined guild: ${guild.name} (${guild.id})`);
    });

    client.on("guildDelete", async guild => {
      logger.info(`➖ Bot left guild: ${guild.name} (${guild.id})`);
      try {
        const { getDatabaseManager } = await import(
          "./utils/storage/databaseManager.js"
        );
        const dbManager = await getDatabaseManager();
        if (dbManager?.customCommands) {
          await dbManager.customCommands.deleteAllForGuild(guild.id);
          logger.debug(`🗑️ Cleaned up custom commands for guild ${guild.id}`);
        }
      } catch (error) {
        logger.warn(
          `⚠️ Failed to cleanup custom commands for guild ${guild.id}:`,
          error.message,
        );
      }
    });

    client.once("clientReady", async () => {
      logger.success(`✅ ${client.user.tag} v${getVersion()} is ready!`);

      // Fetch application commands for mentionable commands </command:id>
      try {
        await client.application.commands.fetch();

        // In Development, also fetch guild commands for all guilds
        if (process.env.NODE_ENV !== "production") {
          for (const guild of client.guilds.cache.values()) {
            await guild.commands.fetch().catch(err => {
              logger.debug(
                `⚠️ Failed to fetch commands for guild ${guild.name}: ${err.message}`,
              );
            });
          }
          logger.debug("✅ All guild commands fetched for clickable mentions");
        }

        logger.debug("✅ Application commands fetched for clickable mentions");
      } catch (error) {
        logger.warn(
          "⚠️ Failed to fetch application commands for clickable mentions:",
          error.message,
        );
      }

      // Start webhook server for crypto payment integration
      try {
        await startWebhookServer();
        // Set Discord client for API endpoints
        setClient(client);
      } catch (error) {
        logger.error("❌ Failed to start webhook server:", error);
        // Continue bot operation even if webhook server fails
      }

      // Start role scheduler for scheduled role assignments/removals
      const ctx = getBotContext();
      const roleScheduler = (
        await import("./features/scheduledRoles/RoleScheduler.js")
      ).getScheduler(client);
      ctx.roleScheduler = roleScheduler;
      roleScheduler.start();

      // Start automatic cleanup for generation history
      import("./commands/general/avatar/utils/generationHistory.js").then(
        ({ GenerationHistory }) => {
          GenerationHistory.startAutoCleanup();
        },
      );

      // Start temporary role expiration scheduler
      const tempRoleScheduler = getRoleExpirationScheduler(client);
      ctx.tempRoleScheduler = tempRoleScheduler;
      tempRoleScheduler.start();

      // Start ticketing system cleanup scheduler
      try {
        const { startTicketCleanup } = await import(
          "./events/ticketing/ticketCleanup.js"
        );
        startTicketCleanup(client);
        logger.info("✅ Ticketing system cleanup started");
      } catch (error) {
        logger.error("❌ Failed to start ticket cleanup:", error);
      }

      // Initialize Giveaway Manager
      try {
        const giveawayManager = (
          await import("./features/giveaway/GiveawayManager.js")
        ).default;
        ctx.giveawayManager = giveawayManager;
        await giveawayManager.init();
        giveawayManager.client = client;

        // Setup giveaway event listeners
        const { setupGiveawayEvents } = await import("./events/giveaway.js");
        setupGiveawayEvents(giveawayManager, client);

        logger.info("✅ Giveaway Manager initialized");
      } catch (error) {
        logger.error("❌ Failed to initialize Giveaway Manager:", error);
      }

      // Initialize Role Bundle Manager
      try {
        const roleBundleManager = (
          await import("./features/rolebundles/RoleBundleManager.js")
        ).default;
        await roleBundleManager.init();
      } catch (error) {
        logger.error("❌ Failed to initialize Role Bundle Manager:", error);
      }

      // Start Premium Feature scheduler (handles Cores consumption for features)
      try {
        const { getPremiumFeatureScheduler } = await import(
          "./features/premium/PremiumFeatureScheduler.js"
        );
        const { getPremiumManager } = await import(
          "./features/premium/PremiumManager.js"
        );
        const premiumScheduler = getPremiumFeatureScheduler();
        ctx.premiumScheduler = premiumScheduler;

        // Set client for DM notifications
        const premiumManager = getPremiumManager();
        premiumManager.setClient(client);

        premiumScheduler.start();
      } catch (error) {
        logger.error("❌ Failed to start premium scheduler:", error);
      }

      // Native Discord polls handle their own UI updates automatically

      // Start poll cleanup scheduler (runs every 6 hours)
      if (ctx.pollCleanupInterval) {
        clearInterval(ctx.pollCleanupInterval);
      }
      ctx.pollCleanupInterval = setInterval(
        async () => {
          try {
            const storageManager = await getStorageManager();
            const cleanedCount = await storageManager.cleanupEndedPolls();
            if (cleanedCount > 0) {
              logger.info(
                `🧹 Poll cleanup: Removed ${cleanedCount} ended polls`,
              );
            }
          } catch (error) {
            logger.error("❌ Poll cleanup failed:", error);
          }
        },
        6 * 60 * 60 * 1000,
      ).unref(); // 6 hours

      healthCheckRunner.run(client);

      // Start automatic ComfyUI job recovery system
      try {
        const { multiProviderAIService } = await import(
          "./utils/ai/multiProviderAIService.js"
        );
        const { startAutomaticRecovery, stopAutomaticRecovery } = await import(
          "./utils/ai/providers/comfyui/startupRecovery.js"
        );

        const comfyuiProvider =
          await multiProviderAIService.getProvider("comfyui");
        if (comfyuiProvider) {
          logger.info("🔄 Starting automatic ComfyUI job recovery system...");
          await startAutomaticRecovery(comfyuiProvider, client);

          ctx.stopComfyUIRecovery = stopAutomaticRecovery;
        }
      } catch (error) {
        logger.error("❌ ComfyUI automatic recovery failed to start:", error);
        // Continue bot operation even if recovery fails
      }
      performanceMonitor.startMonitoring();
    });
  } catch (error) {
    logger.error("❌ Bot startup failed:", error);

    // Cleanup on startup failure
    if (client) {
      try {
        client.destroy();
      } catch (destroyError) {
        logger.error("Error destroying client:", destroyError);
      }
    }

    // Health server is now part of the unified API server

    process.exit(1);
  }
}

main();
