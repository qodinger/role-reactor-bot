// Load environment variables first
import "./load-env.js";

import { REST, Routes } from "discord.js";
import { createSpinner } from "../src/utils/terminal.js";
import { getLogger } from "../src/utils/logger.js";

const logger = getLogger();

async function deleteGlobalCommands(rest, clientId) {
  const spinner = createSpinner("Deleting global commands...").start();
  try {
    await rest.put(Routes.applicationCommands(clientId), {
      body: [],
    });
    spinner.succeed("Global commands deleted.");
  } catch (error) {
    spinner.fail("Failed to delete global commands.");
    logger.error("Error deleting global commands", error);
  }
}

async function deleteGuildCommands(rest, clientId, guildId) {
  const spinner = createSpinner(
    `Deleting commands for guild ${guildId}...`,
  ).start();
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    spinner.succeed(`Commands for guild ${guildId} deleted.`);
  } catch (error) {
    spinner.fail(`Failed to delete commands for guild ${guildId}.`);
    logger.error(`Error deleting commands for guild ${guildId}`, error);
  }
}

async function main() {
  // Load config with fallback to environment variables
  const configModule = await import("../src/config/config.js").catch(
    () => null,
  );
  const config =
    configModule?.config || configModule?.default || configModule || {};

  const discordToken =
    config.discord?.token || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  const clientId = config.discord?.clientId || process.env.DISCORD_CLIENT_ID;

  // Validate required environment variables
  if (!discordToken || !clientId) {
    logger.error(
      "Missing required environment variables: DISCORD_TOKEN (or BOT_TOKEN) and DISCORD_CLIENT_ID",
    );
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(discordToken);

  const guildId = process.argv[2];

  if (guildId) {
    await deleteGuildCommands(rest, clientId, guildId);
  } else {
    await deleteGlobalCommands(rest, clientId);
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
