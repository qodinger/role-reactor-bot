// Load environment variables first
import "./load-env.js";

import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../src/config/config.js";
import {
  createSpinner,
  createInfoBox,
  createSuccessMessage,
  createErrorMessage,
  colors,
  icons,
} from "../src/utils/terminal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCommands() {
  const categories = {};
  const commandsPath = path.join(__dirname, "../src/commands");
  const commandFolders = fs.readdirSync(commandsPath);

  console.log(
    `${icons.folder} ${colors.cyan(
      `Found ${commandFolders.length} command categories.`,
    )}`,
  );

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    categories[folder] = [];
    for (const file of commandFiles) {
      try {
        const filePath = path.join(folderPath, file);
        const commandModule = await import(filePath);
        const commandData = commandModule.data || commandModule.default?.data;

        if (commandData) {
          categories[folder].push(commandData.toJSON());
        } else {
          console.warn(
            colors.warning(`  [!] No command data found in ${file}`),
          );
        }
      } catch (error) {
        console.error(
          createErrorMessage(`  [X] Error loading ${file}: ${error.message}`),
        );
      }
    }
  }
  return categories;
}

async function deployCommands() {
  const spinner = createSpinner("Starting command deployment...").start();
  try {
    const categories = await loadCommands();
    const allCommands = Object.values(categories).flat();
    spinner.text = `Deploying ${allCommands.length} commands...`;

    const rest = new REST({ version: "10" }).setToken(config.discord.token);

    if (process.env.NODE_ENV === "production") {
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: allCommands,
      });
      spinner.succeed(
        createSuccessMessage("Successfully deployed global commands."),
      );
    } else {
      await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId,
          config.discord.guildId,
        ),
        { body: allCommands },
      );
      spinner.succeed(
        createSuccessMessage(
          `Successfully deployed guild commands to ${config.discord.guildId}.`,
        ),
      );
    }

    console.log(
      createInfoBox(
        "Deployment Summary",
        [
          `${icons.rocket} Deployed ${allCommands.length} command(s)`,
          `${
            process.env.NODE_ENV === "production"
              ? `${icons.server} Global`
              : `${icons.server} Guild: ${config.discord.guildId}`
          }`,
        ],
        { borderColor: "green" },
      ),
    );

    console.log(colors.bold("\nDeployed Commands:"));
    for (const [category, commands] of Object.entries(categories)) {
      console.log(colors.highlight(`\n  ${category.toUpperCase()}`));
      for (const command of commands) {
        console.log(`    /${command.name}`);
      }
    }
    console.log("");
  } catch (error) {
    spinner.fail(createErrorMessage("Failed to deploy commands."));
    console.error(error);
  }
}

deployCommands();
