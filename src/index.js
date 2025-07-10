const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Professional startup banner
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║                    RoleReactor Bot v1.0.0                    ║");
console.log("║                    Role Management System                    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

// Validate environment variables
const requiredEnvVars = ["DISCORD_TOKEN", "CLIENT_ID"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((varName) => {
    console.error(`   • ${varName}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

// Create a new client instance with professional configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
  // Professional client options
  failIfNotExists: false,
  retryLimit: 3,
  restTimeOffset: 750,
});

// Collections for commands and events
client.commands = new Collection();
client.events = new Collection();

// Professional event loading with error handling
async function loadEvents() {
  try {
    const eventsPath = path.join(__dirname, "events");

    if (!fs.existsSync(eventsPath)) {
      console.error("❌ Events directory not found");
      return;
    }

    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith(".js"));

    console.log(`📁 Loading ${eventFiles.length} event(s)...`);

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }

        console.log(`   ✅ Loaded event: ${event.name}`);
      } catch (error) {
        console.error(`   ❌ Failed to load event ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error loading events:", error);
  }
}

// Professional command loading with error handling
async function loadCommands() {
  try {
    const commandsPath = path.join(__dirname, "commands");

    if (!fs.existsSync(commandsPath)) {
      console.error("❌ Commands directory not found");
      return;
    }

    const commandFolders = fs.readdirSync(commandsPath);
    let totalCommands = 0;

    console.log(
      `📁 Loading commands from ${commandFolders.length} category(ies)...`
    );

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);

      if (!fs.statSync(folderPath).isDirectory()) continue;

      const commandFiles = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".js"));

      console.log(
        `   📂 Category: ${folder} (${commandFiles.length} command(s))`
      );

      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const command = require(filePath);

          if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
            console.log(`      ✅ Loaded command: ${command.data.name}`);
            totalCommands++;
          } else {
            console.warn(
              `      ⚠️  Command at ${filePath} is missing required properties`
            );
          }
        } catch (error) {
          console.error(
            `      ❌ Failed to load command ${file}:`,
            error.message
          );
        }
      }
    }

    console.log(`📊 Total commands loaded: ${totalCommands}`);
  } catch (error) {
    console.error("❌ Error loading commands:", error);
  }
}

// Professional error handling
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:");
  console.error("   Error:", error.message);
  console.error("   Stack:", error.stack);

  // Log to file in production
  if (process.env.NODE_ENV === "production") {
    const fs = require("fs");
    const logEntry = `[${new Date().toISOString()}] Unhandled Rejection: ${
      error.message
    }\n${error.stack}\n\n`;
    fs.appendFileSync("error.log", logEntry);
  }
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:");
  console.error("   Error:", error.message);
  console.error("   Stack:", error.stack);

  // Log to file in production
  if (process.env.NODE_ENV === "production") {
    const fs = require("fs");
    const logEntry = `[${new Date().toISOString()}] Uncaught Exception: ${
      error.message
    }\n${error.stack}\n\n`;
    fs.appendFileSync("error.log", logEntry);
  }

  // Graceful shutdown
  console.log("🔄 Shutting down gracefully...");
  process.exit(1);
});

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

// Professional startup sequence
async function startBot() {
  try {
    console.log("🚀 Starting RoleReactor Bot...");
    console.log("");

    // Load events and commands
    await loadEvents();
    await loadCommands();

    console.log("");
    console.log("🔐 Logging in to Discord...");

    // Login to Discord with error handling
    await client.login(process.env.DISCORD_TOKEN);

    console.log("✅ Bot startup completed successfully!");
    console.log("");
  } catch (error) {
    console.error("❌ Failed to start bot:", error.message);
    console.error("   Please check your Discord token and try again.");
    process.exit(1);
  }
}

// Start the bot
startBot();
