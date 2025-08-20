/**
 * @fileoverview Main entry point for the Role Reactor Bot
 *
 * This module initializes and starts the Discord bot with all necessary systems:
 * - Discord client configuration with proper intents and partials
 * - Command and event loading from directories
 * - System initialization (storage, performance monitoring, health checks)
 * - Graceful shutdown handling
 *
 * @author Tyecode
 * @version Dynamic (see package.json)
 * @license MIT
 */

// Load environment variables first
import "../scripts/load-env.js";

import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Options,
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/config.js";
import { getStorageManager } from "./utils/storage/storageManager.js";
import { getPerformanceMonitor } from "./utils/monitoring/performanceMonitor.js";
import { getLogger } from "./utils/logger.js";
import { getScheduler } from "./features/temporaryRoles/RoleExpirationScheduler.js";
import { getHealthCheckRunner } from "./utils/monitoring/healthCheck.js";
import HealthServer from "./utils/monitoring/healthServer.js";
import { getCommandHandler } from "./utils/core/commandHandler.js";
import { getEventHandler } from "./utils/core/eventHandler.js";
import { getVersion } from "./utils/discord/version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global error handlers
process.on("unhandledRejection", error => {
  getLogger().error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  getLogger().error("Uncaught exception:", error);
  process.exit(1);
});

// Docker-specific startup handling
function isDockerEnvironment() {
  return (
    process.env.NODE_ENV === "production" &&
    (process.env.DOCKER_ENV === "true" ||
      fs.existsSync("/.dockerenv") ||
      (fs.existsSync("/proc/1/cgroup") &&
        fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker")))
  );
}

async function waitForDockerStartup() {
  if (!isDockerEnvironment()) return;

  const logger = getLogger();
  logger.info(
    "🐳 Docker environment detected, waiting for system stability...",
  );

  // Wait for file system to be ready
  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });

  // Check if data directory is accessible
  try {
    await fs.promises.access("./data", fs.constants.R_OK | fs.constants.W_OK);
    logger.info("✅ Data directory is accessible");
  } catch (_error) {
    logger.warn("⚠️ Data directory not accessible, creating...");
    try {
      await fs.promises.mkdir("./data", { recursive: true });
      logger.info("✅ Data directory created");
    } catch (mkdirError) {
      logger.error("❌ Failed to create data directory:", mkdirError);
    }
  }

  // Additional wait for Docker container stability
  await new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
  logger.info("🚀 Docker startup wait completed");
}

function validateEnvironment() {
  const logger = getLogger();
  if (!config.validate()) {
    logger.error("❌ Configuration validation failed");
    throw new Error("Configuration validation failed");
  }
  logger.info("✅ Configuration validated successfully");
}

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    makeCache: Options.cacheWithLimits(config.cacheLimits),
    // Use rate limit configuration from config
    rest: config.rateLimits.rest,
    ws: config.rateLimits.ws,
  });

  // Add rate limit event handlers
  client.rest.on("rateLimited", rateLimitInfo => {
    const logger = getLogger();
    logger.warn(
      `🚫 Rate limited: ${rateLimitInfo.method} ${rateLimitInfo.path} - Retry after ${rateLimitInfo.timeout}ms`,
    );
  });

  client.rest.on("invalidated", () => {
    const logger = getLogger();
    logger.error("❌ REST connection invalidated - attempting reconnection...");
  });

  return client;
}

async function gracefulShutdown(client, healthServer) {
  const logger = getLogger();
  logger.info("🔄 Initiating graceful shutdown...");

  try {
    // Stop accepting new requests
    if (healthServer) {
      healthServer.stop();
    }

    // Stop scheduler
    const scheduler = getScheduler(client);
    if (scheduler) {
      scheduler.stop();
    }

    // Close Discord connection
    if (client) {
      client.destroy();
    }

    // Stop performance monitoring
    const performanceMonitor = getPerformanceMonitor();
    if (performanceMonitor && performanceMonitor.stopMonitoring) {
      performanceMonitor.stopMonitoring();
    }

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

async function loadCommands(client, commandsPath) {
  const logger = getLogger();
  const commandHandler = getCommandHandler();

  try {
    // Set client reference in command handler for fallback access
    commandHandler.setClient(client);

    const commandFolders = await fs.promises.readdir(commandsPath);
    let loadedCount = 0;
    let errorCount = 0;

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const stats = await fs.promises.stat(folderPath);

      if (!stats.isDirectory()) continue;

      const commandFiles = (await fs.promises.readdir(folderPath)).filter(
        file => file.endsWith(".js"),
      );

      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const command = await import(filePath);

          if (command.data && command.execute) {
            // Load into both collections to ensure synchronization
            client.commands.set(command.data.name, command);
            const registered = commandHandler.registerCommand(command);

            if (registered) {
              loadedCount++;
              logger.debug(`✅ Loaded command: ${command.data.name}`);
            } else {
              errorCount++;
              logger.error(
                `❌ Failed to register command: ${command.data.name}`,
              );
            }
          } else {
            errorCount++;
            logger.warn(
              `⚠️ Command file ${file} is missing data or execute function`,
            );
          }
        } catch (error) {
          errorCount++;
          logger.error(`❌ Failed to load command from ${file}:`, error);
        }
      }
    }

    // Verify synchronization between collections
    const debugInfo = commandHandler.getAllCommandsDebug();

    if (!debugInfo.synchronized) {
      logger.warn(`⚠️ Command collections are not synchronized!`);
      logger.warn(
        `📊 Handler: ${debugInfo.handlerCount} commands, Client: ${debugInfo.clientCount} commands`,
      );

      const missingInClient = debugInfo.handler.filter(
        cmd => !debugInfo.client.includes(cmd),
      );
      const missingInHandler = debugInfo.client.filter(
        cmd => !debugInfo.handler.includes(cmd),
      );

      if (missingInClient.length > 0) {
        logger.warn(
          `⚠️ Commands missing in client: ${missingInClient.join(", ")}`,
        );
      }
      if (missingInHandler.length > 0) {
        logger.warn(
          `⚠️ Commands missing in handler: ${missingInHandler.join(", ")}`,
        );
      }
    } else {
      logger.info(
        `✅ Command collections are synchronized (${debugInfo.handlerCount} commands)`,
      );
    }

    logger.info(
      `✅ Loaded ${loadedCount} commands successfully (${errorCount} errors)`,
    );
    logger.info(
      `📊 Client commands: ${debugInfo.clientCount}, Handler commands: ${debugInfo.handlerCount}`,
    );

    // Log all loaded commands for debugging
    logger.debug(`📋 Handler commands: ${debugInfo.handler.join(", ")}`);
    logger.debug(`📋 Client commands: ${debugInfo.client.join(", ")}`);
  } catch (error) {
    logger.error("❌ Failed to load commands:", error);
    throw error;
  }
}

async function loadEvents(client, eventsPath) {
  const logger = getLogger();
  const eventHandler = getEventHandler();

  try {
    const eventFiles = (await fs.promises.readdir(eventsPath)).filter(file =>
      file.endsWith(".js"),
    );

    let loadedEvents = 0;

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = await import(filePath);

        if (!event.name || !event.execute) {
          logger.warn(`Event file ${file} is missing name or execute function`);
          continue;
        }

        const eventExecutor = (...args) =>
          eventHandler.processEvent(event.name, event.execute, ...args, client);

        if (event.once) {
          client.once(event.name, eventExecutor);
        } else {
          client.on(event.name, eventExecutor);
        }

        loadedEvents++;
        logger.debug(`Loaded event: ${event.name}`);
      } catch (error) {
        logger.error(`Failed to load event from ${file}:`, error);
      }
    }

    logger.info(`✅ Loaded ${loadedEvents} events`);
  } catch (error) {
    logger.error("Failed to load events:", error);
    throw error;
  }
}

async function main() {
  const logger = getLogger();
  let client = null;
  let healthServer = null;

  try {
    // Wait for Docker environment to stabilize
    await waitForDockerStartup();

    validateEnvironment();
    logger.info(`🚀 Starting Role Reactor Bot v${getVersion()}...`);

    // Initialize health server
    healthServer = new HealthServer();
    healthServer.start();

    // Initialize core systems
    await getStorageManager();
    const performanceMonitor = getPerformanceMonitor();
    const healthCheckRunner = getHealthCheckRunner();

    // Create Discord client
    client = createClient();
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

    // Start the bot
    await client.login(config.discord.token);

    // Setup shutdown handlers
    const shutdown = () => gracefulShutdown(client, healthServer);
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    client.once("ready", () => {
      logger.success(`✅ ${client.user.tag} v${getVersion()} is ready!`);

      // Start background services
      const scheduler = getScheduler(client);
      scheduler.start();
      healthCheckRunner.run(client);
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

    if (healthServer) {
      try {
        healthServer.stop();
      } catch (stopError) {
        logger.error("Error stopping health server:", stopError);
      }
    }

    process.exit(1);
  }
}

main();
