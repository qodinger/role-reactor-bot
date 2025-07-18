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
 * @version 0.1.0
 * @license MIT
 */

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
import RoleExpirationScheduler from "./utils/scheduler.js";
import { getCommandHandler } from "./utils/commandHandler.js";
import { getEventHandler } from "./utils/eventHandler.js";
import { getPerformanceMonitor } from "./utils/performanceMonitor.js";
import { getStorageManager } from "./utils/storageManager.js";
import { getLogger } from "./utils/logger.js";
import { getHealthCheck } from "./utils/healthCheck.js";
import HealthServer from "./utils/healthServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates environment variables and configuration
 *
 * Checks that all required environment variables are present and valid.
 * Throws an error if validation fails, preventing the bot from starting
 * with invalid configuration.
 *
 * @throws {Error} When configuration validation fails
 * @example
 * validateEnvironment(); // Validates DISCORD_TOKEN, CLIENT_ID, etc.
 */
const validateEnvironment = () => {
  const logger = getLogger();

  if (!config.validate()) {
    logger.error("❌ Configuration validation failed");
    throw new Error("Configuration validation failed");
  }

  logger.info("✅ Configuration validated successfully");
};

/**
 * Creates and configures a new Discord.js Client instance
 *
 * Sets up the client with proper intents, partials, and cache limits
 * for optimal performance and functionality. Uses cache limits from
 * configuration to reduce memory usage.
 *
 * @returns {Client} Configured Discord.js client instance
 * @example
 * const client = createClient();
 * // Client is ready to connect to Discord
 */
const createClient = () => {
  const { cacheLimits } = config.getAll();

  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
    ],
    // Optimize for faster startup
    ws: {
      properties: {
        browser: "Discord iOS",
      },
    },
    // Reduce initial cache size
    makeCache: Options.cacheWithLimits(cacheLimits),
  });
};

/**
 * Dynamically loads all command modules from the commands directory
 *
 * Scans the commands directory structure and loads all .js files as
 * command modules. Supports both default exports and named exports.
 * Handles errors gracefully and logs any loading failures.
 *
 * @returns {Promise<Array>} Array of loaded command objects
 * @example
 * const commands = await loadCommands();
 * // commands = [{ data: {...}, execute: function() {...} }, ...]
 */
const loadCommands = async () => {
  const commandsPath = path.join(__dirname, "commands");
  const commandFolders = fs.readdirSync(commandsPath);
  const commands = [];

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        const commandModule = await import(filePath);
        // Handle both named exports and default exports
        const command = commandModule.default || commandModule;
        if (command && command.data && command.data.name) {
          commands.push(command);
        }
      } catch (error) {
        const logger = getLogger();
        logger.error(`❌ Error loading command from ${file}`, error);
      }
    }
  }
  return commands;
};

/**
 * Validates that a command object has the required structure
 *
 * Checks that the command has the necessary properties (data and execute)
 * to be properly registered and executed by the bot.
 *
 * @param {Object} command - The command object to validate
 * @param {Object} command.data - Command metadata (name, description, etc.)
 * @param {Function} command.execute - Command execution function
 * @returns {boolean} True if command is valid, false otherwise
 * @example
 * const isValid = validateCommand({ data: {...}, execute: () => {} });
 * // isValid = true
 */
const validateCommand = command => {
  return (
    command &&
    command.data &&
    command.data.name &&
    typeof command.execute === "function"
  );
};

/**
 * Registers event handlers on the Discord client
 *
 * Sets up event listeners for all loaded events, using the event handler
 * for consistent processing and error handling. Supports both once and
 * regular event listeners.
 *
 * @param {Client} client - Discord.js client instance
 * @param {Array} events - Array of event objects to register
 * @example
 * registerEvents(client, [
 *   { name: 'ready', execute: () => {}, once: true },
 *   { name: 'messageCreate', execute: () => {} }
 * ]);
 */
const registerEvents = (client, events) => {
  const eventHandler = getEventHandler();

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => {
        eventHandler.processEvent(event.name, event.execute, ...args, client);
      });
    } else {
      client.on(event.name, (...args) => {
        eventHandler.processEvent(event.name, event.execute, ...args, client);
      });
    }
  }
};

/**
 * Dynamically loads all event modules from the events directory
 *
 * Scans the events directory and loads all .js files as event modules.
 * Supports both default exports and named exports. Handles errors
 * gracefully and logs any loading failures.
 *
 * @returns {Promise<Array>} Array of loaded event objects
 * @example
 * const events = await loadEvents();
 * // events = [{ name: 'ready', execute: function() {...} }, ...]
 */
const loadEvents = async () => {
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith(".js"));

  const events = [];
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const eventModule = await import(filePath);
      // Handle both named exports and default exports
      const event = eventModule.default || eventModule;
      events.push(event);
    } catch (error) {
      const logger = getLogger();
      logger.error(`❌ Error loading event from ${file}`, error);
    }
  }
  return events;
};

/**
 * Authenticates and connects the bot to Discord
 *
 * Uses the bot token from configuration to establish a connection
 * to the Discord gateway. This is the final step before the bot
 * becomes operational.
 *
 * @param {Client} client - Discord.js client instance to connect
 * @returns {Promise<void>} Resolves when connection is established
 * @example
 * await startBot(client);
 * // Bot is now connected to Discord
 */
const startBot = async client => {
  await client.login(config.discord.token);
};

/**
 * Logs the bot startup process
 *
 * Provides initial logging to indicate the bot is starting up.
 * Used for monitoring and debugging startup issues.
 */
const logStartup = () => {
  const logger = getLogger();
  logger.info("🚀 Starting Role Reactor Bot...");
};

/**
 * Logs successful client connection
 *
 * Called when the bot successfully connects to Discord and is ready
 * to handle events and commands.
 *
 * @param {Client} client - Connected Discord.js client instance
 */
const logClientReady = client => {
  const logger = getLogger();
  logger.success(`✅ ${client.user.tag} is ready!`);
};

/**
 * Logs errors during bot operation
 *
 * Centralized error logging for debugging and monitoring.
 *
 * @param {Error} error - The error object to log
 */
const logError = error => {
  const logger = getLogger();
  logger.error("❌ Error:", error);
};

/**
 * Sets up graceful shutdown handlers
 *
 * Configures signal handlers (SIGINT, SIGTERM) to ensure the bot
 * shuts down cleanly by closing connections, stopping schedulers,
 * and logging final metrics before exiting.
 *
 * @param {Client} client - Discord.js client instance
 * @param {RoleExpirationScheduler} roleScheduler - Role expiration scheduler
 * @example
 * setupGracefulShutdown(client, roleScheduler);
 * // Bot will now shutdown gracefully on Ctrl+C or kill signals
 */
const setupGracefulShutdown = (client, roleScheduler) => {
  const shutdown = async () => {
    const logger = getLogger();
    logger.info("🛑 Shutting down gracefully...");

    // Stop the role scheduler
    if (roleScheduler) roleScheduler.stop();

    // Close storage connections
    try {
      const storageManager = await getStorageManager();
      await storageManager.close();
      logger.success("Storage connections closed");
    } catch (error) {
      logger.error("Error closing storage", error);
    }

    // Log final performance metrics
    try {
      const performanceMonitor = getPerformanceMonitor();
      const summary = performanceMonitor.getPerformanceSummary();
      logger.info("📊 Final Performance Summary", summary);
    } catch (error) {
      logger.error("Error getting performance summary", error);
    }

    logger.info("Bot shutdown complete");
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

// Load configuration
const loadConfig = () => {
  return config.discord;
};

// Validate configuration
const validateConfig = config => {
  return !!(config && config.token && config.clientId);
};

// Initialize systems
const initializeSystems = async () => {
  const logger = getLogger();
  logger.info("🔧 Initializing systems...");

  // Initialize all systems in parallel for faster startup
  const [
    storageManager,
    performanceMonitor,
    commandHandler,
    eventHandler,
    healthCheck,
  ] = await Promise.all([
    getStorageManager().catch(error => {
      console.error("❌ Storage manager error:", error);
      logger.error("❌ Failed to initialize storage manager", error);
      throw error;
    }),
    Promise.resolve(getPerformanceMonitor()),
    Promise.resolve(getCommandHandler()),
    Promise.resolve(getEventHandler()),
    Promise.resolve(getHealthCheck()),
  ]);

  logger.success("✅ Storage manager initialized");
  logger.success("✅ Performance monitor initialized");
  logger.success("✅ Command handler initialized");
  logger.success("✅ Event handler initialized");
  logger.success("✅ Health check system initialized");

  return {
    storageManager,
    performanceMonitor,
    commandHandler,
    eventHandler,
    healthCheck,
  };
};

// Main application logic
const main = async () => {
  const startTime = Date.now();

  try {
    validateEnvironment();
    logStartup();

    // Start health check server
    const healthServer = new HealthServer();
    healthServer.start();

    // Initialize all systems
    const systemsInitStart = Date.now();
    const systems = await initializeSystems();
    const logger = getLogger();
    logger.info(`⚡ Systems initialized in ${Date.now() - systemsInitStart}ms`);

    const client = createClient();
    const roleScheduler = new RoleExpirationScheduler(client);

    // Register commands collection
    client.commands = new Collection();

    // Load commands and events in parallel with bot login
    const loadStart = Date.now();
    const [commands, events] = await Promise.all([
      loadCommands(),
      loadEvents(),
    ]);
    logger.info(`⚡ Commands and events loaded in ${Date.now() - loadStart}ms`);

    // Register commands
    commands.forEach(command => {
      client.commands.set(command.data.name, command);
      systems.commandHandler.registerCommand(command);
    });

    logger.info("Registered commands", {
      commands: client.commands.map(cmd => cmd.data.name),
    });

    // Register events
    logger.info("Loaded events", {
      events: events.map(event => event.name),
    });
    registerEvents(client, events);

    // Setup graceful shutdown
    setupGracefulShutdown(client, roleScheduler);

    // Start the bot and role scheduler in parallel
    const botStart = Date.now();
    await Promise.all([
      startBot(client),
      // Start role scheduler after a short delay to ensure bot is ready
      new Promise(resolve => {
        client.once("ready", () => {
          const readyTime = Date.now() - botStart;
          logger.info(`⚡ Bot ready in ${readyTime}ms`);

          logClientReady(client);
          roleScheduler.start();

          // Log initial performance metrics
          const summary = systems.performanceMonitor.getPerformanceSummary();
          logger.info("📊 Initial Performance Summary", summary);

          // Debug: Log client configuration
          logger.debug("Client configuration", {
            intents: client.options.intents.toArray(),
            partials: client.options.partials,
          });
          resolve();
        });
      }),
    ]);

    logger.info(`🚀 Total startup time: ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(error);
    process.exit(1);
  }
};

// Export functions for testing
export {
  createClient,
  loadCommands,
  validateCommand,
  registerEvents,
  loadEvents,
  startBot,
  validateEnvironment,
  logStartup,
  logClientReady,
  logError,
  setupGracefulShutdown,
  loadConfig,
  validateConfig,
  initializeSystems,
};

// Run the application if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
