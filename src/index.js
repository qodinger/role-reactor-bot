import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import RoleExpirationScheduler from "./utils/scheduler.js";

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
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
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

// Register events on client
const registerEvents = (client, events) => {
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
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
  const shutdown = () => {
    console.log("\n🛑 Shutting down gracefully...");
    if (roleScheduler) roleScheduler.stop();
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

// Main application logic
const main = async () => {
  try {
    validateEnvironment();
    logStartup();

    const client = createClient();
    const roleScheduler = new RoleExpirationScheduler(client);

    // Register commands collection
    client.commands = new Collection();

    // Load commands
    const commands = await loadCommands();
    commands.forEach(command => {
      client.commands.set(command.data.name, command);
    });

    console.log(
      "Registered commands:",
      client.commands.map(cmd => cmd.data.name),
    );

    // Load and register events
    const events = await loadEvents();
    registerEvents(client, events);

    // Setup graceful shutdown
    setupGracefulShutdown(client, roleScheduler);

    // Start the bot
    await startBot(client);

    // Start the role expiration scheduler after login
    client.once("ready", () => {
      logClientReady(client);
      roleScheduler.start();
    });
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
};

// Run the application if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
