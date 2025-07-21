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
import { getStorageManager } from "./utils/storage/storageManager.js";
import { getPerformanceMonitor } from "./utils/monitoring/performanceMonitor.js";
import { getLogger } from "./utils/logger.js";
import { getScheduler } from "./features/temporaryRoles/RoleExpirationScheduler.js";
import { getHealthCheckRunner } from "./utils/monitoring/healthCheck.js";
import HealthServer from "./utils/monitoring/healthServer.js";
import { getCommandHandler } from "./utils/core/commandHandler.js";
import { getEventHandler } from "./utils/core/eventHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateEnvironment() {
  const logger = getLogger();
  if (!config.validate()) {
    logger.error("❌ Configuration validation failed");
    throw new Error("Configuration validation failed");
  }
  logger.info("✅ Configuration validated successfully");
}

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    makeCache: Options.cacheWithLimits(config.cacheLimits),
  });
}

async function main() {
  const logger = getLogger();
  try {
    validateEnvironment();
    logger.info("🚀 Starting Role Reactor Bot...");

    const healthServer = new HealthServer();
    healthServer.start();

    await getStorageManager();
    const performanceMonitor = getPerformanceMonitor();
    const commandHandler = getCommandHandler();
    const eventHandler = getEventHandler();
    const healthCheckRunner = getHealthCheckRunner();

    const client = createClient();
    client.commands = new Collection();

    const commandsPath = path.join(__dirname, "commands");
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith(".js"));
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = await import(filePath);
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          commandHandler.registerCommand(command);
        }
      }
    }

    const eventsPath = path.join(__dirname, "events");
    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter(file => file.endsWith(".js"));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = await import(filePath);
      const eventExecutor = (...args) =>
        eventHandler.processEvent(event.name, event.execute, ...args, client);
      if (event.once) {
        client.once(event.name, eventExecutor);
      } else {
        client.on(event.name, eventExecutor);
      }
    }

    client.login(config.discord.token);

    client.once("ready", () => {
      logger.success(`✅ ${client.user.tag} is ready!`);
      const scheduler = getScheduler(client);
      scheduler.start();
      healthCheckRunner.run(client);
      performanceMonitor.startMonitoring();
    });
  } catch (error) {
    getLogger().error("❌ Bot startup failed", error);
    process.exit(1);
  }
}

main();
