import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import config from "../src/config/config.js";
import { getLogger } from "../src/utils/logger.js";
import { createSpinner } from "../src/utils/terminal.js";

const logger = getLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "../src/commands");
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = await import(filePath);
      if (command.data) {
        commands.push(command.data.toJSON());
      }
    }
  }
  return commands;
}

async function deployCommands() {
  const spinner = createSpinner("Deploying commands...").start();
  try {
    const commands = await loadCommands();
    const rest = new REST({ version: "10" }).setToken(config.discord.token);

    if (process.env.NODE_ENV === "production") {
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commands,
      });
      spinner.succeed("Global commands deployed.");
    } else {
      await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId,
          config.discord.guildId,
        ),
        { body: commands },
      );
      spinner.succeed(`Guild commands deployed to ${config.discord.guildId}.`);
    }
  } catch (error) {
    spinner.fail("Failed to deploy commands.");
    logger.error("Error deploying commands", error);
  }
}

deployCommands();
