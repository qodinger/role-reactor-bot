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
import { getScheduler as getRoleExpirationScheduler } from "./features/temporaryRoles/RoleExpirationScheduler.js";
import { getHealthCheckRunner } from "./utils/monitoring/healthCheck.js";
import { getCommandHandler } from "./utils/core/commandHandler.js";
import { getEventHandler } from "./utils/core/eventHandler.js";
import { getVersion } from "./utils/discord/version.js";
import { startWebhookServer, setClient } from "./server/index.js";

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
  // Base intents (required)
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessagePolls,
  ];

  // Optional privileged intents (only add if enabled in Developer Portal)
  // GuildPresences is required for user status/activity in /userinfo command
  // If not enabled, status will simply not be shown (graceful degradation)
  // Uncomment the line below after enabling "Presence Intent" in Discord Developer Portal
  intents.push(GatewayIntentBits.GuildPresences);

  const client = new Client({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    makeCache: Options.cacheWithLimits(config.cacheLimits),
    // Use optimized rate limit configuration from config
    rest: {
      ...config.rateLimits.rest,
      // Enhanced rate limiting
      globalLimit: config.rateLimits.rest.globalLimit || 50,
      userLimit: config.rateLimits.rest.userLimit || 10,
      guildLimit: config.rateLimits.rest.guildLimit || 20,
    },
    ws: {
      ...config.rateLimits.ws,
      // Optimized WebSocket settings
      heartbeatInterval: config.rateLimits.ws.heartbeatInterval || 41250,
      maxReconnectAttempts: config.rateLimits.ws.maxReconnectAttempts || 5,
      reconnectDelay: config.rateLimits.ws.reconnectDelay || 1000,
    },
  });

  // Add enhanced rate limit event handlers
  client.rest.on("rateLimited", rateLimitInfo => {
    const logger = getLogger();
    // Use nullish coalescing and explicit fallbacks to ensure values are never undefined
    const method = rateLimitInfo?.method ?? "UNKNOWN";
    const path =
      rateLimitInfo?.path ??
      rateLimitInfo?.route ??
      rateLimitInfo?.url ??
      "unknown";
    const timeout =
      rateLimitInfo?.timeout ??
      rateLimitInfo?.resetAfter ??
      rateLimitInfo?.retryAfter ??
      0;

    logger.warn(
      `🚫 Rate limited: ${method} ${path} - Retry after ${timeout}ms`,
    );

    // Log rate limit statistics for monitoring
    logger.debug(`Rate limit details:`, {
      method: rateLimitInfo?.method ?? "UNKNOWN",
      path:
        rateLimitInfo?.path ??
        rateLimitInfo?.route ??
        rateLimitInfo?.url ??
        "unknown",
      timeout:
        rateLimitInfo?.timeout ??
        rateLimitInfo?.resetAfter ??
        rateLimitInfo?.retryAfter ??
        0,
      limit: rateLimitInfo?.limit ?? "unknown",
      remaining: rateLimitInfo?.remaining ?? "unknown",
      resetAfter:
        rateLimitInfo?.resetAfter ??
        rateLimitInfo?.timeout ??
        rateLimitInfo?.retryAfter ??
        0,
    });
  });

  client.rest.on("invalidated", () => {
    const logger = getLogger();
    logger.error("❌ REST connection invalidated - attempting reconnection...");
  });

  // Add connection monitoring
  client.on("clientReady", () => {
    const logger = getLogger();
    logger.info(`🚀 Bot connected with ${client.guilds.cache.size} guilds`);

    // Log cache statistics (non-blocking to avoid rate limits)
    setTimeout(() => {
      try {
        logger.debug("Cache statistics:", {
          guilds: client.guilds.cache.size,
          users: client.users.cache.size,
          channels: client.channels.cache.size,
          // Avoid iterating through guilds to prevent API calls
          roles: "N/A (avoiding API calls during startup)",
        });
      } catch (error) {
        logger.debug("Cache statistics logging failed:", error.message);
      }
    }, 5000); // Delay by 5 seconds to avoid startup rate limits
  });

  return client;
}

async function gracefulShutdown(client) {
  const logger = getLogger();
  logger.info("🔄 Initiating graceful shutdown...");

  try {
    // Stop accepting new requests
    // Health server is now part of the unified API server

    // Stop schedulers

    if (global.tempRoleScheduler) {
      global.tempRoleScheduler.stop();
    }

    if (global.roleScheduler) {
      global.roleScheduler.stop();
    }

    if (global.pollCleanupInterval) {
      clearInterval(global.pollCleanupInterval);
    }

    if (global.subscriptionCleanupInterval) {
      clearInterval(global.subscriptionCleanupInterval);
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

      // Check for direct .js files (old style)
      const commandFiles = (await fs.promises.readdir(folderPath)).filter(
        file => file.endsWith(".js"),
      );

      // Check for subfolders with index.js (new style)
      const subfolders = [];
      for (const item of await fs.promises.readdir(folderPath)) {
        const itemPath = path.join(folderPath, item);
        try {
          const itemStats = await fs.promises.stat(itemPath);
          if (itemStats.isDirectory()) {
            try {
              await fs.promises.access(path.join(itemPath, "index.js"));
              subfolders.push(item);
            } catch {
              // index.js doesn't exist, skip this subfolder
            }
          }
        } catch {
          // Can't stat item, skip
        }
      }

      // Load direct .js files
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

      // Load subfolder index.js files
      for (const subfolder of subfolders) {
        try {
          const indexPath = path.join(folderPath, subfolder, "index.js");
          const command = await import(indexPath);

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
              `⚠️ Command file ${subfolder}/index.js is missing data or execute function`,
            );
          }
        } catch (error) {
          errorCount++;
          logger.error(
            `❌ Failed to load command from ${subfolder}/index.js:`,
            error,
          );
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
  try {
    // Wait for Docker environment to stabilize
    await waitForDockerStartup();

    validateEnvironment();
    logger.info(`🚀 Starting Role Reactor Bot v${getVersion()}...`);

    // Health server functionality is now part of the unified API server

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

    // Start the bot with retry logic
    let loginAttempts = 0;
    const maxLoginAttempts = 3;

    while (loginAttempts < maxLoginAttempts) {
      try {
        logger.info(
          `🔌 Attempting to connect to Discord (attempt ${loginAttempts + 1}/${maxLoginAttempts})...`,
        );
        await client.login(config.discord.token);
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
    });

    client.once("clientReady", async () => {
      logger.success(`✅ ${client.user.tag} v${getVersion()} is ready!`);

      // Start webhook server for Ko-fi integration
      try {
        await startWebhookServer();
        // Set Discord client for API endpoints
        setClient(client);
      } catch (error) {
        logger.error("❌ Failed to start webhook server:", error);
        // Continue bot operation even if webhook server fails
      }

      // Start role scheduler for scheduled role assignments/removals
      const roleScheduler = (
        await import("./features/scheduledRoles/RoleScheduler.js")
      ).getScheduler(client);
      global.roleScheduler = roleScheduler; // Store globally for shutdown
      roleScheduler.start();

      // Start automatic cleanup for generation history
      import("./commands/general/avatar/utils/generationHistory.js").then(
        ({ GenerationHistory }) => {
          GenerationHistory.startAutoCleanup();
        },
      );

      // Start periodic cleanup for feedback contexts
      import("./utils/ai/feedbackManager.js").then(
        ({ startFeedbackContextCleanup }) => {
          startFeedbackContextCleanup();
        },
      );

      // Start temporary role expiration scheduler
      const tempRoleScheduler = getRoleExpirationScheduler(client);
      global.tempRoleScheduler = tempRoleScheduler; // Store globally for shutdown
      tempRoleScheduler.start();

      // Native Discord polls handle their own UI updates automatically

      // Start poll cleanup scheduler (runs every 6 hours)
      const pollCleanupInterval = setInterval(
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
      ); // 6 hours

      global.pollCleanupInterval = pollCleanupInterval; // Store globally for shutdown

      // Start subscription cleanup scheduler (runs every 24 hours)
      const subscriptionCleanupInterval = setInterval(
        async () => {
          try {
            const { checkExpiredSubscriptions } = await import(
              "./webhooks/kofi.js"
            );
            const expiredCount = await checkExpiredSubscriptions();
            if (expiredCount > 0) {
              logger.info(
                `🧹 Subscription cleanup: Removed ${expiredCount} expired Core memberships`,
              );
            }
          } catch (error) {
            logger.error("❌ Subscription cleanup failed:", error);
          }
        },
        24 * 60 * 60 * 1000, // 24 hours
      );
      global.subscriptionCleanupInterval = subscriptionCleanupInterval; // Store globally for shutdown

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

    // Health server is now part of the unified API server

    process.exit(1);
  }
}

main();
