import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
const requiredEnvVars = ["DISCORD_TOKEN", "CLIENT_ID"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach(varName => {
    console.error(`   • ${varName}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set.",
  );
  process.exit(1);
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Create a collection for commands
client.commands = new Collection();

// Load commands
const loadCommands = async () => {
  const commandsPath = path.join(__dirname, "commands");
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = (await import(filePath)).default;

      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }
};

// Load events
const loadEvents = async () => {
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = (await import(filePath)).default;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    console.log(`✅ Loaded event: ${event.name}`);
  }
};

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// Load commands and events
await loadCommands();
await loadEvents();
