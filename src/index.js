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
import { getDatabaseManager } from "./utils/databaseManager.js";
import { getLogger } from "./utils/logger.js";
import { getHealthCheck } from "./utils/healthCheck.js";
import HealthServer from "./utils/healthServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
const validateEnvironment = () => {
  const logger = getLogger();

  if (!config.validate()) {
    logger.error("❌ Configuration validation failed");
    throw new Error("Configuration validation failed");
  }

  logger.info("✅ Configuration validated successfully");
};

// Create a new client instance
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

// Load commands from directory
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

// Validate command structure
const validateCommand = command => {
  return (
    command &&
    command.data &&
    command.data.name &&
    typeof command.execute === "function"
  );
};

// Register events on client with optimized handler
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

// Load events from directory
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

// Start the bot
const startBot = async client => {
  await client.login(config.discord.token);
};

// Logging functions
const logStartup = () => {
  const logger = getLogger();
  logger.info("🚀 Starting Role Reactor Bot...");
};

const logClientReady = client => {
  const logger = getLogger();
  logger.success(`✅ ${client.user.tag} is ready!`);
};

const logError = error => {
  const logger = getLogger();
  logger.error("❌ Error:", error);
};

// Setup graceful shutdown
const setupGracefulShutdown = (client, roleScheduler) => {
  const shutdown = async () => {
    const logger = getLogger();
    logger.info("🛑 Shutting down gracefully...");

    // Stop the role scheduler
    if (roleScheduler) roleScheduler.stop();

    // Close database connections
    try {
      const dbManager = await getDatabaseManager();
      await dbManager.close();
      logger.success("Database connections closed");
    } catch (error) {
      logger.error("Error closing database", error);
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
    dbManager,
    performanceMonitor,
    commandHandler,
    eventHandler,
    healthCheck,
  ] = await Promise.all([
    getDatabaseManager().catch(error => {
      logger.error("❌ Failed to initialize database manager", error);
      throw error;
    }),
    Promise.resolve(getPerformanceMonitor()),
    Promise.resolve(getCommandHandler()),
    Promise.resolve(getEventHandler()),
    Promise.resolve(getHealthCheck()),
  ]);

  logger.success("✅ Database manager initialized");
  logger.success("✅ Performance monitor initialized");
  logger.success("✅ Command handler initialized");
  logger.success("✅ Event handler initialized");
  logger.success("✅ Health check system initialized");

  return {
    dbManager,
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

    // Start health check server for Railway
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
