// Load environment variables first
import "./load-env.js";

import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

    categories[folder] = [];

    // Check for direct .js files (old style)
    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    // Check for subfolders with index.js (new style)
    const subfolders = fs.readdirSync(folderPath).filter(item => {
      const itemPath = path.join(folderPath, item);
      return (
        fs.statSync(itemPath).isDirectory() &&
        fs.existsSync(path.join(itemPath, "index.js"))
      );
    });

    // Load direct .js files
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

    // Load subfolder index.js files
    for (const subfolder of subfolders) {
      try {
        const indexPath = path.join(folderPath, subfolder, "index.js");
        const commandModule = await import(indexPath);
        const commandData = commandModule.data || commandModule.default?.data;

        if (commandData) {
          categories[folder].push(commandData.toJSON());
        } else {
          console.warn(
            colors.warning(
              `  [!] No command data found in ${subfolder}/index.js`,
            ),
          );
        }
      } catch (error) {
        console.error(
          createErrorMessage(
            `  [X] Error loading ${subfolder}/index.js: ${error.message}`,
          ),
        );
      }
    }
  }
  return categories;
}

async function deployCommands() {
  const spinner = createSpinner("Starting command deployment...").start();
  try {
    // Load config with fallback to environment variables
    const configModule = await import("../src/config/config.js").catch(
      () => null,
    );
    const config =
      configModule?.config || configModule?.default || configModule || {};

    const discordToken =
      config.discord?.token ||
      process.env.DISCORD_TOKEN ||
      process.env.BOT_TOKEN;
    const clientId = config.discord?.clientId || process.env.DISCORD_CLIENT_ID;
    const guildId = config.discord?.guildId || process.env.DISCORD_GUILD_ID;

    if (!discordToken) {
      throw new Error(
        "Discord token not found. Set DISCORD_TOKEN or BOT_TOKEN environment variable.",
      );
    }

    if (!clientId) {
      throw new Error(
        "Discord client ID not found. Set DISCORD_CLIENT_ID environment variable.",
      );
    }

    const categories = await loadCommands();
    const allCommands = Object.values(categories).flat();
    spinner.text = `Deploying ${allCommands.length} commands...`;

    const rest = new REST({ version: "10" }).setToken(discordToken);

    if (process.env.NODE_ENV === "production") {
      await rest.put(Routes.applicationCommands(clientId), {
        body: allCommands,
      });
      spinner.succeed(
        createSuccessMessage("Successfully deployed global commands."),
      );
    } else {
      if (!guildId) {
        throw new Error(
          "Discord guild ID not found. Set DISCORD_GUILD_ID environment variable for development deployment.",
        );
      }
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: allCommands,
      });
      spinner.succeed(
        createSuccessMessage(
          `Successfully deployed guild commands to ${guildId}.`,
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
              : `${icons.server} Guild: ${guildId}`
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

    // Exit after successful deployment
    // Small delay to ensure all output is flushed
    setTimeout(() => {
      process.exit(0);
    }, 100);
  } catch (error) {
    spinner.fail(createErrorMessage("Failed to deploy commands."));
    console.error(error);
    // Exit with error code on failure
    // Small delay to ensure all output is flushed
    setTimeout(() => {
      process.exit(1);
    }, 100);
  }
}

deployCommands();
