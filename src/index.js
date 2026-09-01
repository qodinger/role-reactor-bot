// Load environment variables first
import "../scripts/load-env.js";

import { Collection } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import { getLogger } from "./utils/logger.js";
import { getStorageManager } from "./utils/storage/storageManager.js";
import { getPerformanceMonitor } from "./utils/monitoring/performanceMonitor.js";
import { getHealthCheckRunner } from "./utils/monitoring/healthCheck.js";
import { getCommandHandler } from "./utils/core/commandHandler.js";
import { getBotContext } from "./utils/core/BotContext.js";
import { getVersion } from "./utils/discord/version.js";
import { setupErrorHandlers } from "./init/errorHandlers.js";
import {
  waitForDockerStartup,
  isDockerEnvironment,
} from "./init/dockerStartup.js";
import { createClient } from "./init/createClient.js";
import { loadCommands } from "./init/loadCommands.js";
import { loadEvents } from "./init/loadEvents.js";
import { startServices } from "./init/startServices.js";
import { pricingService } from "./utils/ai/pricingService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup global error handlers
setupErrorHandlers();

/**
 * Performs a graceful shutdown of the bot
 * @param {import('discord.js').Client & { commands?: Collection<string, any> }} client
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

/**
 * Validate configuration via zod schema.
 * Throws if DISCORD_TOKEN or DISCORD_CLIENT_ID are missing.
 */
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

/**
 * Initialize core systems (storage, pricing, BMAC) before login.
 */
async function initCoreSystems() {
  const logger = getLogger();

  await getStorageManager();
  getPerformanceMonitor();
  getHealthCheckRunner();

  // Pricing service
  try {
    await pricingService.initialize();
    logger.info("✅ Pricing service initialized with real-time model costs");
  } catch (error) {
    logger.warn(
      "⚠️ Pricing service failed to initialize, using fallback costs:",
      error.message,
    );
  }

  // BMAC API connectivity
  try {
    const { bmacClient } = await import("./utils/payments/bmac.js");
    if (bmacClient.enabled) {
      const status = await bmacClient.checkTokenStatus();
      if (status.valid) {
        logger.info(
          `✅ BMAC API connected (${status.supporterCount} supporters)`,
        );
      } else {
        logger.warn(`⚠️ BMAC API unreachable: ${status.error}`);
      }
    }
  } catch (error) {
    logger.debug("BMAC API check skipped:", error.message);
  }
}

/**
 * Load commands with Docker retry logic.
 */
async function loadCommandsWithRetry(client) {
  const logger = getLogger();
  const commandsPath = path.join(__dirname, "commands");
  const eventsPath = path.join(__dirname, "events");

  await loadCommands(client, commandsPath);
  await loadEvents(client, eventsPath);

  if (!isDockerEnvironment()) return;

  const commandHandler = getCommandHandler();
  const debugInfo = commandHandler.getAllCommandsDebug();

  if (debugInfo.synchronized) return;

  logger.warn("🐳 Docker: Command collections not synchronized, retrying...");
  await new Promise(resolve => {
    setTimeout(resolve, 3000);
  });
  await loadCommands(client, commandsPath);

  const retryDebugInfo = commandHandler.getAllCommandsDebug();
  if (retryDebugInfo.synchronized) {
    logger.info("✅ Docker: Command synchronization successful after retry");
  } else {
    logger.warn("⚠️ Docker: Command synchronization still failed after retry");
  }
}

/**
 * Login to Discord with retry logic.
 */
async function loginWithRetry(client) {
  const logger = getLogger();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(
        `🔌 Attempting to connect to Discord (attempt ${attempt}/${maxAttempts})...`,
      );

      const configModule = await import("./config/config.js").catch(() => null);
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
      return; // Success
    } catch (error) {
      logger.warn(`⚠️ Login attempt ${attempt} failed:`, error.message);

      if (attempt >= maxAttempts) {
        throw new Error(
          `Failed to connect to Discord after ${maxAttempts} attempts: ${error.message}`,
        );
      }

      logger.info("⏳ Waiting 5 seconds before retry...");
      await new Promise(resolve => {
        setTimeout(resolve, 5000);
      });
    }
  }
}

async function main() {
  const logger = getLogger();
  let client = null;

  try {
    await waitForDockerStartup();
    await validateEnvironment();
    logger.info(`🚀 Starting Role Reactor Bot v${getVersion()}...`);

    await initCoreSystems();

    client = await createClient();
    client.commands = new Collection();

    await loadCommandsWithRetry(client);
    await loginWithRetry(client);

    // Shutdown handlers
    const shutdown = () => gracefulShutdown(client);
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    client.on("error", error =>
      logger.error("❌ Discord client error:", error),
    );
    client.on("disconnect", () =>
      logger.warn("⚠️ Discord client disconnected"),
    );
    client.on("reconnecting", () =>
      logger.info("🔄 Discord client reconnecting..."),
    );

    // All subsystem initialization happens here
    client.once("clientReady", () => startServices(client));
  } catch (error) {
    logger.error("❌ Bot startup failed:", error);

    if (client) {
      try {
        client.destroy();
      } catch (destroyError) {
        logger.error("Error destroying client:", destroyError);
      }
    }

    process.exit(1);
  }
}

main();
