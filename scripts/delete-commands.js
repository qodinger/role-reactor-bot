// Load environment variables first
import "./load-env.js";

import { REST, Routes } from "discord.js";
import config from "../src/config/config.js";
import { createSpinner } from "../src/utils/terminal.js";
import { getLogger } from "../src/utils/logger.js";

const logger = getLogger();
const rest = new REST({ version: "10" }).setToken(config.discord.token);

async function deleteGlobalCommands() {
  const spinner = createSpinner("Deleting global commands...").start();
  try {
    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: [],
    });
    spinner.succeed("Global commands deleted.");
  } catch (error) {
    spinner.fail("Failed to delete global commands.");
    logger.error("Error deleting global commands", error);
  }
}

async function deleteGuildCommands(guildId) {
  const spinner = createSpinner(
    `Deleting commands for guild ${guildId}...`,
  ).start();
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, guildId),
      { body: [] },
    );
    spinner.succeed(`Commands for guild ${guildId} deleted.`);
  } catch (error) {
    spinner.fail(`Failed to delete commands for guild ${guildId}.`);
    logger.error(`Error deleting commands for guild ${guildId}`, error);
  }
}

async function main() {
  // Validate required environment variables
  if (!config.discord.token || !config.discord.clientId) {
    logger.error(
      "Missing required environment variables: DISCORD_TOKEN, DISCORD_CLIENT_ID",
    );
    process.exit(1);
  }

  const guildId = process.argv[2];

  if (guildId) {
    await deleteGuildCommands(guildId);
  } else {
    await deleteGlobalCommands();
  }

  // Exit after completion
  // Small delay to ensure all output is flushed
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

main().catch(error => {
  logger.error("Fatal error in delete-commands script:", error);
  setTimeout(() => {
    process.exit(1);
  }, 100);
});
