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
import dotenv from "dotenv";
import RoleExpirationScheduler from "./utils/scheduler.js";
import { getCommandHandler } from "./utils/commandHandler.js";
import { getEventHandler } from "./utils/eventHandler.js";
import { getPerformanceMonitor } from "./utils/performanceMonitor.js";
import { getDatabaseManager } from "./utils/databaseManager.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
const validateEnvironment = () => {
  const requiredEnvVars = ["DISCORD_TOKEN", "CLIENT_ID"];
  const missingEnvVars = requiredEnvVars.filter(
    varName => !process.env[varName],
  );

  if (missingEnvVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingEnvVars.forEach(varName => {
      console.error(`   • ${varName}`);
    });
    console.error(
      "\nPlease check your .env file and ensure all required variables are set.",
    );
    throw new Error("Missing required environment variables");
  }
};

// Create a new client instance
const createClient = () => {
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
    makeCache: Options.cacheWithLimits({
      MessageManager: 25,
      ChannelManager: 100,
      GuildManager: 10,
      UserManager: 100,
    }),
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
        console.error(`❌ Error loading command from ${file}:`, error);
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
      console.error(`❌ Error loading event from ${file}:`, error);
    }
  }
  return events;
};

// Start the bot
const startBot = async client => {
  await client.login(process.env.DISCORD_TOKEN);
};

// Logging functions
const logStartup = () => {
  console.log("🚀 Starting RoleReactor Bot...");
};

const logClientReady = client => {
  console.log(`✅ ${client.user.tag} is ready!`);
};

const logError = error => {
  console.error("❌ Error:", error);
};

// Setup graceful shutdown
const setupGracefulShutdown = (client, roleScheduler) => {
  const shutdown = async () => {
    console.log("\n🛑 Shutting down gracefully...");

    // Stop the role scheduler
    if (roleScheduler) roleScheduler.stop();

    // Close database connections
    try {
      const dbManager = await getDatabaseManager();
      await dbManager.close();
    } catch (error) {
      console.error("Error closing database:", error);
    }

    // Log final performance metrics
    try {
      const performanceMonitor = getPerformanceMonitor();
      const summary = performanceMonitor.getPerformanceSummary();
      console.log("📊 Final Performance Summary:", summary);
    } catch (error) {
      console.error("Error getting performance summary:", error);
    }

    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

// Load configuration
const loadConfig = () => {
  return {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  };
};

// Validate configuration
const validateConfig = config => {
  return !!(config && config.token && config.clientId);
};

// Initialize systems
const initializeSystems = async () => {
  console.log("🔧 Initializing systems...");

  // Initialize all systems in parallel for faster startup
  const [dbManager, performanceMonitor, commandHandler, eventHandler] =
    await Promise.all([
      getDatabaseManager().catch(error => {
        console.error("❌ Failed to initialize database manager:", error);
        throw error;
      }),
      Promise.resolve(getPerformanceMonitor()),
      Promise.resolve(getCommandHandler()),
      Promise.resolve(getEventHandler()),
    ]);

  console.log("✅ Database manager initialized");
  console.log("✅ Performance monitor initialized");
  console.log("✅ Command handler initialized");
  console.log("✅ Event handler initialized");

  return { dbManager, performanceMonitor, commandHandler, eventHandler };
};

// Main application logic
const main = async () => {
  const startTime = Date.now();

  try {
    validateEnvironment();
    logStartup();

    // Initialize all systems
    const systemsInitStart = Date.now();
    const systems = await initializeSystems();
    console.log(`⚡ Systems initialized in ${Date.now() - systemsInitStart}ms`);

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
    console.log(`⚡ Commands and events loaded in ${Date.now() - loadStart}ms`);

    // Register commands
    commands.forEach(command => {
      client.commands.set(command.data.name, command);
      systems.commandHandler.registerCommand(command);
    });

    console.log(
      "Registered commands:",
      client.commands.map(cmd => cmd.data.name),
    );

    // Register events
    console.log(
      "Loaded events:",
      events.map(event => event.name),
    );
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
          console.log(`⚡ Bot ready in ${readyTime}ms`);

          logClientReady(client);
          roleScheduler.start();

          // Log initial performance metrics
          const summary = systems.performanceMonitor.getPerformanceSummary();
          console.log("📊 Initial Performance Summary:", summary);

          // Debug: Log client configuration
          console.log(`🔍 Client intents:`, client.options.intents.toArray());
          console.log(`🔍 Client partials:`, client.options.partials);
          resolve();
        });
      }),
    ]);

    console.log(`🚀 Total startup time: ${Date.now() - startTime}ms`);
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
